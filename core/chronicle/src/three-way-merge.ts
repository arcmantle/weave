import { pathKeyOf } from './path-key.ts';
import { diffValues, originalSnapshotCache } from './snapshot-diff.ts';
import type { ConflictResolutions, DiffRecord, MergeConflict, MergeResult } from './types.ts';


/**
 * Deep equality check for values (handles primitives, objects, arrays, etc.)
 */
const deepEquals = (a: any, b: any): boolean => {
	if (Object.is(a, b))
		return true;

	if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object')
		return false;

	const keysA = Object.keys(a);
	const keysB = Object.keys(b);

	if (keysA.length !== keysB.length)
		return false;

	for (const key of keysA) {
		if (!keysB.includes(key))
			return false;

		if (!deepEquals(a[key], b[key]))
			return false;
	}

	return true;
};

/**
 * Get a value from an object by path.
 */
const getByPath = (obj: any, path: string[]): any => {
	let current = obj;
	for (const key of path) {
		if (current == null || typeof current !== 'object')
			return undefined;

		current = current[key];
	}

	return current;
};

/**
 * Set a value in an object by path.
 */
const setByPath = (obj: any, path: string[], value: any): void => {
	if (path.length === 0)
		return;

	let current = obj;
	for (let i = 0; i < path.length - 1; i++) {
		const key = path[i]!;
		if (!(key in current) || typeof current[key] !== 'object')
			current[key] = {};

		current = current[key];
	}

	current[path[path.length - 1]!] = value;
};

/**
 * Delete a value in an object by path.
 */
const deleteByPath = (obj: any, path: string[]): void => {
	if (path.length === 0)
		return;

	let current = obj;
	for (let i = 0; i < path.length - 1; i++) {
		const key = path[i]!;
		if (!(key in current))
			return;

		current = current[key];
		if (typeof current !== 'object')
			return;
	}

	delete current[path[path.length - 1]!];
};

/**
 * Perform a three-way merge: merge an incoming object with the current state,
 * detecting conflicts when both have modified the same path from the base.
 *
 * @param root - The unwrapped root object being observed
 * @param proxy - The proxied version to apply changes through (for tracking)
 * @param incomingObject - The incoming object to merge
 * @param resolutions - Optional conflict resolutions
 * @returns MergeResult with conflicts and applied count
 */
export const threeWayMerge = (
	root: object,
	proxy: object,
	incomingObject: object,
	resolutions?: ConflictResolutions,
): MergeResult => {
	const base = originalSnapshotCache.get(root);
	if (!base)
		throw new Error('Cannot merge: no original snapshot found. Object may not be chronicled.');

	// Generate diffs between base and incoming to find what changed
	const incomingDiffs: DiffRecord[] = [];
	diffValues(base, incomingObject, [], incomingDiffs, root);

	const conflicts: MergeConflict[] = [];
	let applied = 0;

	// Process each incoming change
	for (const incoming of incomingDiffs) {
		const pathKey = pathKeyOf(incoming.path);
		const baseValue = getByPath(base, incoming.path);
		const currentValue = getByPath(root, incoming.path);
		const incomingValue = getByPath(incomingObject, incoming.path);

		// Detect conflict: both current and incoming modified from base
		const currentModified = !deepEquals(currentValue, baseValue);
		const incomingModified = !deepEquals(incomingValue, baseValue);

		if (currentModified && incomingModified && !deepEquals(currentValue, incomingValue)) {
			// Conflict detected: both modified differently from base
			const conflict: MergeConflict = {
				path:   incoming.path,
				base:   baseValue,
				ours:   currentValue,
				theirs: incomingValue,
			};

			// Check if we have a resolution
			if (resolutions && pathKey in resolutions) {
				const resolution = resolutions[pathKey]!;
				applyResolution(proxy, incoming.path, resolution, conflict);
				applied++;
			}
			else {
				conflicts.push(conflict);
			}
		}
		else {
			// No conflict, apply the change through the proxy
			if (incoming.kind === 'removed')
				deleteByPath(proxy, incoming.path);

			else
				setByPath(proxy, incoming.path, incoming.newValue);

			applied++;
		}
	}

	return {
		success:   conflicts.length === 0,
		conflicts: conflicts,
		applied:   applied,
	};
};

/**
 * Apply a conflict resolution to the root object.
 */
const applyResolution = (
	root: object,
	path: string[],
	resolution: { strategy: 'ours' | 'theirs' | 'custom'; value?: any; },
	conflict: MergeConflict,
): void => {
	switch (resolution.strategy) {
	case 'ours':
		// Keep current value (do nothing)
		break;
	case 'theirs':
		// Apply incoming value
		if (conflict.theirs === undefined)
			deleteByPath(root, path);

		else
			setByPath(root, path, conflict.theirs);

		break;
	case 'custom':
		// Apply custom value
		if (resolution.value === undefined)
			deleteByPath(root, path);

		else
			setByPath(root, path, resolution.value);

		break;
	}
};
