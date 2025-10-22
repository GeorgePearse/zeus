/**
 * Strategy registration
 * Imports and registers all implemented strategies
 */

import { strategyRegistry } from "./strategy"

// Import strategy implementations
import { RE2Strategy } from "./implementations/re2"
import { CoTReflectionStrategy } from "./implementations/cot-reflection"
import { BONStrategy } from "./implementations/bon"
import { SelfConsistencyStrategy } from "./implementations/self-consistency"
import { MOAStrategy } from "./implementations/moa"

/**
 * Register all implemented strategies
 * Call this during initialization
 */
export function registerStrategies(): void {
	// Phase 2 strategies (implemented)
	strategyRegistry.register(new RE2Strategy())
	strategyRegistry.register(new CoTReflectionStrategy())
	strategyRegistry.register(new BONStrategy())
	strategyRegistry.register(new SelfConsistencyStrategy())
	strategyRegistry.register(new MOAStrategy())

	// TODO: Phase 3 strategies (to be implemented)
	// strategyRegistry.register(new MARSStrategy())
	// strategyRegistry.register(new CePOStrategy())
	// strategyRegistry.register(new PlanSearchStrategy())
	// strategyRegistry.register(new Z3Strategy())
	// strategyRegistry.register(new RStarStrategy())
	// strategyRegistry.register(new LEAPStrategy())
	// strategyRegistry.register(new RTOStrategy())
	// strategyRegistry.register(new MCTSStrategy())
	// strategyRegistry.register(new PVGStrategy())
	// strategyRegistry.register(new DeepConfidenceStrategy())
	// strategyRegistry.register(new CoTDecodingStrategy())
	// strategyRegistry.register(new EntropyDecodingStrategy())
	// strategyRegistry.register(new ThinkDeeperStrategy())
	// strategyRegistry.register(new AutoThinkStrategy())
}
