import { Tool } from "./tool"
import DESCRIPTION from "./parallel-task.txt"
import z from "zod/v4"
import { Session } from "../session"
import { Bus } from "../bus"
import { MessageV2 } from "../session/message-v2"
import { Identifier } from "../id/id"
import { Agent } from "../agent/agent"
import { SessionLock } from "../session/lock"
import { SessionPrompt } from "../session/prompt"
import { SessionPool } from "../coordinator/session-pool"
import { AggregationActor } from "../coordinator/aggregation-actor"
import { CoordinatorTypes } from "../coordinator/types"
import { Log } from "../util/log"
import { ulid } from "ulid"

/**
 * Parallel Task Tool
 *
 * Non-blocking variant of TaskTool that enables massive parallelism.
 * Dispatches multiple tasks concurrently and aggregates results.
 */
export const ParallelTaskTool = Tool.define("parallel_task", async () => {
  const log = Log.create({ service: "parallel-task-tool" })
  const agents = await Agent.list().then((x) => x.filter((a) => a.mode !== "primary"))
  const description = DESCRIPTION.replace(
    "{agents}",
    agents
      .map((a) => `- ${a.name}: ${a.description ?? "This subagent should only be called manually by the user."}`)
      .join("\n")
  )

  return {
    description,
    parameters: z.object({
      tasks: z
        .array(
          z.object({
            description: z.string().describe("A short (3-5 words) description of this specific task"),
            prompt: z.string().describe("The task for the agent to perform"),
            subagent_type: z.string().describe("The type of specialized agent to use for this task"),
          })
        )
        .min(1)
        .max(200)
        .describe("List of tasks to execute in parallel"),
      strategy: z
        .enum(["all", "first-k", "timebox", "quorum"])
        .default("all")
        .describe("Aggregation strategy for collecting results"),
      k: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("For first-k strategy: number of results to collect"),
      timeout_ms: z
        .number()
        .int()
        .min(1000)
        .max(600000)
        .optional()
        .describe("For timebox strategy: timeout in milliseconds"),
      quorum_percent: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("For quorum strategy: percentage of tasks required (1-100)"),
    }),
    async execute(params, ctx) {
      const startTime = Date.now()
      const correlationId = ulid()

      log.info("dispatching parallel tasks", {
        correlationId,
        taskCount: params.tasks.length,
        strategy: params.strategy,
      })

      // Initialize session pool if needed
      if (!SessionPool) {
        await SessionPool.initialize()
      }

      // Validate strategy-specific parameters
      if (params.strategy === "first-k" && !params.k) {
        throw new Error("first-k strategy requires k parameter")
      }
      if (params.strategy === "timebox" && !params.timeout_ms) {
        throw new Error("timebox strategy requires timeout_ms parameter")
      }
      if (params.strategy === "quorum" && !params.quorum_percent) {
        throw new Error("quorum strategy requires quorum_percent parameter")
      }

      // Start aggregation
      const aggregationConfig: CoordinatorTypes.AggregationConfig = {
        correlationId,
        totalTasks: params.tasks.length,
        strategy: params.strategy,
        k: params.k,
        timeoutMs: params.timeout_ms,
        quorumPercent: params.quorum_percent,
      }

      const aggregationPromise = AggregationActor.startAggregation(aggregationConfig)

      // Dispatch all tasks in parallel
      const dispatchPromises = params.tasks.map((taskSpec) => {
        return executeTask({
          taskSpec,
          correlationId,
          parentSessionID: ctx.sessionID,
          parentMessageID: ctx.messageID,
          abort: ctx.abort,
        })
      })

      // Wait for all dispatches to complete (but not for execution)
      await Promise.allSettled(dispatchPromises)

      log.info("all tasks dispatched", {
        correlationId,
        taskCount: params.tasks.length,
        dispatchTime: Date.now() - startTime,
      })

      // Update metadata to show dispatched status
      ctx.metadata({
        title: `Dispatched ${params.tasks.length} parallel tasks`,
        metadata: {
          correlationId,
          taskCount: params.tasks.length,
          strategy: params.strategy,
          status: "executing",
        },
      })

      // Wait for aggregation to complete
      const aggregatedResults = await aggregationPromise

      log.info("aggregation complete", {
        correlationId,
        successCount: aggregatedResults.successCount,
        failureCount: aggregatedResults.failureCount,
        totalTime: Date.now() - startTime,
      })

      // Format output
      const output = formatAggregatedResults(aggregatedResults, params.strategy)

      return {
        title: `Completed ${aggregatedResults.successCount}/${params.tasks.length} parallel tasks`,
        metadata: {
          correlationId,
          strategy: params.strategy,
          successCount: aggregatedResults.successCount,
          failureCount: aggregatedResults.failureCount,
          completionReason: aggregatedResults.completionReason,
          totalExecutionTime: aggregatedResults.totalExecutionTime,
          results: aggregatedResults.results.map((r) => ({
            taskId: r.taskId,
            success: r.success,
            executionTime: r.executionTime,
          })),
        },
        output,
      }
    },
  }
})

/**
 * Execute a single task asynchronously
 */
async function executeTask(input: {
  taskSpec: { description: string; prompt: string; subagent_type: string }
  correlationId: string
  parentSessionID: string
  parentMessageID: string
  abort: AbortSignal
}): Promise<void> {
  const log = Log.create({ service: "parallel-task-executor" })
  const taskId = ulid()
  const startTime = Date.now()

  try {
    // Get agent
    const agent = await Agent.get(input.taskSpec.subagent_type)
    if (!agent) {
      throw new Error(`Unknown agent type: ${input.taskSpec.subagent_type}`)
    }

    // Publish dispatched event
    await Bus.publish(CoordinatorTypes.Event.TaskDispatched, {
      taskId,
      correlationId: input.correlationId,
      parentSessionID: input.parentSessionID,
      subagent_type: input.taskSpec.subagent_type,
    })

    // Acquire a session from the pool
    const sessionID = await SessionPool.acquire(input.parentSessionID)

    // Publish started event
    await Bus.publish(CoordinatorTypes.Event.TaskStarted, {
      taskId,
      correlationId: input.correlationId,
      sessionID,
    })

    // Get parent message for model info
    const parentMsg = await Session.getMessage({
      sessionID: input.parentSessionID,
      messageID: input.parentMessageID,
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

    // Subscribe to tool parts for this task
    const unsub = Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
      if (evt.properties.part.sessionID !== sessionID) return
      if (evt.properties.part.messageID === messageID) return
      if (evt.properties.part.type !== "tool") return
      parts[evt.properties.part.id] = evt.properties.part
    })

    // Set up abort handling
    input.abort.addEventListener("abort", () => {
      SessionLock.abort(sessionID)
    })

    // Execute the task
    const result = await SessionPrompt.prompt({
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
        parallel_task: false, // Prevent nested parallel tasks
        ...agent.tools,
      },
      parts: [
        {
          id: Identifier.ascending("part"),
          type: "text",
          text: input.taskSpec.prompt,
        },
      ],
    })

    unsub()

    // Release session back to pool
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
      taskId,
      correlationId: input.correlationId,
      sessionID,
      success: true,
      output: (result.parts.findLast((x: any) => x.type === "text") as any)?.text ?? "",
      toolParts,
      executionTime,
    }

    // Publish completion event
    await Bus.publish(CoordinatorTypes.Event.TaskCompleted, taskResult)

    // Add to aggregation
    AggregationActor.addResult(taskResult)

    log.info("task completed successfully", {
      taskId,
      correlationId: input.correlationId,
      executionTime,
    })
  } catch (error) {
    log.error("task failed", {
      taskId,
      correlationId: input.correlationId,
      error: String(error),
    })

    // Create failure result
    const taskResult: CoordinatorTypes.TaskResult = {
      taskId,
      correlationId: input.correlationId,
      sessionID: "",
      success: false,
      error: String(error),
      executionTime: Date.now() - startTime,
    }

    // Publish failure event
    await Bus.publish(CoordinatorTypes.Event.TaskFailed, {
      taskId,
      correlationId: input.correlationId,
      error: String(error),
    })

    // Add to aggregation
    AggregationActor.addResult(taskResult)
  }
}

/**
 * Format aggregated results into human-readable output
 */
function formatAggregatedResults(
  results: CoordinatorTypes.AggregatedResults,
  strategy: string
): string {
  const lines: string[] = []

  lines.push(`# Parallel Task Results (${strategy} strategy)`)
  lines.push("")
  lines.push(`**Summary:**`)
  lines.push(`- Total tasks: ${results.results.length}`)
  lines.push(`- Successful: ${results.successCount}`)
  lines.push(`- Failed: ${results.failureCount}`)
  lines.push(`- Completion reason: ${results.completionReason}`)
  lines.push(`- Total execution time: ${results.totalExecutionTime}ms`)
  lines.push("")

  // Group by success/failure
  const successful = results.results.filter((r) => r.success)
  const failed = results.results.filter((r) => !r.success)

  if (successful.length > 0) {
    lines.push(`## Successful Tasks (${successful.length})`)
    lines.push("")
    for (const result of successful) {
      lines.push(`### Task ${result.taskId}`)
      lines.push(`- Execution time: ${result.executionTime}ms`)
      if (result.output) {
        lines.push(`- Output: ${result.output.substring(0, 500)}${result.output.length > 500 ? "..." : ""}`)
      }
      lines.push("")
    }
  }

  if (failed.length > 0) {
    lines.push(`## Failed Tasks (${failed.length})`)
    lines.push("")
    for (const result of failed) {
      lines.push(`### Task ${result.taskId}`)
      lines.push(`- Error: ${result.error}`)
      lines.push("")
    }
  }

  return lines.join("\n")
}
