/**
 * BON (Best of N) Strategy Implementation
 * Generates N responses and selects the best one based on quality metrics
 */

import type { Strategy, StrategyContext, StrategyResult } from "../types"
import { STRATEGY_METADATA } from "../strategy"
import { generateText } from "ai"

/**
 * Default configuration for BON
 */
const DEFAULT_N = 3
const DEFAULT_TEMPERATURE = 0.8

export class BONStrategy implements Strategy {
	metadata = STRATEGY_METADATA["bon"]

	async execute(context: StrategyContext): Promise<StrategyResult> {
		const startTime = Date.now()

		// Configuration
		const n = DEFAULT_N
		const temperature = DEFAULT_TEMPERATURE

		// Generate N responses in parallel
		const responses = await Promise.all(
			Array.from({ length: n }, async (_, i) => {
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
						index: i,
						usage: result.usage,
					}
				} catch (error) {
					console.warn(`BON sample ${i} failed:`, error)
					return null
				}
			}),
		)

		// Filter out failed responses
		const validResponses = responses.filter((r) => r !== null)

		if (validResponses.length === 0) {
			throw new Error("All BON samples failed to generate")
		}

		// Select best response (for now, use longest as proxy for quality)
		// TODO: Implement more sophisticated selection (model-based scoring, etc.)
		const bestResponse = validResponses.reduce((best, current) => {
			return current.text.length > best.text.length ? current : best
		})

		// Create a new message with the best response
		const assistantMessage = {
			role: "assistant" as const,
			content: bestResponse.text,
		}

		const modifications = [
			`Generated ${n} responses with temperature ${temperature}`,
			`Selected best response (sample ${bestResponse.index + 1}) based on length: ${bestResponse.text.length} chars`,
			`Valid responses: ${validResponses.length}/${n}`,
		]

		return {
			messages: [...context.messages, assistantMessage],
			systemPrompt: context.systemPrompt,
			temperature: context.temperature,
			topP: context.topP,
			maxTokens: context.maxTokens,
			strategyUsed: "bon",
			modifications,
			intermediateOutputs: validResponses.map((r) => ({
				index: r.index,
				length: r.text.length,
				preview: r.text.slice(0, 100),
			})),
			executionTimeMs: Date.now() - startTime,
			additionalCost: validResponses.length, // N API calls made
		}
	}

	canExecute(context: StrategyContext): boolean {
		// BON requires a model to be available
		return !!context.model
	}
}
