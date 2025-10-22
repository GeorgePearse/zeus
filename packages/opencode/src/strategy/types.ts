/**
 * Strategy types for OptiLLM strategy integration
 * Defines the core types for implementing and chaining LLM optimization strategies
 */

import type { LanguageModel } from "ai"
import type { CoreMessage } from "ai"

/**
 * All available strategy names
 */
export type StrategyName =
	// Proxy-compatible approaches
	| "mars" // Multi-agent reasoning with diverse exploration
	| "cepo" // Combined enhanced prompt optimization
	| "cot-reflection" // Chain of thought with reflection
	| "plansearch" // Search over candidate plans
	| "re2" // ReRead - process queries twice
	| "self-consistency" // Multiple reasoning paths
	| "z3" // Z3 theorem proving
	| "rstar" // R* algorithm
	| "leap" // Learn from few-shot examples
	| "rto" // Round trip optimization
	| "bon" // Best of N sampling
	| "moa" // Mixture of agents
	| "mcts" // Monte Carlo tree search
	| "pvg" // Prover-verifier game
	// Local inference only
	| "deep-confidence" // Confidence-guided reasoning
	| "cot-decoding" // CoT without explicit prompting
	| "entropy-decoding" // Adaptive sampling by uncertainty
	| "think-deeper" // Reasoning effort parameter
	| "auto-think" // Auto complexity classification

/**
 * Strategy metadata and configuration
 */
export interface StrategyMetadata {
	name: StrategyName
	displayName: string
	description: string
	aliases: string[]
	category: "reasoning" | "sampling" | "search" | "verification" | "optimization"
	requiresMultipleCalls: boolean // Does this strategy need multiple LLM calls?
	estimatedCostMultiplier: number // How much more expensive (1.0 = baseline)
	supportsStreaming: boolean // Can this strategy work with streaming responses?
}

/**
 * Context passed to strategies during execution
 */
export interface StrategyContext {
	// Original request
	messages: CoreMessage[]
	systemPrompt?: string
	model: LanguageModel

	// Configuration
	temperature?: number
	topP?: number
	maxTokens?: number

	// Runtime info
	sessionId?: string
	projectId?: string

	// For chaining
	previousStrategyResults?: StrategyResult[]
}

/**
 * Result returned by a strategy
 */
export interface StrategyResult {
	// Modified context for next strategy or final LLM call
	messages: CoreMessage[]
	systemPrompt?: string
	temperature?: number
	topP?: number
	maxTokens?: number

	// Metadata about what the strategy did
	strategyUsed: StrategyName
	modifications: string[] // List of modifications made
	intermediateOutputs?: unknown[] // Any intermediate results (for debugging)

	// Performance tracking
	executionTimeMs: number
	additionalCost?: number // Estimated additional cost in API calls
}

/**
 * Base interface all strategies must implement
 */
export interface Strategy {
	metadata: StrategyMetadata

	/**
	 * Execute the strategy on the given context
	 * Returns modified context for the next stage
	 */
	execute(context: StrategyContext): Promise<StrategyResult>

	/**
	 * Optional: validate if this strategy can run with the given context
	 */
	canExecute?(context: StrategyContext): boolean
}

/**
 * Configuration for strategy chaining
 */
export interface StrategyChainConfig {
	strategies: StrategyName[]
	stopOnError?: boolean // Stop chain if a strategy fails
	parallel?: boolean // Run strategies in parallel where possible
	maxExecutionTimeMs?: number // Timeout for entire chain
}

/**
 * Result of executing a strategy chain
 */
export interface StrategyChainResult {
	finalContext: StrategyContext
	results: StrategyResult[]
	totalExecutionTimeMs: number
	success: boolean
	error?: string
}

/**
 * CLI flag configuration for strategies
 */
export interface StrategyFlags {
	// Individual strategy flags
	mars?: boolean
	cepo?: boolean
	cotReflection?: boolean
	plansearch?: boolean
	re2?: boolean
	selfConsistency?: boolean
	z3?: boolean
	rstar?: boolean
	leap?: boolean
	rto?: boolean
	bon?: boolean
	moa?: boolean
	mcts?: boolean
	pvg?: boolean
	deepConfidence?: boolean
	cotDecoding?: boolean
	entropyDecoding?: boolean
	thinkDeeper?: boolean
	autoThink?: boolean

	// Aliases
	reasoning?: boolean // Alias for cotReflection
	ultrathink?: boolean // Alias for thinkDeeper

	// Chain configuration
	strategyChain?: string // Comma-separated list of strategies
}

/**
 * Options for individual strategies
 */
export interface StrategyOptions {
	// BON (Best of N) options
	bon?: {
		n: number // Number of samples to generate
		temperature: number // Sampling temperature
	}

	// MOA (Mixture of Agents) options
	moa?: {
		models: string[] // Models to use as agents
		aggregationMethod: "voting" | "ranking" | "consensus"
	}

	// Self-Consistency options
	selfConsistency?: {
		samples: number // Number of reasoning paths
		temperature: number
	}

	// MCTS options
	mcts?: {
		iterations: number // Number of tree search iterations
		explorationConstant: number
	}

	// Generic option overrides
	[key: string]: unknown
}
