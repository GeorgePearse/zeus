/**
 * Strategy registry and metadata
 * Central registry for all available LLM optimization strategies
 */

import type { Strategy, StrategyMetadata, StrategyName } from "./types"

/**
 * Metadata for all available strategies
 */
export const STRATEGY_METADATA: Record<StrategyName, StrategyMetadata> = {
	mars: {
		name: "mars",
		displayName: "MARS",
		description: "Multi-agent reasoning with diverse temperature exploration, cross-verification, and iterative improvement",
		aliases: [],
		category: "reasoning",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 3.0,
		supportsStreaming: false,
	},
	cepo: {
		name: "cepo",
		displayName: "CePO",
		description: "Combined Enhanced Prompt Optimization - integrates best-of-N, chain-of-thought, self-reflection, and self-improvement",
		aliases: [],
		category: "optimization",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 4.0,
		supportsStreaming: false,
	},
	"cot-reflection": {
		name: "cot-reflection",
		displayName: "CoT Reflection",
		description: "Chain of thought with structured thinking, reflection, and output sections",
		aliases: ["reasoning"],
		category: "reasoning",
		requiresMultipleCalls: false,
		estimatedCostMultiplier: 1.2,
		supportsStreaming: true,
	},
	plansearch: {
		name: "plansearch",
		displayName: "PlanSearch",
		description: "Search algorithm over candidate plans for solving a problem",
		aliases: [],
		category: "search",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 5.0,
		supportsStreaming: false,
	},
	re2: {
		name: "re2",
		displayName: "RE2 (ReRead)",
		description: "Process queries twice to enhance understanding and reasoning quality",
		aliases: ["reread"],
		category: "reasoning",
		requiresMultipleCalls: false,
		estimatedCostMultiplier: 1.5,
		supportsStreaming: true,
	},
	"self-consistency": {
		name: "self-consistency",
		displayName: "Self-Consistency",
		description: "Generate multiple reasoning paths and select the most consistent answer",
		aliases: [],
		category: "sampling",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 5.0,
		supportsStreaming: false,
	},
	z3: {
		name: "z3",
		displayName: "Z3 Solver",
		description: "Theorem proving for logical and mathematical problems",
		aliases: [],
		category: "verification",
		requiresMultipleCalls: false,
		estimatedCostMultiplier: 1.5,
		supportsStreaming: true,
	},
	rstar: {
		name: "rstar",
		displayName: "R* Algorithm",
		description: "Problem-solving approach based on R* methodology",
		aliases: [],
		category: "search",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 3.0,
		supportsStreaming: false,
	},
	leap: {
		name: "leap",
		displayName: "LEAP",
		description: "Learn task-specific principles from few-shot examples",
		aliases: [],
		category: "optimization",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 2.0,
		supportsStreaming: false,
	},
	rto: {
		name: "rto",
		displayName: "Round Trip Optimization",
		description: "Optimize through bidirectional processing",
		aliases: [],
		category: "optimization",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 2.0,
		supportsStreaming: false,
	},
	bon: {
		name: "bon",
		displayName: "Best of N",
		description: "Generate N responses and select the best one based on quality metrics",
		aliases: [],
		category: "sampling",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 3.0, // Default N=3
		supportsStreaming: false,
	},
	moa: {
		name: "moa",
		displayName: "Mixture of Agents",
		description: "Combine responses from multiple model critiques for improved output",
		aliases: [],
		category: "sampling",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 4.0,
		supportsStreaming: false,
	},
	mcts: {
		name: "mcts",
		displayName: "Monte Carlo Tree Search",
		description: "Tree-based decision making for chat responses",
		aliases: [],
		category: "search",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 10.0,
		supportsStreaming: false,
	},
	pvg: {
		name: "pvg",
		displayName: "Prover-Verifier Game",
		description: "Prover-verifier game approach at inference time",
		aliases: [],
		category: "verification",
		requiresMultipleCalls: true,
		estimatedCostMultiplier: 3.0,
		supportsStreaming: false,
	},
	"deep-confidence": {
		name: "deep-confidence",
		displayName: "Deep Confidence",
		description: "Confidence-guided reasoning with multiple intensity levels (local inference only)",
		aliases: [],
		category: "sampling",
		requiresMultipleCalls: false,
		estimatedCostMultiplier: 1.3,
		supportsStreaming: true,
	},
	"cot-decoding": {
		name: "cot-decoding",
		displayName: "CoT Decoding",
		description: "Elicit chain-of-thought reasoning without explicit prompting (local inference only)",
		aliases: [],
		category: "reasoning",
		requiresMultipleCalls: false,
		estimatedCostMultiplier: 1.2,
		supportsStreaming: true,
	},
	"entropy-decoding": {
		name: "entropy-decoding",
		displayName: "Entropy Decoding",
		description: "Adaptive sampling based on token uncertainty (local inference only)",
		aliases: [],
		category: "sampling",
		requiresMultipleCalls: false,
		estimatedCostMultiplier: 1.2,
		supportsStreaming: true,
	},
	"think-deeper": {
		name: "think-deeper",
		displayName: "ThinkDeeper",
		description: "Implements reasoning effort parameter for deeper thinking",
		aliases: ["ultrathink"],
		category: "reasoning",
		requiresMultipleCalls: false,
		estimatedCostMultiplier: 1.5,
		supportsStreaming: true,
	},
	"auto-think": {
		name: "auto-think",
		displayName: "AutoThink",
		description: "Query complexity classification with automatic steering vectors",
		aliases: [],
		category: "optimization",
		requiresMultipleCalls: false,
		estimatedCostMultiplier: 1.1,
		supportsStreaming: true,
	},
}

/**
 * Strategy registry - singleton pattern
 */
class StrategyRegistry {
	private strategies = new Map<StrategyName, Strategy>()
	private aliases = new Map<string, StrategyName>()

	constructor() {
		// Build alias map from metadata
		for (const [name, metadata] of Object.entries(STRATEGY_METADATA)) {
			for (const alias of metadata.aliases) {
				this.aliases.set(alias, name as StrategyName)
			}
		}
	}

	/**
	 * Register a strategy implementation
	 */
	register(strategy: Strategy): void {
		this.strategies.set(strategy.metadata.name, strategy)
	}

	/**
	 * Get a strategy by name or alias
	 */
	get(nameOrAlias: string): Strategy | undefined {
		// Try direct lookup
		const strategy = this.strategies.get(nameOrAlias as StrategyName)
		if (strategy) return strategy

		// Try alias lookup
		const canonicalName = this.aliases.get(nameOrAlias)
		if (canonicalName) {
			return this.strategies.get(canonicalName)
		}

		return undefined
	}

	/**
	 * Check if a strategy is registered
	 */
	has(nameOrAlias: string): boolean {
		return this.get(nameOrAlias) !== undefined
	}

	/**
	 * Get all registered strategies
	 */
	getAll(): Record<string, Strategy> {
		const result: Record<string, Strategy> = {}
		for (const [name, strategy] of this.strategies.entries()) {
			result[name] = strategy
		}
		return result
	}

	/**
	 * Get all registered strategy names
	 */
	getAllNames(): StrategyName[] {
		return Array.from(this.strategies.keys())
	}

	/**
	 * Get metadata for a strategy
	 */
	getMetadata(nameOrAlias: string): StrategyMetadata | undefined {
		const name = this.aliases.get(nameOrAlias) || nameOrAlias
		return STRATEGY_METADATA[name as StrategyName]
	}

	/**
	 * Get all metadata
	 */
	getAllMetadata(): StrategyMetadata[] {
		return Object.values(STRATEGY_METADATA)
	}
}

// Export singleton instance
export const strategyRegistry = new StrategyRegistry()

/**
 * Helper to resolve strategy names from CLI flags or aliases
 */
export function resolveStrategyName(nameOrAlias: string): StrategyName | undefined {
	const metadata = strategyRegistry.getMetadata(nameOrAlias)
	return metadata?.name
}

/**
 * Helper to get estimated total cost multiplier for a chain of strategies
 */
export function estimateChainCostMultiplier(strategies: StrategyName[]): number {
	let total = 1.0
	for (const strategyName of strategies) {
		const metadata = STRATEGY_METADATA[strategyName]
		if (metadata) {
			total *= metadata.estimatedCostMultiplier
		}
	}
	return total
}

/**
 * Helper to check if any strategy in a chain requires multiple calls
 */
export function chainRequiresMultipleCalls(strategies: StrategyName[]): boolean {
	return strategies.some((name) => STRATEGY_METADATA[name]?.requiresMultipleCalls)
}
