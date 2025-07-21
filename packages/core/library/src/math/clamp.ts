/**
 * Clamps a numeric value within a specified range.
 *
 * Ensures that the given value falls between the minimum and maximum bounds.
 * If the value is less than the minimum, returns the minimum.
 * If the value is greater than the maximum, returns the maximum.
 * Otherwise, returns the original value unchanged.
 *
 * @param min - The minimum allowed value (inclusive)
 * @param value - The value to clamp
 * @param max - The maximum allowed value (inclusive)
 * @returns The clamped value within the range [min, max]
 *
 * @example
 * ```typescript
 * minmax(0, -5, 10);  // Returns 0
 * minmax(0, 5, 10);   // Returns 5
 * minmax(0, 15, 10);  // Returns 10
 * ```
 */
export const clamp = (min: number, value: number, max: number): number => {
	if (value < min)
		return min;
	else if (value > max)
		return max;
	else
		return value;
};
