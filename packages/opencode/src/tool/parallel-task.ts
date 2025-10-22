import { Tool } from "./tool"
import DESCRIPTION from "./parallel-task.txt"
import z from "zod/v4"
import { AggregationActor } from "../coordinator/aggregation-actor"
import { CoordinatorTypes } from "../coordinator/types"
import { Log } from "../util/log"
import { ulid } from "ulid"
import { Agent } from "../agent/agent"

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

      // Initialize coordinator system if needed
      const { initializeCoordinator } = await import("../coordinator")
      await initializeCoordinator()

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

      // Enqueue all tasks to the task queue
      const { TaskQueue } = await import("../coordinator/task-queue")
      const { CoordinatorMetrics } = await import("../coordinator/metrics")

      for (let i = 0; i < params.tasks.length; i++) {
        const taskSpec = params.tasks[i]
        const task: CoordinatorTypes.Task = {
          taskId: ulid(),
          parentSessionID: ctx.sessionID,
          parentMessageID: ctx.messageID,
          correlationId,
          subagent_type: taskSpec.subagent_type,
          description: taskSpec.description,
          prompt: taskSpec.prompt,
          priority: 5, // Default priority
        }

        await TaskQueue.enqueue(task)
        CoordinatorMetrics.recordTaskDispatched(task.priority)
      }

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
