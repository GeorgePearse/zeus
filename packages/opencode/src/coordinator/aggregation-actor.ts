import { Bus } from "../bus"
import { Log } from "../util/log"
import { CoordinatorTypes } from "./types"
import { Instance } from "../project/instance"

/**
 * Aggregation Actor
 *
 * Collects and aggregates results from multiple parallel tasks.
 * Supports various aggregation strategies (all, first-k, timebox, quorum).
 */
export namespace AggregationActor {
  const log = Log.create({ service: "aggregation-actor" })

  type AggregationState = {
    config: CoordinatorTypes.AggregationConfig
    results: CoordinatorTypes.TaskResult[]
    startTime: number
    complete: boolean
    resolvers: ((results: CoordinatorTypes.AggregatedResults) => void)[]
    timeoutHandle?: NodeJS.Timeout
  }

  const state = Instance.state(() => {
    const aggregations = new Map<string, AggregationState>()
    return { aggregations }
  })

  /**
   * Start aggregating results for a batch of tasks
   */
  export async function startAggregation(
    config: CoordinatorTypes.AggregationConfig
  ): Promise<CoordinatorTypes.AggregatedResults> {
    log.info("starting aggregation", {
      correlationId: config.correlationId,
      totalTasks: config.totalTasks,
      strategy: config.strategy,
    })

    const aggregation: AggregationState = {
      config,
      results: [],
      startTime: Date.now(),
      complete: false,
      resolvers: [],
    }

    state().aggregations.set(config.correlationId, aggregation)

    // Set up timeout if using timebox strategy
    if (config.strategy === "timebox" && config.timeoutMs) {
      aggregation.timeoutHandle = setTimeout(() => {
        completeAggregation(config.correlationId, "timebox")
      }, config.timeoutMs)
    }

    // Return a promise that resolves when aggregation completes
    return new Promise((resolve) => {
      aggregation.resolvers.push(resolve)
    })
  }

  /**
   * Add a task result to the aggregation
   */
  export function addResult(result: CoordinatorTypes.TaskResult): void {
    const aggregation = state().aggregations.get(result.correlationId)
    if (!aggregation) {
      log.warn("received result for unknown aggregation", {
        correlationId: result.correlationId,
        taskId: result.taskId,
      })
      return
    }

    if (aggregation.complete) {
      log.debug("received result for already completed aggregation", {
        correlationId: result.correlationId,
        taskId: result.taskId,
      })
      return
    }

    // Add result
    aggregation.results.push(result)
    log.debug("added result to aggregation", {
      correlationId: result.correlationId,
      taskId: result.taskId,
      resultCount: aggregation.results.length,
      totalTasks: aggregation.config.totalTasks,
    })

    // Check if aggregation should complete based on strategy
    checkCompletion(result.correlationId)
  }

  /**
   * Cancel an ongoing aggregation
   */
  export function cancelAggregation(correlationId: string): void {
    const aggregation = state().aggregations.get(correlationId)
    if (!aggregation) {
      log.warn("attempted to cancel unknown aggregation", { correlationId })
      return
    }

    if (aggregation.timeoutHandle) {
      clearTimeout(aggregation.timeoutHandle)
    }

    // Resolve with partial results
    completeAggregation(correlationId, "cancelled")
  }

  /**
   * Get current status of an aggregation
   */
  export function getStatus(correlationId: string): {
    complete: boolean
    resultCount: number
    totalTasks: number
  } | null {
    const aggregation = state().aggregations.get(correlationId)
    if (!aggregation) return null

    return {
      complete: aggregation.complete,
      resultCount: aggregation.results.length,
      totalTasks: aggregation.config.totalTasks,
    }
  }

  /**
   * Check if aggregation should complete based on strategy
   */
  function checkCompletion(correlationId: string): void {
    const aggregation = state().aggregations.get(correlationId)
    if (!aggregation || aggregation.complete) return

    const { config, results } = aggregation
    let shouldComplete = false
    let reason = ""

    switch (config.strategy) {
      case "all":
        if (results.length >= config.totalTasks) {
          shouldComplete = true
          reason = "all-done"
        }
        break

      case "first-k":
        if (config.k && results.length >= config.k) {
          shouldComplete = true
          reason = "k-reached"
        }
        break

      case "quorum":
        if (config.quorumPercent) {
          const quorumCount = Math.ceil((config.totalTasks * config.quorumPercent) / 100)
          if (results.length >= quorumCount) {
            shouldComplete = true
            reason = "quorum"
          }
        }
        break

      case "timebox":
        // Timebox completion is handled by timeout
        // But also complete if all tasks are done
        if (results.length >= config.totalTasks) {
          shouldComplete = true
          reason = "all-done"
        }
        break
    }

    if (shouldComplete) {
      completeAggregation(correlationId, reason)
    }
  }

  /**
   * Complete an aggregation and notify resolvers
   */
  function completeAggregation(correlationId: string, reason: string): void {
    const aggregation = state().aggregations.get(correlationId)
    if (!aggregation || aggregation.complete) return

    aggregation.complete = true

    if (aggregation.timeoutHandle) {
      clearTimeout(aggregation.timeoutHandle)
    }

    const totalExecutionTime = Date.now() - aggregation.startTime
    const successCount = aggregation.results.filter((r) => r.success).length
    const failureCount = aggregation.results.filter((r) => !r.success).length

    const aggregatedResults: CoordinatorTypes.AggregatedResults = {
      correlationId,
      results: aggregation.results,
      successCount,
      failureCount,
      complete: true,
      completionReason: reason,
      totalExecutionTime,
    }

    log.info("aggregation complete", {
      correlationId,
      reason,
      resultCount: aggregation.results.length,
      successCount,
      failureCount,
      totalExecutionTime,
    })

    // Resolve all waiting promises
    for (const resolve of aggregation.resolvers) {
      resolve(aggregatedResults)
    }

    // Clean up
    state().aggregations.delete(correlationId)
  }

  /**
   * Get statistics about ongoing aggregations
   */
  export function getStats() {
    const aggregations = state().aggregations
    return {
      ongoing: aggregations.size,
      details: Array.from(aggregations.entries()).map(([correlationId, agg]) => ({
        correlationId,
        resultCount: agg.results.length,
        totalTasks: agg.config.totalTasks,
        strategy: agg.config.strategy,
        elapsed: Date.now() - agg.startTime,
      })),
    }
  }
}
