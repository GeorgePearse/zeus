/**
 * MOA (Mixture of Agents) Strategy Implementation
 * Combine responses from multiple model critiques for improved output
 *
 * Note: This is a simplified version that uses the same model with different
 * temperatures. A full implementation would use different models as "agents".
 */

import type { Strategy, StrategyContext, StrategyResult } from "../types"
import { STRATEGY_METADATA } from "../strategy"
import { generateText } from "ai"

/**
 * Default configuration
 */
const DEFAULT_AGENTS = 3
const TEMPERATURES = [0.3, 0.7, 1.0] // Different temperatures for diversity

export class MOAStrategy implements Strategy {
	metadata = STRATEGY_METADATA["moa"]

	async execute(context: StrategyContext): Promise<StrategyResult> {
		const startTime = Date.now()

		const numAgents = DEFAULT_AGENTS

		// Phase 1: Generate initial responses from each "agent"
		const initialResponses = await Promise.all(
			Array.from({ length: numAgents }, async (_, i) => {
				const temperature = TEMPERATURES[i % TEMPERATURES.length]

				try {
					const result = await generateText({
						model: context.model,
						messages: context.messages,
						system: context.systemPrompt,
						temperature,
						topP: context.topP,
						maxOutputTokens: context.maxTokens,
					})

					return {
						text: result.text,
						agentId: i,
						temperature,
					}
				} catch (error) {
					console.warn(`MOA agent ${i} failed:`, error)
					return null
				}
			}),
		)

		const validInitialResponses = initialResponses.filter((r) => r !== null)

		if (validInitialResponses.length === 0) {
			throw new Error("All MOA agents failed to generate initial responses")
		}

		// Phase 2: Aggregate responses
		// Create a critique/synthesis prompt
		const aggregationPrompt = `You are an expert aggregator. Below are ${validInitialResponses.length} different responses to the same query.
Your task is to synthesize these responses into a single, high-quality answer that combines the best insights from each.

${validInitialResponses.map((r, i) => `Response ${i + 1} (temp=${r.temperature}):\n${r.text}\n`).join("\n---\n\n")}

Synthesize these responses into a single, comprehensive answer that:
1. Incorporates the strongest points from each response
2. Resolves any contradictions
3. Provides the most accurate and complete answer possible`

		// Generate final aggregated response
		const aggregationResult = await generateText({
			model: context.model,
			messages: [
				{
					role: "user",
					content: aggregationPrompt,
				},
			],
			temperature: 0.5, // Moderate temperature for aggregation
			topP: context.topP,
			maxOutputTokens: context.maxTokens,
		})

		const assistantMessage = {
			role: "assistant" as const,
			content: aggregationResult.text,
		}

		return {
			messages: [...context.messages, assistantMessage],
			systemPrompt: context.systemPrompt,
			temperature: context.temperature,
			topP: context.topP,
			maxTokens: context.maxTokens,
			strategyUsed: "moa",
			modifications: [
				`Generated ${numAgents} agent responses with varying temperatures`,
				`Aggregated ${validInitialResponses.length} responses`,
				`Temperatures used: ${validInitialResponses.map((r) => r.temperature).join(", ")}`,
			],
			intermediateOutputs: validInitialResponses.map((r) => ({
				agentId: r.agentId,
				temperature: r.temperature,
				preview: r.text.slice(0, 150),
			})),
			executionTimeMs: Date.now() - startTime,
			additionalCost: validInitialResponses.length + 1, // N agents + 1 aggregation
		}
	}

	canExecute(context: StrategyContext): boolean {
		return !!context.model
	}
}
