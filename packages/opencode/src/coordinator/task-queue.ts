import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { CoordinatorTypes } from "./types"
import { Bus } from "../bus"
import { SessionPool } from "./session-pool"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { Agent } from "../agent/agent"
import { Identifier } from "../id/id"
import { MessageV2 } from "../session/message-v2"
import { SessionLock } from "../session/lock"

/**
 * Global Task Queue
 *
 * Central queue for managing task distribution across the session pool.
 * Provides priority-based scheduling, backpressure, and persistence.
 */
export namespace TaskQueue {
  const log = Log.create({ service: "task-queue" })

  type QueuedTask = {
    task: CoordinatorTypes.Task
    enqueuedAt: number
    attempts: number
    lastAttempt?: number
  }

  type WorkerState = {
    sessionID: string
    currentTask?: string
    startedAt?: number
  }

  const state = Instance.state(() => {
    const queue: QueuedTask[] = []
    const workers = new Map<string, WorkerState>()
    const processing = new Map<string, QueuedTask>()
    const completed = new Map<string, CoordinatorTypes.TaskResult>()
    const deadLetters = new Map<string, { task: CoordinatorTypes.Task; error: string; attempts: number }>()

    // Configuration
    const config = {
      maxQueueSize: 10000,
      maxConcurrency: 100,
      maxRetries: 3,
      retryBackoffMs: 1000,
      taskTimeoutMs: 300000, // 5 minutes
      enablePersistence: false, // Future: enable Redis/NATS persistence
    }

    return {
      queue,
      workers,
      processing,
      completed,
      deadLetters,
      config,
      running: false,
    }
  })

  /**
   * Start the task queue workers
   */
  export async function start(config?: Partial<ReturnType<typeof state>["config"]>) {
    if (state().running) {
      log.info("task queue already running")
      return
    }

    if (config) {
      Object.assign(state().config, config)
    }

    state().running = true
    log.info("starting task queue", {
      maxQueueSize: state().config.maxQueueSize,
      maxConcurrency: state().config.maxConcurrency,
      maxRetries: state().config.maxRetries,
    })

    // Start worker loops
    startWorkerLoop()
  }

  /**
   * Stop the task queue
   */
  export async function stop() {
    if (!state().running) {
      return
    }

    state().running = false
    log.info("stopping task queue", {
      queuedTasks: state().queue.length,
      processingTasks: state().processing.size,
    })

    // Wait for in-flight tasks to complete (with timeout)
    const timeout = 30000
    const startTime = Date.now()
    while (state().processing.size > 0 && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    if (state().processing.size > 0) {
      log.warn("some tasks still processing after timeout", {
        count: state().processing.size,
      })
    }
  }

  /**
   * Enqueue a task for execution
   */
  export async function enqueue(task: CoordinatorTypes.Task): Promise<void> {
    if (state().queue.length >= state().config.maxQueueSize) {
      throw new Error(`Queue is full (max: ${state().config.maxQueueSize})`)
    }

    const queued: QueuedTask = {
      task,
      enqueuedAt: Date.now(),
      attempts: 0,
    }

    // Insert by priority (higher priority first)
    const insertIndex = state().queue.findIndex((q) => q.task.priority < task.priority)
    if (insertIndex === -1) {
      state().queue.push(queued)
    } else {
      state().queue.splice(insertIndex, 0, queued)
    }

    log.info("task enqueued", {
      taskId: task.taskId,
      correlationId: task.correlationId,
      priority: task.priority,
      queueSize: state().queue.length,
    })

    // Publish event
    await Bus.publish(CoordinatorTypes.Event.TaskDispatched, {
      taskId: task.taskId,
      correlationId: task.correlationId,
      parentSessionID: task.parentSessionID,
      subagent_type: task.subagent_type,
    })

    // Trigger processing
    processNext()
  }

  /**
   * Get queue statistics
   */
  export function getStats() {
    return {
      queued: state().queue.length,
      processing: state().processing.size,
      completed: state().completed.size,
      deadLetters: state().deadLetters.size,
      workers: state().workers.size,
      config: state().config,
    }
  }

  /**
   * Get task status
   */
  export function getTaskStatus(taskId: string):
    | { status: "queued"; position: number }
    | { status: "processing"; worker: string }
    | { status: "completed"; result: CoordinatorTypes.TaskResult }
    | { status: "dead"; error: string }
    | { status: "unknown" } {
    // Check queue
    const queueIndex = state().queue.findIndex((q) => q.task.taskId === taskId)
    if (queueIndex !== -1) {
      return { status: "queued", position: queueIndex }
    }

    // Check processing
    const processing = state().processing.get(taskId)
    if (processing) {
      const worker = Array.from(state().workers.entries()).find(([_, w]) => w.currentTask === taskId)
      return { status: "processing", worker: worker?.[0] ?? "unknown" }
    }

    // Check completed
    const completed = state().completed.get(taskId)
    if (completed) {
      return { status: "completed", result: completed }
    }

    // Check dead letters
    const dead = state().deadLetters.get(taskId)
    if (dead) {
      return { status: "dead", error: dead.error }
    }

    return { status: "unknown" }
  }

  /**
   * Worker loop that processes tasks from the queue
   */
  function startWorkerLoop() {
    // Run processing loop
    const processLoop = async () => {
      while (state().running) {
        try {
          await processNext()
        } catch (error) {
          log.error("error in worker loop", { error: String(error) })
        }
        // Small delay to prevent tight loop
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }

    // Start the loop
    processLoop().catch((error) => {
      log.error("worker loop crashed", { error: String(error) })
    })
  }

  /**
   * Process the next task from the queue
   */
  async function processNext() {
    // Check if we can process more tasks
    if (state().processing.size >= state().config.maxConcurrency) {
      return
    }

    // Get next task from queue
    const queued = state().queue.shift()
    if (!queued) {
      return
    }

    // Check if task has deadline
    if (queued.task.deadline && Date.now() > queued.task.deadline) {
      log.warn("task deadline exceeded, moving to dead letter queue", {
        taskId: queued.task.taskId,
        deadline: queued.task.deadline,
      })
      state().deadLetters.set(queued.task.taskId, {
        task: queued.task,
        error: "Deadline exceeded",
        attempts: queued.attempts,
      })
      return
    }

    // Mark as processing
    state().processing.set(queued.task.taskId, queued)
    queued.attempts++
    queued.lastAttempt = Date.now()

    log.info("processing task", {
      taskId: queued.task.taskId,
      correlationId: queued.task.correlationId,
      attempt: queued.attempts,
    })

    // Execute task
    executeTask(queued)
      .then((result) => {
        // Task succeeded
        state().processing.delete(queued.task.taskId)
        state().completed.set(queued.task.taskId, result)

        log.info("task completed", {
          taskId: queued.task.taskId,
          success: result.success,
          executionTime: result.executionTime,
        })

        // Cleanup old completed tasks (keep last 1000)
        if (state().completed.size > 1000) {
          const toDelete = Array.from(state().completed.keys()).slice(0, state().completed.size - 1000)
          toDelete.forEach((taskId) => state().completed.delete(taskId))
        }
      })
      .catch((error) => {
        // Task failed
        log.error("task failed", {
          taskId: queued.task.taskId,
          error: String(error),
          attempt: queued.attempts,
        })

        state().processing.delete(queued.task.taskId)

        // Check if we should retry
        if (queued.attempts < state().config.maxRetries) {
          // Re-enqueue with backoff
          const backoff = state().config.retryBackoffMs * Math.pow(2, queued.attempts - 1)
          setTimeout(() => {
            state().queue.push(queued)
            log.info("task re-enqueued for retry", {
              taskId: queued.task.taskId,
              attempt: queued.attempts + 1,
              backoff,
            })
          }, backoff)
        } else {
          // Move to dead letter queue
          state().deadLetters.set(queued.task.taskId, {
            task: queued.task,
            error: String(error),
            attempts: queued.attempts,
          })

          log.warn("task moved to dead letter queue", {
            taskId: queued.task.taskId,
            attempts: queued.attempts,
          })

          // Publish failure event
          Bus.publish(CoordinatorTypes.Event.TaskFailed, {
            taskId: queued.task.taskId,
            correlationId: queued.task.correlationId,
            error: String(error),
          })

          // Create failure result for aggregation
          const failureResult: CoordinatorTypes.TaskResult = {
            taskId: queued.task.taskId,
            correlationId: queued.task.correlationId,
            sessionID: "",
            success: false,
            error: String(error),
            executionTime: 0,
          }

          // Import and use aggregation actor
          import("./aggregation-actor").then((mod) => {
            mod.AggregationActor.addResult(failureResult)
          })
        }
      })
  }

  /**
   * Execute a task
   */
  async function executeTask(queued: QueuedTask): Promise<CoordinatorTypes.TaskResult> {
    const startTime = Date.now()
    const task = queued.task

    // Get agent
    const agent = await Agent.get(task.subagent_type)
    if (!agent) {
      throw new Error(`Unknown agent type: ${task.subagent_type}`)
    }

    // Acquire session from pool
    const sessionID = await SessionPool.acquire(task.parentSessionID)

    // Publish started event
    await Bus.publish(CoordinatorTypes.Event.TaskStarted, {
      taskId: task.taskId,
      correlationId: task.correlationId,
      sessionID,
    })

    // Get parent message for model info
    const parentMsg = await Session.getMessage({
      sessionID: task.parentSessionID,
      messageID: task.parentMessageID,
    })
    if (parentMsg.info.role !== "assistant") {
      throw new Error("Parent message is not an assistant message")
    }

    const model = agent.model ?? {
      modelID: parentMsg.info.modelID,
      providerID: parentMsg.info.providerID,
    }

    const messageID = Identifier.ascending("message")
    const parts: Record<string, MessageV2.ToolPart> = {}

    // Subscribe to tool parts
    const unsub = Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
      if (evt.properties.part.sessionID !== sessionID) return
      if (evt.properties.part.messageID === messageID) return
      if (evt.properties.part.type !== "tool") return
      parts[evt.properties.part.id] = evt.properties.part
    })

    try {
      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task timeout after ${state().config.taskTimeoutMs}ms`))
        }, state().config.taskTimeoutMs)
      })

      const executionPromise = SessionPrompt.prompt({
        messageID,
        sessionID,
        model: {
          modelID: model.modelID,
          providerID: model.providerID,
        },
        agent: agent.name,
        tools: {
          todowrite: false,
          todoread: false,
          task: false,
          parallel_task: false,
          ...agent.tools,
        },
        parts: [
          {
            id: Identifier.ascending("part"),
            type: "text",
            text: task.prompt,
          },
        ],
      })

      const result = await Promise.race([executionPromise, timeoutPromise])

      unsub()

      // Release session
      SessionPool.release(sessionID, true)

      const executionTime = Date.now() - startTime

      // Collect tool parts
      let all = await Session.messages(sessionID)
      all = all.filter((x) => x.info.role === "assistant")
      const toolParts = all.flatMap((msg) =>
        msg.parts.filter((x: any) => x.type === "tool")
      ) as MessageV2.ToolPart[]

      // Create result
      const taskResult: CoordinatorTypes.TaskResult = {
        taskId: task.taskId,
        correlationId: task.correlationId,
        sessionID,
        success: true,
        output: (result.parts.findLast((x: any) => x.type === "text") as any)?.text ?? "",
        toolParts,
        executionTime,
      }

      // Publish completion
      await Bus.publish(CoordinatorTypes.Event.TaskCompleted, taskResult)

      // Add to aggregation
      import("./aggregation-actor").then((mod) => {
        mod.AggregationActor.addResult(taskResult)
      })

      return taskResult
    } catch (error) {
      unsub()
      SessionPool.release(sessionID, false)
      throw error
    }
  }
}
