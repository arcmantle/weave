import type { ViewConstraints, ViewState } from '../types.ts';


/**
 * Clamp a value between min and max bounds
 */
export function clamp(min: number, value: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Calculate delta constraints for a resize operation
 */
export function calculateDeltaConstraints(
	sashIndex: number,
	viewStates: ViewState[],
	constraints: ViewConstraints[],
): { minDelta: number; maxDelta: number; } {
	// Views that will grow (before the sash)
	const upViews = viewStates.slice(0, sashIndex + 1);
	const upConstraints = constraints.slice(0, sashIndex + 1);

	// Views that will shrink (after the sash)
	const downViews = viewStates.slice(sashIndex + 1);
	const downConstraints = constraints.slice(sashIndex + 1);

	// Calculate how much we can grow up views (limited by their max sizes)
	const maxGrowUp = upViews.reduce((total, view, i) =>
		total + (upConstraints[i]!.maximumSize - view.size), 0);

	// Calculate how much we can shrink up views (limited by their min sizes)
	const maxShrinkUp = upViews.reduce((total, view, i) =>
		total + (view.size - upConstraints[i]!.minimumSize), 0);

	// Calculate how much we can grow down views
	const maxGrowDown = downViews.length === 0 ? Number.POSITIVE_INFINITY :
		downViews.reduce((total, view, i) =>
			total + (downConstraints[i]!.maximumSize - view.size), 0);

	// Calculate how much we can shrink down views
	const maxShrinkDown = downViews.length === 0 ? Number.POSITIVE_INFINITY :
		downViews.reduce((total, view, i) =>
			total + (view.size - downConstraints[i]!.minimumSize), 0);

	// The delta is constrained by both directions
	const minDelta = Math.max(-maxShrinkUp, -maxGrowDown);
	const maxDelta = Math.min(maxGrowUp, maxShrinkDown);

	return { minDelta, maxDelta };
}

/**
 * Apply resize delta to views, respecting constraints
 */
export function resize(
	sashIndex: number,
	delta: number,
	viewStates: ViewState[],
	constraints: ViewConstraints[],
	overloadMinDelta: number = Number.NEGATIVE_INFINITY,
	overloadMaxDelta: number = Number.POSITIVE_INFINITY,
): number {
	if (sashIndex < 0 || sashIndex >= viewStates.length)
		return 0;

	// Get constraint boundaries
	const { minDelta, maxDelta } = calculateDeltaConstraints(sashIndex, viewStates, constraints);

	// Apply overload constraints
	const finalMinDelta = Math.max(minDelta, overloadMinDelta);
	const finalMaxDelta = Math.min(maxDelta, overloadMaxDelta);

	// Clamp the delta to valid range
	const clampedDelta = clamp(finalMinDelta, delta, finalMaxDelta);

	// Create index ranges
	const upIndexes = [];
	for (let i = sashIndex; i >= 0; i--)
		upIndexes.push(i);


	const downIndexes = [];
	for (let i = sashIndex + 1; i < viewStates.length; i++)
		downIndexes.push(i);


	// Apply changes to up views (growing/shrinking)
	let remainingDelta = clampedDelta;

	for (const i of upIndexes) {
		if (remainingDelta === 0)
			break;

		const view = viewStates[i]!;
		const constraint = constraints[i]!;

		const newSize = clamp(
			constraint.minimumSize,
			view.size + remainingDelta,
			constraint.maximumSize,
		);

		const actualDelta = newSize - view.size;
		view.size = newSize;
		remainingDelta -= actualDelta;
	}

	// Apply opposite changes to down views
	remainingDelta = clampedDelta;

	for (const i of downIndexes) {
		if (remainingDelta === 0)
			break;

		const view = viewStates[i]!;
		const constraint = constraints[i]!;

		const newSize = clamp(
			constraint.minimumSize,
			view.size - remainingDelta,
			constraint.maximumSize,
		);

		const actualDelta = view.size - newSize;
		view.size = newSize;
		remainingDelta -= actualDelta;
	}

	return clampedDelta;
}

/**
 * Distribute empty space among views
 */
export function distributeEmptySpace(
	emptySpace: number,
	viewStates: ViewState[],
	constraints: ViewConstraints[],
): void {
	let remainingSpace = emptySpace;

	// Distribute space evenly among all views
	for (let i = 0; i < viewStates.length; i++) {
		if (remainingSpace === 0)
			break;

		const view = viewStates[i]!;
		const constraint = constraints[i]!;

		const newSize = clamp(
			constraint.minimumSize,
			view.size + remainingSpace,
			constraint.maximumSize,
		);

		const actualChange = newSize - view.size;
		view.size = newSize;
		remainingSpace -= actualChange;
	}
}

/**
 * Save proportions for later restoration
 */
export function saveProportions(viewStates: ViewState[]): number[] {
	const totalSize = viewStates.reduce((sum, view) => sum + view.size, 0);

	return viewStates.map(view => totalSize > 0 ? view.size / totalSize : 0);
}


/**
 * Check if views are distributed evenly (for auto sizing)
 */
export function areViewsDistributed(viewStates: ViewState[], tolerance = 2): boolean {
	let min: number | undefined;
	let max: number | undefined;

	for (const view of viewStates) {
		if (!view.visible)
			continue;

		min = min === undefined ? view.size : Math.min(min, view.size);
		max = max === undefined ? view.size : Math.max(max, view.size);

		if (max - min > tolerance)
			return false;
	}

	return true;
}
