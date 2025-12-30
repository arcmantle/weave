import { getSymbolId } from './symbol-id.ts';


// Pre-allocated array to minimize allocations
const propertyPath: string[] = [];

// Fast path length tracking to avoid .length lookups
let pathLength = 0;


// Inline property key normalization for maximum speed
const normalizeKey = (prop: PropertyKey): string =>
	typeof prop === 'symbol' ? getSymbolId(prop) : (prop as string);


// Highly optimized proxy with minimal overhead
const proxy: any = new Proxy({} as any, {
	get: (_: any, prop: PropertyKey) => {
		// Direct assignment instead of push for speed
		propertyPath[pathLength++] = normalizeKey(prop);

		return proxy;
	},
});


export type Nameof<T> = (m: T extends object ? T : any) => any;


/**
 * Returns the dot-separated property path captured from the selector expression.
 */
export const nameof = <const T>(expression: (instance: T) => any): string => {
	pathLength = 0;
	expression(proxy);

	// Fast path for single property (most common case)
	if (pathLength === 1)
		return propertyPath[0]!;

	// Fast path for 2-3 properties (very common)
	if (pathLength === 2)
		return propertyPath[0]! + '.' + propertyPath[1]!;
	if (pathLength === 3)
		return propertyPath[0]! + '.' + propertyPath[1]! + '.' + propertyPath[2]!;

	// General case: manual join for better performance than Array.join
	let result = propertyPath[0]!;
	for (let i = 1; i < pathLength; i++)
		result += '.' + propertyPath[i]!;

	return result;
};

/**
 * Returns a fresh array of path segments captured from the selector expression.
 * The returned array is a new copy to avoid external mutations affecting internals.
 */
export const nameofSegments = <const T>(expression: (instance: T) => any): string[] => {
	pathLength = 0;
	expression(proxy);

	// Fast paths for common cases
	if (pathLength === 1)
		return [ propertyPath[0]! ];

	if (pathLength === 2)
		return [ propertyPath[0]!, propertyPath[1]! ];

	if (pathLength === 3)
		return [ propertyPath[0]!, propertyPath[1]!, propertyPath[2]! ];

	// General case: manual copy for better performance
	const result = new Array(pathLength);
	for (let i = 0; i < pathLength; i++)
		result[i] = propertyPath[i]!;


	return result;
};
