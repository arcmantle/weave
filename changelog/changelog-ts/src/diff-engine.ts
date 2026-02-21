import type { DiffRecord } from './types.js';

/**
 * Check if a value is an object (but not null or array)
 */
const isObject = (value: any): boolean => {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
};

/**
 * Normalize property key for comparison (handles symbols)
 */
const normalizeKey = (key: PropertyKey): string => {
	return typeof key === 'symbol' ? key.toString() : String(key);
};

/**
 * Default equality comparison using Object.is
 */
const defaultEqual = (a: any, b: any): boolean => {
	return Object.is(a, b);
};

/**
 * Options for diff computation
 */
export interface DiffOptions {
	/** Custom equality function */
	compare?: (a: any, b: any, path: string[]) => boolean;
}

/**
 * Recursively compute differences between two values
 * Handles nested objects and arrays at any depth
 */
const diffValues = (
	a: any,
	b: any,
	path: string[],
	out: DiffRecord[],
	options: DiffOptions,
	seen: WeakMap<object, object>,
): void => {
	const equal = options.compare ?? defaultEqual;

	// If values are equal, no diff needed
	if (equal(a, b, path))
		return;

	// Handle objects recursively
	if (isObject(a) && isObject(b)) {
		// Check for circular references
		if (seen.get(a as object) === (b as object))
			return;

		seen.set(a as object, b as object);

		// Get all keys from both objects
		const aKeyMap: Map<string, PropertyKey> = new Map();
		for (const k of Reflect.ownKeys(a))
			aKeyMap.set(normalizeKey(k), k);

		const bKeyMap: Map<string, PropertyKey> = new Map();
		for (const k of Reflect.ownKeys(b))
			bKeyMap.set(normalizeKey(k), k);

		const aKeys = new Set(aKeyMap.keys());
		const bKeys = new Set(bKeyMap.keys());

		// Find removed and changed keys
		for (const nk of aKeys) {
			const nextPath = [ ...path, nk ];
			if (!bKeys.has(nk)) {
				// Key was removed
				out.push({
					path:     nextPath,
					kind:     'removed',
					oldValue: (a as any)[aKeyMap.get(nk)!],
				});
			}
			else {
				// Key exists in both, check for changes
				diffValues(
					(a as any)[aKeyMap.get(nk)!],
					(b as any)[bKeyMap.get(nk)!],
					nextPath,
					out,
					options,
					seen,
				);
			}
		}

		// Find added keys
		for (const nk of bKeys) {
			if (!aKeys.has(nk)) {
				out.push({
					path:     [ ...path, nk ],
					kind:     'added',
					newValue: (b as any)[bKeyMap.get(nk)!],
				});
			}
		}

		return;
	}

	// Handle arrays
	if (Array.isArray(a) && Array.isArray(b)) {
		// Check for circular references
		if (seen.get(a) === b)
			return;

		seen.set(a, b);

		const maxLen = Math.max(a.length, b.length);
		for (let i = 0; i < maxLen; i++) {
			const nextPath = [ ...path, String(i) ];
			if (i >= a.length) {
				// Element was added
				out.push({
					path:     nextPath,
					kind:     'added',
					newValue: b[i],
				});
			}
			else if (i >= b.length) {
				// Element was removed
				out.push({
					path:     nextPath,
					kind:     'removed',
					oldValue: a[i],
				});
			}
			else {
				// Check for changes
				diffValues(a[i], b[i], nextPath, out, options, seen);
			}
		}

		return;
	}

	// Values are different primitives or incompatible types
	out.push({
		path:     path.slice(),
		kind:     'changed',
		oldValue: a,
		newValue: b,
	});
};

/**
 * Compute the diff between two values
 * Returns an array of DiffRecord describing all differences
 *
 * @param oldValue - The previous value
 * @param newValue - The new value
 * @param options - Optional diff options
 * @returns Array of diff records
 */
export const diff = (
	oldValue: any,
	newValue: any,
	options: DiffOptions = {},
): DiffRecord[] => {
	const out: DiffRecord[] = [];
	const seen: WeakMap<object, object> = new WeakMap();
	diffValues(oldValue, newValue, [], out, options, seen);

	return out;
};

/**
 * Apply a diff to a value, producing a new value
 * Note: This creates a deep clone and applies changes
 *
 * @param value - The value to apply the diff to
 * @param diffs - Array of diff records to apply
 * @returns New value with diffs applied
 */
export const applyDiff = (value: any, diffs: DiffRecord[]): any => {
	// Deep clone the value
	const result = structuredClone(value);

	// Collect array removals for optimized processing
	const arrayRemovals: Map<any, number[]> = new Map();

	for (const diff of diffs) {
		const { path, kind } = diff;

		if (path.length === 0) {
			// Root level change
			if (kind === 'changed' || kind === 'added')
				return diff.newValue;
			else if (kind === 'removed')
				return undefined;

			continue;
		}

		// Navigate to the parent of the target path
		let current = result;
		for (let i = 0; i < path.length - 1; i++) {
			const key = path[i]!;
			if (current[key] === undefined) {
				// Create intermediate objects/arrays as needed
				const nextKey = path[i + 1]!;
				current[key] = /^\d+$/.test(nextKey) ? [] : {};
			}

			current = current[key];
		}

		const lastKey = path[path.length - 1]!;

		switch (kind) {
		case 'added':
		case 'changed':
			current[lastKey] = diff.newValue;
			break;
		case 'removed':
			if (Array.isArray(current)) {
				// Collect for batch removal
				if (!arrayRemovals.has(current))
					arrayRemovals.set(current, []);

				arrayRemovals.get(current)!.push(Number(lastKey));
			}
			else {
				delete current[lastKey];
			}

			break;
		}
	}

	// Remove array elements in reverse order to maintain indices
	for (const [ arr, indices ] of arrayRemovals) {
		const sorted = indices.sort((a, b) => b - a); // Descending order
		for (const idx of sorted)
			arr.splice(idx, 1);
	}

	return result;
};
