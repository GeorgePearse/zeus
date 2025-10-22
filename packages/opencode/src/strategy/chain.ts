/**
 * Strategy chain orchestrator
 * Executes multiple strategies in sequence or parallel
 */

import type {
	StrategyChainConfig,
	StrategyChainResult,
	StrategyContext,
	StrategyName,
	StrategyResult,
} from "./types"
import { strategyRegistry } from "./strategy"

/**
 * Execute a chain of strategies
 */
export async function executeStrategyChain(
	context: StrategyContext,
	config: StrategyChainConfig,
): Promise<StrategyChainResult> {
	const startTime = Date.now()
	const results: StrategyResult[] = []
	let currentContext = { ...context }
	let success = true
	let error: string | undefined

	try {
		if (config.parallel) {
			// Parallel execution - all strategies run on same initial context
			await executeStrategiesInParallel(context, config, results)
			// Use the last result's context
			if (results.length > 0) {
				const lastResult = results[results.length - 1]
				currentContext = {
					...currentContext,
					messages: lastResult.messages,
					systemPrompt: lastResult.systemPrompt,
					temperature: lastResult.temperature,
					topP: lastResult.topP,
					maxTokens: lastResult.maxTokens,
				}
			}
		} else {
			// Sequential execution - output of one feeds into next
			for (const strategyName of config.strategies) {
				try {
					const result = await executeStrategy(strategyName, currentContext, results)

					if (!result) {
						if (config.stopOnError) {
							throw new Error(`Strategy '${strategyName}' not found or failed to execute`)
						}
						continue
					}

					results.push(result)

					// Update context for next strategy
					currentContext = {
						...currentContext,
						messages: result.messages,
						systemPrompt: result.systemPrompt,
						temperature: result.temperature,
						topP: result.topP,
						maxTokens: result.maxTokens,
						previousStrategyResults: results,
					}

					// Check timeout
					if (config.maxExecutionTimeMs) {
						const elapsed = Date.now() - startTime
						if (elapsed > config.maxExecutionTimeMs) {
							throw new Error(`Strategy chain exceeded max execution time of ${config.maxExecutionTimeMs}ms`)
						}
					}
				} catch (err) {
					if (config.stopOnError) {
						throw err
					}
					console.warn(`Strategy '${strategyName}' failed:`, err)
				}
			}
		}
	} catch (err) {
		success = false
		error = err instanceof Error ? err.message : String(err)
	}

	const totalExecutionTimeMs = Date.now() - startTime

	return {
		finalContext: currentContext,
		results,
		totalExecutionTimeMs,
		success,
		error,
	}
}

/**
 * Execute strategies in parallel
 */
async function executeStrategiesInParallel(
	context: StrategyContext,
	config: StrategyChainConfig,
	results: StrategyResult[],
): Promise<void> {
	const promises = config.strategies.map((strategyName) => executeStrategy(strategyName, context, []))

	const parallelResults = await Promise.all(promises)

	// Add all successful results
	for (const result of parallelResults) {
		if (result) {
			results.push(result)
		}
	}
}

/**
 * Execute a single strategy
 */
async function executeStrategy(
	strategyName: StrategyName,
	context: StrategyContext,
	previousResults: StrategyResult[],
): Promise<StrategyResult | null> {
	const strategy = strategyRegistry.get(strategyName)

	if (!strategy) {
		console.warn(`Strategy '${strategyName}' not found in registry`)
		return null
	}

	// Check if strategy can execute
	if (strategy.canExecute && !strategy.canExecute(context)) {
		console.warn(`Strategy '${strategyName}' cannot execute with current context`)
		return null
	}

	// Execute strategy
	const contextWithHistory = {
		...context,
		previousStrategyResults: previousResults,
	}

	return await strategy.execute(contextWithHistory)
}

/**
 * Parse strategy chain string into config
 * Formats supported:
 * - "strategy1,strategy2,strategy3" - sequential
 * - "strategy1+strategy2+strategy3" - parallel
 * - "strategy1,strategy2+strategy3" - mixed (sequential then parallel)
 */
export function parseStrategyChain(chainString: string): StrategyChainConfig {
	const trimmed = chainString.trim()

	// Check for parallel indicator
	if (trimmed.includes("+")) {
		// All strategies in parallel
		const strategies = trimmed
			.split("+")
			.map((s) => s.trim())
			.filter((s) => s.length > 0) as StrategyName[]

		return {
			strategies,
			parallel: true,
			stopOnError: false,
		}
	}

	// Sequential execution
	const strategies = trimmed
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0) as StrategyName[]

	return {
		strategies,
		parallel: false,
		stopOnError: false,
	}
}

/**
 * Validate that all strategies in a chain exist
 */
export function validateStrategyChain(config: StrategyChainConfig): { valid: boolean; errors: string[] } {
	const errors: string[] = []

	for (const strategyName of config.strategies) {
		if (!strategyRegistry.has(strategyName)) {
			errors.push(`Unknown strategy: '${strategyName}'`)
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	}
}

/**
 * Get human-readable description of a strategy chain
 */
export function describeStrategyChain(config: StrategyChainConfig): string {
	if (config.strategies.length === 0) {
		return "No strategies"
	}

	const strategyNames = config.strategies
		.map((name) => {
			const metadata = strategyRegistry.getMetadata(name)
			return metadata?.displayName || name
		})
		.join(config.parallel ? " + " : " → ")

	const mode = config.parallel ? "parallel" : "sequential"
	return `${strategyNames} (${mode})`
}
