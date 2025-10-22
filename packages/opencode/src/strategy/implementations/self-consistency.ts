/**
 * Self-Consistency Strategy Implementation
 * Generate multiple reasoning paths and select the most consistent answer
 */

import type { Strategy, StrategyContext, StrategyResult } from "../types"
import { STRATEGY_METADATA } from "../strategy"
import { generateText } from "ai"

/**
 * Default configuration
 */
const DEFAULT_SAMPLES = 5
const DEFAULT_TEMPERATURE = 0.7

export class SelfConsistencyStrategy implements Strategy {
	metadata = STRATEGY_METADATA["self-consistency"]

	async execute(context: StrategyContext): Promise<StrategyResult> {
		const startTime = Date.now()

		const samples = DEFAULT_SAMPLES
		const temperature = DEFAULT_TEMPERATURE

		// Add CoT instruction to encourage diverse reasoning paths
		const cotSystemPrompt = `${context.systemPrompt || ""}

IMPORTANT: Think through this problem step-by-step, showing your reasoning process clearly before giving your final answer.`

		// Generate multiple reasoning paths in parallel
		const responses = await Promise.all(
			Array.from({ length: samples }, async (_, i) => {
				try {
					const result = await generateText({
						model: context.model,
						messages: context.messages,
						system: cotSystemPrompt,
						temperature, // Higher temperature for diversity
						topP: context.topP,
						maxOutputTokens: context.maxTokens,
					})

					return {
						text: result.text,
						index: i,
					}
				} catch (error) {
					console.warn(`Self-consistency sample ${i} failed:`, error)
					return null
				}
			}),
		)

		const validResponses = responses.filter((r) => r !== null)

		if (validResponses.length === 0) {
			throw new Error("All self-consistency samples failed")
		}

		// Find the most common answer/conclusion
		// For now, use a simple heuristic: longest common substring
		// TODO: Implement proper answer extraction and voting
		const selectedResponse = this.selectMostConsistent(validResponses)

		const assistantMessage = {
			role: "assistant" as const,
			content: selectedResponse.text,
		}

		return {
			messages: [...context.messages, assistantMessage],
			systemPrompt: context.systemPrompt,
			temperature: context.temperature,
			topP: context.topP,
			maxTokens: context.maxTokens,
			strategyUsed: "self-consistency",
			modifications: [
				`Generated ${samples} reasoning paths with temperature ${temperature}`,
				`Selected most consistent answer (sample ${selectedResponse.index + 1})`,
				`Valid samples: ${validResponses.length}/${samples}`,
			],
			intermediateOutputs: validResponses.map((r) => ({
				index: r.index,
				preview: r.text.slice(0, 150),
			})),
			executionTimeMs: Date.now() - startTime,
			additionalCost: validResponses.length,
		}
	}

	/**
	 * Select the most consistent response
	 * Simple heuristic: choose the response that has most similarity to others
	 */
	private selectMostConsistent(responses: Array<{ text: string; index: number }>): { text: string; index: number } {
		if (responses.length === 1) return responses[0]

		// Calculate similarity scores (simple: based on answer length similarity)
		// In production, this should use proper answer extraction and semantic similarity
		const avgLength = responses.reduce((sum, r) => sum + r.text.length, 0) / responses.length

		const scored = responses.map((r) => ({
			...r,
			score: 1 - Math.abs(r.text.length - avgLength) / avgLength,
		}))

		// Return response closest to average length (proxy for consensus)
		return scored.reduce((best, current) => (current.score > best.score ? current : best))
	}

	canExecute(context: StrategyContext): boolean {
		return !!context.model
	}
}
