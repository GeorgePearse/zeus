/**
 * Coordinator System
 *
 * Enables massive parallel sub-agent execution with non-blocking coordinators.
 * Provides session pooling, task distribution, and result aggregation.
 */

export { SessionPool } from "./session-pool"
export { AggregationActor } from "./aggregation-actor"
export { TaskQueue } from "./task-queue"
export { RateLimiter, ConcurrencyLimiter } from "./rate-limiter"
export { Metrics, CoordinatorMetrics } from "./metrics"
export { CoordinatorTypes } from "./types"

/**
 * Initialize the coordinator system
 *
 * Should be called on application startup to pre-spawn session pool and start task queue.
 */
export async function initializeCoordinator(config?: {
  sessionPool?: Partial<CoordinatorTypes.SessionPoolConfig>
  taskQueue?: {
    maxQueueSize?: number
    maxConcurrency?: number
    maxRetries?: number
  }
  rateLimiters?: Array<{
    name: string
    tokensPerSecond: number
    maxTokens: number
  }>
  concurrencyLimiters?: Array<{
    name: string
    maxConcurrency: number
  }>
}): Promise<void> {
  const { SessionPool } = await import("./session-pool")
  const { TaskQueue } = await import("./task-queue")
  const { RateLimiter, ConcurrencyLimiter } = await import("./rate-limiter")

  // Initialize session pool
  await SessionPool.initialize(config?.sessionPool)

  // Start task queue
  await TaskQueue.start(config?.taskQueue)

  // Create rate limiters
  if (config?.rateLimiters) {
    for (const limiterConfig of config.rateLimiters) {
      RateLimiter.create(limiterConfig)
    }
  }

  // Create concurrency limiters
  if (config?.concurrencyLimiters) {
    for (const limiterConfig of config.concurrencyLimiters) {
      ConcurrencyLimiter.create(limiterConfig.name, limiterConfig.maxConcurrency)
    }
  }
}
