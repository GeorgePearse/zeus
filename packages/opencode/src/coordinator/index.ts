/**
 * Coordinator System
 *
 * Enables massive parallel sub-agent execution with non-blocking coordinators.
 * Provides session pooling, task distribution, and result aggregation.
 */

export { SessionPool } from "./session-pool"
export { AggregationActor } from "./aggregation-actor"
export { CoordinatorTypes } from "./types"

/**
 * Initialize the coordinator system
 *
 * Should be called on application startup to pre-spawn session pool.
 */
export async function initializeCoordinator(
  config?: Partial<CoordinatorTypes.SessionPoolConfig>
): Promise<void> {
  const { SessionPool } = await import("./session-pool")
  await SessionPool.initialize(config)
}
