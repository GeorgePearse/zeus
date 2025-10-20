import { Log } from "../util/log"
import { Instance } from "../project/instance"

/**
 * Metrics System
 *
 * Tracks performance metrics for the coordinator system.
 * Provides counters, histograms, and gauges for observability.
 */
export namespace Metrics {
  const log = Log.create({ service: "metrics" })

  type Counter = {
    value: number
    lastUpdated: number
  }

  type Histogram = {
    samples: number[]
    maxSamples: number
    sum: number
    count: number
    lastUpdated: number
  }

  type Gauge = {
    value: number
    lastUpdated: number
  }

  const state = Instance.state(() => {
    const counters = new Map<string, Counter>()
    const histograms = new Map<string, Histogram>()
    const gauges = new Map<string, Gauge>()
    const startTime = Date.now()

    return {
      counters,
      histograms,
      gauges,
      startTime,
    }
  })

  /**
   * Increment a counter
   */
  export function incrementCounter(name: string, value: number = 1): void {
    const counter = state().counters.get(name)
    if (counter) {
      counter.value += value
      counter.lastUpdated = Date.now()
    } else {
      state().counters.set(name, {
        value,
        lastUpdated: Date.now(),
      })
    }
  }

  /**
   * Record a value in a histogram
   */
  export function recordHistogram(name: string, value: number): void {
    const histogram = state().histograms.get(name)
    if (histogram) {
      histogram.samples.push(value)
      histogram.sum += value
      histogram.count++
      histogram.lastUpdated = Date.now()

      // Keep only last N samples
      if (histogram.samples.length > histogram.maxSamples) {
        histogram.samples.shift()
      }
    } else {
      state().histograms.set(name, {
        samples: [value],
        maxSamples: 1000,
        sum: value,
        count: 1,
        lastUpdated: Date.now(),
      })
    }
  }

  /**
   * Set a gauge value
   */
  export function setGauge(name: string, value: number): void {
    const gauge = state().gauges.get(name)
    if (gauge) {
      gauge.value = value
      gauge.lastUpdated = Date.now()
    } else {
      state().gauges.set(name, {
        value,
        lastUpdated: Date.now(),
      })
    }
  }

  /**
   * Get counter value
   */
  export function getCounter(name: string): number {
    return state().counters.get(name)?.value ?? 0
  }

  /**
   * Get histogram statistics
   */
  export function getHistogramStats(name: string): {
    count: number
    sum: number
    avg: number
    min: number
    max: number
    p50: number
    p95: number
    p99: number
  } | null {
    const histogram = state().histograms.get(name)
    if (!histogram || histogram.samples.length === 0) {
      return null
    }

    const sorted = [...histogram.samples].sort((a, b) => a - b)
    const count = histogram.count
    const sum = histogram.sum
    const avg = sum / count

    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]

    return {
      count,
      sum,
      avg,
      min,
      max,
      p50,
      p95,
      p99,
    }
  }

  /**
   * Get gauge value
   */
  export function getGauge(name: string): number {
    return state().gauges.get(name)?.value ?? 0
  }

  /**
   * Get all metrics as a snapshot
   */
  export function snapshot(): {
    uptime: number
    counters: Record<string, number>
    histograms: Record<
      string,
      {
        count: number
        avg: number
        p50: number
        p95: number
        p99: number
      }
    >
    gauges: Record<string, number>
  } {
    const uptime = Date.now() - state().startTime

    const counters: Record<string, number> = {}
    for (const [name, counter] of state().counters.entries()) {
      counters[name] = counter.value
    }

    const histograms: Record<
      string,
      {
        count: number
        avg: number
        p50: number
        p95: number
        p99: number
      }
    > = {}
    for (const [name, _] of state().histograms.entries()) {
      const stats = getHistogramStats(name)
      if (stats) {
        histograms[name] = {
          count: stats.count,
          avg: stats.avg,
          p50: stats.p50,
          p95: stats.p95,
          p99: stats.p99,
        }
      }
    }

    const gauges: Record<string, number> = {}
    for (const [name, gauge] of state().gauges.entries()) {
      gauges[name] = gauge.value
    }

    return {
      uptime,
      counters,
      histograms,
      gauges,
    }
  }

  /**
   * Print metrics to console
   */
  export function print(): void {
    const snap = snapshot()

    console.log("\n" + "=".repeat(60))
    console.log("📊 COORDINATOR METRICS")
    console.log("=".repeat(60))
    console.log(`Uptime: ${(snap.uptime / 1000).toFixed(2)}s`)
    console.log("")

    if (Object.keys(snap.counters).length > 0) {
      console.log("Counters:")
      for (const [name, value] of Object.entries(snap.counters)) {
        console.log(`  ${name}: ${value}`)
      }
      console.log("")
    }

    if (Object.keys(snap.histograms).length > 0) {
      console.log("Histograms:")
      for (const [name, stats] of Object.entries(snap.histograms)) {
        console.log(`  ${name}:`)
        console.log(`    count: ${stats.count}`)
        console.log(`    avg: ${stats.avg.toFixed(2)}`)
        console.log(`    p50: ${stats.p50.toFixed(2)}`)
        console.log(`    p95: ${stats.p95.toFixed(2)}`)
        console.log(`    p99: ${stats.p99.toFixed(2)}`)
      }
      console.log("")
    }

    if (Object.keys(snap.gauges).length > 0) {
      console.log("Gauges:")
      for (const [name, value] of Object.entries(snap.gauges)) {
        console.log(`  ${name}: ${value}`)
      }
      console.log("")
    }
  }

  /**
   * Reset all metrics
   */
  export function reset(): void {
    state().counters.clear()
    state().histograms.clear()
    state().gauges.clear()
    log.info("metrics reset")
  }
}

/**
 * Coordinator-specific metrics
 */
export namespace CoordinatorMetrics {
  /**
   * Record task metrics
   */
  export function recordTaskDispatched(priority: number): void {
    Metrics.incrementCounter("tasks.dispatched")
    Metrics.incrementCounter(`tasks.priority.${priority}`)
  }

  export function recordTaskStarted(): void {
    Metrics.incrementCounter("tasks.started")
  }

  export function recordTaskCompleted(executionTimeMs: number, success: boolean): void {
    Metrics.incrementCounter("tasks.completed")
    if (success) {
      Metrics.incrementCounter("tasks.success")
    } else {
      Metrics.incrementCounter("tasks.failed")
    }
    Metrics.recordHistogram("tasks.execution_time_ms", executionTimeMs)
  }

  export function recordTaskRetry(): void {
    Metrics.incrementCounter("tasks.retries")
  }

  export function recordTaskDeadLetter(): void {
    Metrics.incrementCounter("tasks.dead_letters")
  }

  /**
   * Record queue metrics
   */
  export function setQueueSize(size: number): void {
    Metrics.setGauge("queue.size", size)
  }

  export function setProcessingCount(count: number): void {
    Metrics.setGauge("queue.processing", count)
  }

  /**
   * Record session pool metrics
   */
  export function setPoolSize(total: number, idle: number, busy: number): void {
    Metrics.setGauge("pool.total", total)
    Metrics.setGauge("pool.idle", idle)
    Metrics.setGauge("pool.busy", busy)
  }

  /**
   * Record aggregation metrics
   */
  export function recordAggregationComplete(
    strategy: string,
    resultCount: number,
    totalTimeMs: number
  ): void {
    Metrics.incrementCounter(`aggregation.complete.${strategy}`)
    Metrics.recordHistogram(`aggregation.result_count.${strategy}`, resultCount)
    Metrics.recordHistogram(`aggregation.time_ms.${strategy}`, totalTimeMs)
  }
}
