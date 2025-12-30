import { isArrayIndexKey } from './path.ts';
import { isSuspended, resumeWrites, suspendWrites } from './undo-redo.ts';


/**
 * Capture array elements that will be removed when shrinking array length.
 *
 * @param targetArray - The array being modified
 * @param oldLen - The current length
 * @param newLen - The new (smaller) length
 * @returns Array of {index, value} pairs for elements that will be removed
 */
export const captureShrinkRemovals = (
	targetArray: any[],
	oldLen: number,
	newLen: number,
): { index: number; value: any; }[] => {
	const removed: { index: number; value: any; }[] = [];
	for (let i = oldLen - 1; i >= newLen; i--)
		removed.push({ index: i, value: targetArray[i] });

	return removed;
};


/**
 * Delete an array element by index using splice to avoid sparse arrays.
 * Suspends write notifications during the splice to avoid noisy intermediate records.
 *
 * @param root - The root object (for suspend/resume context)
 * @param arrayTarget - The array to modify
 * @param index - The numeric index to delete
 * @returns true if deletion succeeded
 */
export const deleteIndex = (root: object, arrayTarget: any[], index: number): boolean => {
	if (isSuspended(root)) {
		// Already suspended, just splice
		arrayTarget.splice(index, 1);

		return true;
	}

	// Suspend writes to avoid intermediate shift/length records
	suspendWrites(root);
	try {
		arrayTarget.splice(index, 1);

		return true;
	}
	finally {
		resumeWrites(root);
	}
};


/**
 * Check if a delete operation is for an array index.
 *
 * @param target - The target object
 * @param key - The normalized key
 * @returns true if this is an array index deletion
 */
export const isArrayIndexDeletion = (target: any, key: string): boolean =>
	Array.isArray(target) && isArrayIndexKey(key);
