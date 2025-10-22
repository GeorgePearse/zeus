import z from "zod/v4"
import { Identifier } from "../id/id"
import { MessageV2 } from "../session/message-v2"
import { Bus } from "../bus"

/**
 * Shared types for the coordinator system that manages parallel sub-agent execution
 */
export namespace CoordinatorTypes {
  /**
   * Task submitted to the coordinator for async execution
   */
  export const Task = z.object({
    /** Unique task identifier */
    taskId: z.string(),
    /** Parent session that initiated this task */
    parentSessionID: Identifier.schema("session"),
    /** Parent message that initiated this task */
    parentMessageID: Identifier.schema("message"),
    /** Correlation ID for grouping related tasks */
    correlationId: z.string(),
    /** Agent type to use for execution */
    subagent_type: z.string(),
    /** Task description */
    description: z.string(),
    /** Prompt/instructions for the agent */
    prompt: z.string(),
    /** Priority (higher = more important) */
    priority: z.number().int().min(0).max(10).default(5),
    /** Deadline timestamp (optional) */
    deadline: z.number().optional(),
    /** Additional metadata */
    metadata: z.record(z.string(), z.any()).optional(),
  })
  export type Task = z.infer<typeof Task>

  /**
   * Result of task execution
   */
  export const TaskResult = z.object({
    /** Task ID this result belongs to */
    taskId: z.string(),
    /** Correlation ID for batch aggregation */
    correlationId: z.string(),
    /** Session that executed the task */
    sessionID: Identifier.schema("session"),
    /** Whether execution succeeded */
    success: z.boolean(),
    /** Output text from the agent */
    output: z.string().optional(),
    /** Tool parts collected during execution */
    toolParts: z.array(MessageV2.ToolPart).optional(),
    /** Error message if failed */
    error: z.string().optional(),
    /** Execution time in milliseconds */
    executionTime: z.number().optional(),
    /** Additional metadata */
    metadata: z.record(z.string(), z.any()).optional(),
  })
  export type TaskResult = z.infer<typeof TaskResult>

  /**
   * Aggregation strategy for collecting results
   */
  export const AggregationStrategy = z.enum([
    "all", // Wait for all tasks to complete
    "first-k", // Return first K results
    "timebox", // Return results within time limit
    "quorum", // Wait for quorum (majority)
  ])
  export type AggregationStrategy = z.infer<typeof AggregationStrategy>

  /**
   * Aggregation configuration
   */
  export const AggregationConfig = z.object({
    /** Correlation ID to aggregate */
    correlationId: z.string(),
    /** Total number of tasks in this batch */
    totalTasks: z.number().int().min(1),
    /** Strategy to use */
    strategy: AggregationStrategy,
    /** For first-k: number of results to collect */
    k: z.number().int().min(1).optional(),
    /** For timebox: timeout in milliseconds */
    timeoutMs: z.number().int().min(0).optional(),
    /** For quorum: percentage required (0-100) */
    quorumPercent: z.number().int().min(1).max(100).optional(),
  })
  export type AggregationConfig = z.infer<typeof AggregationConfig>

  /**
   * Aggregated results from multiple tasks
   */
  export const AggregatedResults = z.object({
    /** Correlation ID */
    correlationId: z.string(),
    /** Individual task results */
    results: z.array(TaskResult),
    /** Number of successful tasks */
    successCount: z.number().int(),
    /** Number of failed tasks */
    failureCount: z.number().int(),
    /** Whether aggregation is complete */
    complete: z.boolean(),
    /** Reason for completion (all-done, timebox, k-reached, quorum) */
    completionReason: z.string().optional(),
    /** Total execution time across all tasks */
    totalExecutionTime: z.number().optional(),
  })
  export type AggregatedResults = z.infer<typeof AggregatedResults>

  /**
   * Events published by the coordinator system
   */
  export const Event = {
    TaskDispatched: Bus.event(
      "coordinator.task.dispatched",
      z.object({
        taskId: z.string(),
        correlationId: z.string(),
        parentSessionID: z.string(),
        subagent_type: z.string(),
      })
    ),
    TaskStarted: Bus.event(
      "coordinator.task.started",
      z.object({
        taskId: z.string(),
        correlationId: z.string(),
        sessionID: z.string(),
      })
    ),
    TaskCompleted: Bus.event("coordinator.task.completed", TaskResult),
    TaskFailed: Bus.event(
      "coordinator.task.failed",
      z.object({
        taskId: z.string(),
        correlationId: z.string(),
        error: z.string(),
      })
    ),
    AggregationComplete: Bus.event("coordinator.aggregation.complete", AggregatedResults),
  }

  /**
   * Session pool configuration
   */
  export const SessionPoolConfig = z.object({
    /** Minimum number of pre-warmed sessions */
    minSize: z.number().int().min(0).default(5),
    /** Maximum number of concurrent sessions */
    maxSize: z.number().int().min(1).default(100),
    /** Idle timeout before session cleanup (ms) */
    idleTimeout: z.number().int().min(0).default(300000), // 5 minutes
    /** Whether to pre-spawn sessions on startup */
    preSpawn: z.boolean().default(true),
  })
  export type SessionPoolConfig = z.infer<typeof SessionPoolConfig>

  /**
   * Agent session in the pool
   */
  export type PooledSession = {
    /** Session info */
    session: {
      id: string
      parentID?: string
      title: string
    }
    /** When this session was created */
    created: number
    /** When this session was last used */
    lastUsed: number
    /** Current status */
    status: "idle" | "busy" | "failed"
    /** Number of tasks executed */
    tasksExecuted: number
  }
}
