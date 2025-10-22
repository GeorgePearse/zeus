import { Session } from "../session"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { CoordinatorTypes } from "./types"
import { SessionLock } from "../session/lock"

/**
 * Session Pool Manager
 *
 * Manages a pool of agent sessions for parallel task execution.
 * Sessions are pre-spawned and reused to minimize overhead.
 */
export namespace SessionPool {
  const log = Log.create({ service: "session-pool" })

  const state = Instance.state(() => {
    const pool = new Map<string, CoordinatorTypes.PooledSession>()
    const config: CoordinatorTypes.SessionPoolConfig = {
      minSize: 5,
      maxSize: 100,
      idleTimeout: 300000, // 5 minutes
      preSpawn: true,
    }

    return {
      pool,
      config,
      initialized: false,
    }
  })

  /**
   * Initialize the session pool
   */
  export async function initialize(customConfig?: Partial<CoordinatorTypes.SessionPoolConfig>) {
    if (state().initialized) {
      log.info("pool already initialized")
      return
    }

    if (customConfig) {
      Object.assign(state().config, customConfig)
    }

    const cfg = state().config
    log.info("initializing pool", {
      minSize: cfg.minSize,
      maxSize: cfg.maxSize,
      preSpawn: cfg.preSpawn,
    })

    // Pre-spawn minimum sessions if configured
    if (cfg.preSpawn && cfg.minSize > 0) {
      const promises = []
      for (let i = 0; i < cfg.minSize; i++) {
        promises.push(createPooledSession())
      }
      await Promise.all(promises)
      log.info("pre-spawned sessions", { count: cfg.minSize })
    }

    state().initialized = true

    // Start cleanup interval
    startCleanupInterval()
  }

  /**
   * Get an available session from the pool (or create one)
   */
  export async function acquire(parentSessionID: string): Promise<string> {
    // Find an idle session
    for (const [sessionID, pooled] of state().pool.entries()) {
      if (pooled.status === "idle" && !SessionLock.isLocked(sessionID)) {
        // Mark as busy
        pooled.status = "busy"
        pooled.lastUsed = Date.now()
        log.info("acquired existing session", { sessionID, tasksExecuted: pooled.tasksExecuted })
        return sessionID
      }
    }

    // No idle session available, create a new one
    if (state().pool.size >= state().config.maxSize) {
      // Pool is full, wait for a session to become available
      log.warn("pool is full, waiting for available session", {
        poolSize: state().pool.size,
        maxSize: state().config.maxSize,
      })
      // In a real implementation, this should use a queue/semaphore
      // For now, just create one anyway (will be cleaned up later)
    }

    const pooled = await createPooledSession(parentSessionID)
    pooled.status = "busy"
    log.info("acquired new session", { sessionID: pooled.session.id })
    return pooled.session.id
  }

  /**
   * Release a session back to the pool
   */
  export function release(sessionID: string, success: boolean = true) {
    const pooled = state().pool.get(sessionID)
    if (!pooled) {
      log.warn("attempted to release unknown session", { sessionID })
      return
    }

    if (success) {
      pooled.status = "idle"
      pooled.tasksExecuted++
      pooled.lastUsed = Date.now()
      log.info("released session", { sessionID, tasksExecuted: pooled.tasksExecuted })
    } else {
      pooled.status = "failed"
      log.warn("session failed, removing from pool", { sessionID })
      // Remove failed sessions
      state().pool.delete(sessionID)
      // Clean up the session
      Session.remove(sessionID).catch((err) => {
        log.error("failed to remove failed session", { sessionID, error: err })
      })
    }
  }

  /**
   * Get pool statistics
   */
  export function getStats() {
    const pool = state().pool
    const stats = {
      total: pool.size,
      idle: 0,
      busy: 0,
      failed: 0,
      maxSize: state().config.maxSize,
    }

    for (const pooled of pool.values()) {
      if (pooled.status === "idle") stats.idle++
      else if (pooled.status === "busy") stats.busy++
      else if (pooled.status === "failed") stats.failed++
    }

    return stats
  }

  /**
   * Shutdown the pool and clean up all sessions
   */
  export async function shutdown() {
    log.info("shutting down session pool", { poolSize: state().pool.size })

    const promises = []
    for (const [sessionID, pooled] of state().pool.entries()) {
      promises.push(
        Session.remove(sessionID).catch((err) => {
          log.error("failed to remove session during shutdown", { sessionID, error: err })
        })
      )
    }

    await Promise.all(promises)
    state().pool.clear()
    state().initialized = false
    log.info("session pool shut down")
  }

  /**
   * Create a new pooled session
   */
  async function createPooledSession(parentID?: string): Promise<CoordinatorTypes.PooledSession> {
    const session = await Session.create({
      parentID,
      title: `Agent Pool Session - ${new Date().toISOString()}`,
    })

    const pooled: CoordinatorTypes.PooledSession = {
      session: {
        id: session.id,
        parentID: session.parentID,
        title: session.title,
      },
      created: Date.now(),
      lastUsed: Date.now(),
      status: "idle",
      tasksExecuted: 0,
    }

    state().pool.set(session.id, pooled)
    log.info("created pooled session", { sessionID: session.id })
    return pooled
  }

  /**
   * Cleanup idle sessions periodically
   */
  function startCleanupInterval() {
    const interval = setInterval(() => {
      const now = Date.now()
      const idleTimeout = state().config.idleTimeout
      const toRemove: string[] = []

      for (const [sessionID, pooled] of state().pool.entries()) {
        // Remove idle sessions that haven't been used recently
        if (
          pooled.status === "idle" &&
          now - pooled.lastUsed > idleTimeout &&
          state().pool.size > state().config.minSize
        ) {
          toRemove.push(sessionID)
        }
      }

      if (toRemove.length > 0) {
        log.info("cleaning up idle sessions", { count: toRemove.length })
        for (const sessionID of toRemove) {
          state().pool.delete(sessionID)
          Session.remove(sessionID).catch((err) => {
            log.error("failed to remove idle session", { sessionID, error: err })
          })
        }
      }
    }, 60000) // Run every minute

    // Clean up interval on instance shutdown
    Instance.state(() => {
      return {
        cleanup: () => {
          clearInterval(interval)
        },
      }
    })
  }
}
