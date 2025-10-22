/**
 * CoT-Reflection Strategy Implementation
 * Chain of Thought with structured thinking, reflection, and output sections
 */

import type { Strategy, StrategyContext, StrategyResult } from "../types"
import { STRATEGY_METADATA } from "../strategy"

export class CoTReflectionStrategy implements Strategy {
	metadata = STRATEGY_METADATA["cot-reflection"]

	async execute(context: StrategyContext): Promise<StrategyResult> {
		const startTime = Date.now()

		// CoT-Reflection adds structured thinking sections to guide the model
		const cotInstruction = `
When responding, please structure your answer in the following sections:

<thinking>
Work through the problem step-by-step. Show your reasoning process, consider different approaches, and explain your thought process as you work toward a solution.
</thinking>

<reflection>
Review your thinking. Are there any flaws in your reasoning? Did you consider edge cases? Are there better approaches? Reflect critically on your solution.
</reflection>

<output>
Provide your final answer or solution based on your thinking and reflection.
</output>

Use these XML-style tags to clearly separate each section of your response.
`

		// Prepend the CoT instruction to the system prompt
		const modifiedSystemPrompt = context.systemPrompt ? `${cotInstruction}\n\n${context.systemPrompt}` : cotInstruction

		return {
			messages: context.messages,
			systemPrompt: modifiedSystemPrompt,
			temperature: context.temperature,
			topP: context.topP,
			maxTokens: context.maxTokens,
			strategyUsed: "cot-reflection",
			modifications: ["Added Chain of Thought with Reflection structured prompting"],
			executionTimeMs: Date.now() - startTime,
		}
	}

	canExecute(context: StrategyContext): boolean {
		// CoT-Reflection can work with any context
		return true
	}
}
