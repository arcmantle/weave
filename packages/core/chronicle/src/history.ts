import type { ChangeRecord } from './types.ts';

// History records per root
const historyCache: WeakMap<object, ChangeRecord[]> = new WeakMap();

// Group/merge state per root
const groupCounter: WeakMap<object, number> = new WeakMap();
const lastUngrouped: WeakMap<object, { id: string; at: number; }> = new WeakMap();

// Observe options per root
export interface ChronicleOptions {
	/**
	 * When enabled, consecutive ungrouped changes (those not in a batch or transaction)
	 * are merged into a single undo group. If mergeWindowMs is also set, only changes
	 * within that time window are merged together. Without this option, each individual
	 * change creates its own undo group.
	 *
	 * @default true
	 */
	mergeUngrouped?:             boolean;
	/**
	 * Time window in milliseconds for merging ungrouped changes. Only effective when
	 * mergeUngrouped is true. Changes occurring within this window are grouped together
	 * for undo/redo. If omitted, all consecutive ungrouped changes are merged regardless
	 * of timing.
	 *
	 * @default 300
	 */
	mergeWindowMs?:              number;
	/**
	 * When enabled, consecutive 'set' operations on the same path within the same undo
	 * group are compacted into a single history record, keeping only the original oldValue
	 * and the final newValue. This reduces history size for rapid updates to the same
	 * property. Does not compact array index updates or length changes to preserve array
	 * operation fidelity.
	 *
	 * @default true
	 */
	compactConsecutiveSamePath?: boolean;
	/**
	 * Maximum number of history records to retain. When the limit is exceeded, entire
	 * undo groups are trimmed from the front of history to keep groups coherent. This
	 * creates a rolling window of recent changes while preventing unbounded memory growth.
	 *
	 * @default 1000
	 */
	maxHistory?:                 number;
	/**
	 * Custom filter function to selectively exclude certain change records from history.
	 * Return false to prevent recording; return true to record normally. The actual change
	 * still occurs in the object, but filtered records won't appear in history and can't
	 * be undone. Useful for excluding temporary properties or noisy updates.
	 */
	filter?:                     (record: ChangeRecord) => boolean;
	/**
	 * Custom deep clone function used when creating snapshots for diff, reset, and undo
	 * operations. Defaults to structuredClone. Provide a custom implementation if you
	 * need special handling for certain object types (e.g., using JSON serialization,
	 * custom class cloning, or handling non-cloneable objects).
	 */
	clone?:                      (value: any) => any;
	/**
	 * Custom equality comparison function used during diff operations to determine if
	 * two values are equal. Return true if values are equal, false otherwise. Defaults
	 * to Object.is. The path parameter provides context about where in the object tree
	 * the comparison is occurring.
	 */
	compare?:                    (a: any, b: any, path: string[]) => boolean; // true => equal
	/**
	 * Filter function to control diff traversal depth. Return false to skip a path entirely,
	 * 'shallow' to compare the value at this path without recursing into it, or true to
	 * recurse normally. Useful for excluding internal properties from diffs or avoiding
	 * deep traversal of large subtrees.
	 */
	diffFilter?:                 (path: string[]) => boolean | 'shallow';
	/**
	 * When enabled, proxies for nested objects at a given path are cached and reused,
	 * providing stable identity for the same path across multiple accesses. Without this,
	 * each access to a nested property creates a new proxy. Caching improves performance
	 * and enables reference equality checks but requires cache invalidation on mutations.
	 *
	 * @default true
	 */
	cacheProxies?:               boolean;
}

const optionsCache: WeakMap<object, ChronicleOptions> = new WeakMap();

export const ensureHistory = (root: object): ChangeRecord[] => {
	let h = historyCache.get(root);
	if (!h) {
		h = [];
		historyCache.set(root, h);
	}

	return h;
};

export const historyGet = (root: object): ChangeRecord[] | undefined => historyCache.get(root);
export const historyDelete = (root: object): void => { historyCache.delete(root); };

// Trim history by removing whole groups from the front until length <= max.
// This keeps undoGroups coherent and avoids splitting groups.
export const trimHistoryByGroups = (history: ChangeRecord[], max: number): void => {
	if (!(typeof max === 'number') || max < 0)
		return;

	if (history.length <= max)
		return;

	let removeCount = 0;
	let i = 0;
	while (history.length - removeCount > max && i < history.length) {
		const gid = history[i]!.groupId ?? `__g#${ i }`;
		let j = i;
		while (j < history.length && (history[j]!.groupId ?? `__g#${ j }`) === gid)
			j++;

		removeCount += (j - i);
		i = j;
	}

	if (removeCount > 0)
		history.splice(0, removeCount);
};

export const nextGroupId = (root: object): string => {
	const n = (groupCounter.get(root) ?? 0) + 1;
	groupCounter.set(root, n);

	return `g${ n }`;
};

const defaultOptions: ChronicleOptions = {
	mergeUngrouped:             true,
	mergeWindowMs:              300,
	compactConsecutiveSamePath: true,
	maxHistory:                 1000,
	cacheProxies:               true,
};

export const getOptions = (root: object): ChronicleOptions => {
	const opts = optionsCache.get(root);
	if (!opts)
		return defaultOptions;

	return {
		...defaultOptions,
		...opts,
	};
};
export const setOptions = (root: object, options: ChronicleOptions): void => { optionsCache.set(root, options); };

export const getLastUngrouped = (root: object): { id: string; at: number; } | undefined => lastUngrouped.get(root);
export const setLastUngrouped = (root: object, v: { id: string; at: number; }): void => { lastUngrouped.set(root, v); };
export const clearLastUngrouped = (root: object): void => { lastUngrouped.delete(root); };
