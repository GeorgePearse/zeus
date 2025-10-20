import { Log } from "../util/log"
import { Instance } from "../project/instance"

/**
 * Rate Limiter
 *
 * Provides token bucket rate limiting for API calls and task execution.
 * Prevents overwhelming external APIs with too many concurrent requests.
 */
export namespace RateLimiter {
  const log = Log.create({ service: "rate-limiter" })

  type LimiterState = {
    tokens: number
    lastRefill: number
    waitingRequests: Array<{
      tokensNeeded: number
      resolve: () => void
      reject: (error: Error) => void
      timeout: NodeJS.Timeout
    }>
  }

  type LimiterConfig = {
    tokensPerSecond: number
    maxTokens: number
    name: string
  }

  const state = Instance.state(() => {
    const limiters = new Map<string, LimiterState>()
    const configs = new Map<string, LimiterConfig>()
    return { limiters, configs }
  })

  /**
   * Create a new rate limiter
   */
  export function create(config: LimiterConfig): void {
    if (state().configs.has(config.name)) {
      log.warn("rate limiter already exists", { name: config.name })
      return
    }

    state().configs.set(config.name, config)
    state().limiters.set(config.name, {
      tokens: config.maxTokens,
      lastRefill: Date.now(),
      waitingRequests: [],
    })

    log.info("created rate limiter", {
      name: config.name,
      tokensPerSecond: config.tokensPerSecond,
      maxTokens: config.maxTokens,
    })

    // Start refill loop
    startRefillLoop(config.name)
  }

  /**
   * Acquire tokens (async, waits if not enough tokens available)
   */
  export async function acquire(name: string, tokensNeeded: number = 1, timeoutMs: number = 30000): Promise<void> {
    const limiter = state().limiters.get(name)
    const config = state().configs.get(name)

    if (!limiter || !config) {
      throw new Error(`Rate limiter not found: ${name}`)
    }

    // Refill tokens
    refillTokens(name)

    // Check if we have enough tokens
    if (limiter.tokens >= tokensNeeded) {
      limiter.tokens -= tokensNeeded
      return
    }

    // Not enough tokens, wait
    log.debug("waiting for tokens", {
      name,
      tokensNeeded,
      available: limiter.tokens,
    })

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from waiting list
        const index = limiter.waitingRequests.findIndex((r) => r.resolve === resolve)
        if (index !== -1) {
          limiter.waitingRequests.splice(index, 1)
        }
        reject(new Error(`Rate limiter timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      limiter.waitingRequests.push({
        tokensNeeded,
        resolve,
        reject,
        timeout,
      })
    })
  }

  /**
   * Try to acquire tokens (non-blocking, returns false if not enough tokens)
   */
  export function tryAcquire(name: string, tokensNeeded: number = 1): boolean {
    const limiter = state().limiters.get(name)
    const config = state().configs.get(name)

    if (!limiter || !config) {
      throw new Error(`Rate limiter not found: ${name}`)
    }

    // Refill tokens
    refillTokens(name)

    // Check if we have enough tokens
    if (limiter.tokens >= tokensNeeded) {
      limiter.tokens -= tokensNeeded
      return true
    }

    return false
  }

  /**
   * Get current state of rate limiter
   */
  export function getState(name: string): { tokens: number; waiting: number } | null {
    const limiter = state().limiters.get(name)
    if (!limiter) return null

    return {
      tokens: Math.floor(limiter.tokens),
      waiting: limiter.waitingRequests.length,
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
  function refillTokens(name: string): void {
    const limiter = state().limiters.get(name)
    const config = state().configs.get(name)

    if (!limiter || !config) return

    const now = Date.now()
    const elapsed = (now - limiter.lastRefill) / 1000 // Convert to seconds
    const tokensToAdd = elapsed * config.tokensPerSecond

    limiter.tokens = Math.min(limiter.tokens + tokensToAdd, config.maxTokens)
    limiter.lastRefill = now

    // Process waiting requests
    processWaitingRequests(name)
  }

  /**
   * Process waiting requests if we have enough tokens
   */
  function processWaitingRequests(name: string): void {
    const limiter = state().limiters.get(name)
    if (!limiter) return

    while (limiter.waitingRequests.length > 0) {
      const request = limiter.waitingRequests[0]

      if (limiter.tokens >= request.tokensNeeded) {
        // Remove from queue
        limiter.waitingRequests.shift()
        // Deduct tokens
        limiter.tokens -= request.tokensNeeded
        // Clear timeout
        clearTimeout(request.timeout)
        // Resolve promise
        request.resolve()
      } else {
        // Not enough tokens, stop processing
        break
      }
    }
  }

  /**
   * Start refill loop for a rate limiter
   */
  function startRefillLoop(name: string): void {
    const interval = setInterval(() => {
      const limiter = state().limiters.get(name)
      if (!limiter) {
        clearInterval(interval)
        return
      }

      refillTokens(name)
    }, 100) // Refill every 100ms

    // Clean up on instance shutdown
    Instance.state(() => {
      return {
        cleanup: () => {
          clearInterval(interval)
        },
      }
    })
  }
}

/**
 * Concurrency Limiter
 *
 * Limits the number of concurrent operations.
 * Simpler than rate limiter - just tracks active count.
 */
export namespace ConcurrencyLimiter {
  const log = Log.create({ service: "concurrency-limiter" })

  type LimiterState = {
    active: number
    maxConcurrency: number
    waitingRequests: Array<{
      resolve: () => void
      reject: (error: Error) => void
      timeout: NodeJS.Timeout
    }>
  }

  const state = Instance.state(() => {
    const limiters = new Map<string, LimiterState>()
    return { limiters }
  })

  /**
   * Create a new concurrency limiter
   */
  export function create(name: string, maxConcurrency: number): void {
    if (state().limiters.has(name)) {
      log.warn("concurrency limiter already exists", { name })
      return
    }

    state().limiters.set(name, {
      active: 0,
      maxConcurrency,
      waitingRequests: [],
    })

    log.info("created concurrency limiter", {
      name,
      maxConcurrency,
    })
  }

  /**
   * Acquire a slot (async, waits if max concurrency reached)
   */
  export async function acquire(name: string, timeoutMs: number = 30000): Promise<() => void> {
    const limiter = state().limiters.get(name)
    if (!limiter) {
      throw new Error(`Concurrency limiter not found: ${name}`)
    }

    // Check if we can proceed
    if (limiter.active < limiter.maxConcurrency) {
      limiter.active++
      return () => release(name)
    }

    // Wait for a slot
    log.debug("waiting for concurrency slot", {
      name,
      active: limiter.active,
      max: limiter.maxConcurrency,
    })

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = limiter.waitingRequests.findIndex((r) => r.resolve === resolve)
        if (index !== -1) {
          limiter.waitingRequests.splice(index, 1)
        }
        reject(new Error(`Concurrency limiter timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      limiter.waitingRequests.push({
        resolve,
        reject,
        timeout,
      })
    })

    limiter.active++
    return () => release(name)
  }

  /**
   * Release a slot
   */
  function release(name: string): void {
    const limiter = state().limiters.get(name)
    if (!limiter) return

    limiter.active--

    // Process waiting requests
    if (limiter.waitingRequests.length > 0 && limiter.active < limiter.maxConcurrency) {
      const request = limiter.waitingRequests.shift()
      if (request) {
        clearTimeout(request.timeout)
        request.resolve()
      }
    }
  }

  /**
   * Get current state
   */
  export function getState(name: string): { active: number; max: number; waiting: number } | null {
    const limiter = state().limiters.get(name)
    if (!limiter) return null

    return {
      active: limiter.active,
      max: limiter.maxConcurrency,
      waiting: limiter.waitingRequests.length,
    }
  }
}
