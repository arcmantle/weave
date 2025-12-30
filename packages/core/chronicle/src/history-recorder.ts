import { ensureHistory, getOptions, trimHistoryByGroups } from './history.ts';
import type { ChangeRecord } from './types.ts';
import { clearRedoCache, isSuspended } from './undo-redo.ts';


/**
 * Record a 'set' operation in history with filtering, compaction, and trimming.
 *
 * Handles optional compaction of consecutive sets on the same path within the same group,
 * avoiding compaction of array indices and length properties.
 *
 * @param root - The root object
 * @param path - The path where the set occurred
 * @param oldValue - The previous value
 * @param newValue - The new value
 * @param existedBefore - Whether the property existed before
 * @param groupId - The group ID for this change
 */
export const recordSet = (
	root: object,
	path: string[],
	oldValue: any,
	newValue: any,
	existedBefore: boolean,
	groupId: string,
): void => {
	if (isSuspended(root))
		return;

	const history = ensureHistory(root);
	clearRedoCache(root);
	const cfg = getOptions(root);

	const rec: ChangeRecord = {
		path:      path.slice(),
		type:      'set',
		oldValue,
		newValue,
		timestamp: Date.now(),
		existedBefore,
		groupId,
	};

	if (!cfg?.filter || cfg.filter(rec))
		history.push(rec);

	// Optional compaction: merge consecutive sets on the same path within the same group
	if (cfg && cfg.compactConsecutiveSamePath && history.length >= 2) {
		const a = history[history.length - 2]!;
		const b = history[history.length - 1]!;
		const sameGroup = (a.groupId ?? `__g#${ history.length - 2 }`) === (b.groupId ?? `__g#${ history.length - 1 }`);
		const samePath = a.path.length === b.path.length && a.path.every((seg, i) => seg === b.path[i]);
		const isSetSet = a.type === 'set' && b.type === 'set';
		// Avoid compacting array index updates and length changes
		const lastSeg = b.path[b.path.length - 1]!;
		const isArrayIndex = /^(?:0|[1-9]\d*)$/.test(lastSeg);
		const isLengthProp = lastSeg === 'length';
		if (sameGroup && samePath && isSetSet && !isArrayIndex && !isLengthProp) {
			// Merge: keep 'a' with oldValue from original and update newValue/timestamp from 'b'; drop 'b'
			a.newValue = b.newValue;
			a.timestamp = b.timestamp;
			history.pop();
		}
	}

	// Enforce maxHistory by trimming whole groups from the front
	if (cfg && typeof cfg.maxHistory === 'number')
		trimHistoryByGroups(history, cfg.maxHistory);
};

/**
 * Record a 'delete' operation in history with filtering and trimming.
 *
 * @param root - The root object
 * @param path - The path where the delete occurred
 * @param oldValue - The value that was deleted
 * @param groupId - The group ID for this change
 */
export const recordDelete = (
	root: object,
	path: string[],
	oldValue: any,
	groupId: string,
): void => {
	if (isSuspended(root))
		return;

	const history = ensureHistory(root);
	clearRedoCache(root);
	const cfg = getOptions(root);

	const rec: ChangeRecord = {
		path:      path.slice(),
		type:      'delete',
		oldValue,
		newValue:  undefined,
		timestamp: Date.now(),
		groupId,
	};

	if (!cfg?.filter || cfg.filter(rec))
		history.push(rec);

	// Enforce maxHistory by trimming whole groups from the front
	if (cfg && typeof cfg.maxHistory === 'number')
		trimHistoryByGroups(history, cfg.maxHistory);
};

/**
 * Record delete operations for array elements removed by length shrinkage.
 *
 * Used when array.length is decreased, synthesizing delete records for removed indices.
 * Does not apply compaction or other optimizations - just records the deletes.
 *
 * @param root - The root object
 * @param basePath - The path to the array (not including indices)
 * @param removed - Array of {index, value} pairs that were removed
 * @param groupId - The group ID for these changes
 */
export const recordArrayShrinkDeletes = (
	root: object,
	basePath: string[],
	removed: { index: number; value: any; }[],
	groupId: string,
): void => {
	if (isSuspended(root) || removed.length === 0)
		return;

	const history = ensureHistory(root);
	const cfg = getOptions(root);

	for (const { index, value: oldVal } of removed) {
		const rec: ChangeRecord = {
			path:      [ ...basePath, String(index) ],
			type:      'delete',
			oldValue:  oldVal,
			newValue:  undefined,
			timestamp: Date.now(),
			groupId,
		};

		if (!cfg?.filter || cfg.filter(rec))
			history.push(rec);
	}
};
