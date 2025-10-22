/**
 * RE2 (ReRead) Strategy Implementation
 * Processes queries twice to enhance understanding and reasoning quality
 */

import type { Strategy, StrategyContext, StrategyResult } from "../types"
import { STRATEGY_METADATA } from "../strategy"

export class RE2Strategy implements Strategy {
	metadata = STRATEGY_METADATA["re2"]

	async execute(context: StrategyContext): Promise<StrategyResult> {
		const startTime = Date.now()

		// RE2 works by modifying the system prompt to instruct the model
		// to read the query twice before responding

		const re2Instruction = `
IMPORTANT: Before responding to this query, please:
1. Read through the entire query carefully to understand what is being asked
2. Re-read the query a second time to ensure you haven't missed any important details
3. Only then formulate your response

This two-pass reading approach helps ensure accuracy and completeness.
`

		// Prepend the RE2 instruction to the system prompt
		const modifiedSystemPrompt = context.systemPrompt ? `${re2Instruction}\n\n${context.systemPrompt}` : re2Instruction

		return {
			messages: context.messages,
			systemPrompt: modifiedSystemPrompt,
			temperature: context.temperature,
			topP: context.topP,
			maxTokens: context.maxTokens,
			strategyUsed: "re2",
			modifications: ["Added RE2 (ReRead) instruction to system prompt"],
			executionTimeMs: Date.now() - startTime,
		}
	}

	canExecute(context: StrategyContext): boolean {
		// RE2 can work with any context
		return true
	}
}
