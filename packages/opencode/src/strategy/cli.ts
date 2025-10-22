/**
 * CLI integration utilities for strategies
 * Extracts strategy configuration from command-line arguments
 */

import type { StrategyChainConfig, StrategyFlags, StrategyName } from "./types"
import { parseStrategyChain } from "./chain"

/**
 * Map of CLI flag names to strategy names
 */
const FLAG_TO_STRATEGY: Record<string, StrategyName> = {
	mars: "mars",
	cepo: "cepo",
	"cot-reflection": "cot-reflection",
	"cotReflection": "cot-reflection",
	plansearch: "plansearch",
	re2: "re2",
	"self-consistency": "self-consistency",
	"selfConsistency": "self-consistency",
	z3: "z3",
	rstar: "rstar",
	leap: "leap",
	rto: "rto",
	bon: "bon",
	moa: "moa",
	mcts: "mcts",
	pvg: "pvg",
	"deep-confidence": "deep-confidence",
	"deepConfidence": "deep-confidence",
	"cot-decoding": "cot-decoding",
	"cotDecoding": "cot-decoding",
	"entropy-decoding": "entropy-decoding",
	"entropyDecoding": "entropy-decoding",
	"think-deeper": "think-deeper",
	"thinkDeeper": "think-deeper",
	"auto-think": "auto-think",
	"autoThink": "auto-think",
	// Aliases
	reasoning: "cot-reflection",
	ultrathink: "think-deeper",
}

/**
 * Extract strategy configuration from CLI arguments
 */
export function extractStrategyConfig(args: any): StrategyChainConfig | null {
	// Check for explicit strategy chain
	if (args.strategyChain || args["strategy-chain"]) {
		const chainString = (args.strategyChain || args["strategy-chain"]) as string
		return parseStrategyChain(chainString)
	}

	// Collect active strategy flags
	const activeStrategies: StrategyName[] = []

	for (const [flagName, strategyName] of Object.entries(FLAG_TO_STRATEGY)) {
		// Check both kebab-case and camelCase versions
		if (args[flagName] === true) {
			// Avoid duplicates (aliases can map to same strategy)
			if (!activeStrategies.includes(strategyName)) {
				activeStrategies.push(strategyName)
			}
		}
	}

	// No strategies active
	if (activeStrategies.length === 0) {
		return null
	}

	// Return sequential chain config
	return {
		strategies: activeStrategies,
		parallel: false,
		stopOnError: false,
	}
}

/**
 * Check if any strategy flags are active
 */
export function hasStrategyFlags(args: any): boolean {
	if (args.strategyChain || args["strategy-chain"]) {
		return true
	}

	for (const flagName of Object.keys(FLAG_TO_STRATEGY)) {
		if (args[flagName] === true) {
			return true
		}
	}

	return false
}

/**
 * Get a human-readable list of active strategies from args
 */
export function describeActiveStrategies(args: any): string {
	const config = extractStrategyConfig(args)
	if (!config) {
		return "No strategies active"
	}

	return config.strategies.join(", ")
}
