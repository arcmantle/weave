/**
 * Type guard function that checks if a value is not undefined.
 * Narrows the type to exclude undefined from the union type.
 */
export const exists = <T>(value: T): value is T & Record<never, never> =>
	value !== undefined;
