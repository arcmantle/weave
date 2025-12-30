import type { ChangeRecord } from './types.ts';

// History records per root
const historyCache: WeakMap<object, ChangeRecord[]> = new WeakMap();

// Group/merge state per root
const groupCounter: WeakMap<object, number> = new WeakMap();
const lastUngrouped: WeakMap<object, { id: string; at: number; }> = new WeakMap();

// Observe options per root
export interface ChronicleOptions {
	mergeUngrouped?:             boolean;
	mergeWindowMs?:              number;
	compactConsecutiveSamePath?: boolean;
	maxHistory?:                 number;
	filter?:                     (record: ChangeRecord) => boolean;
	clone?:                      (value: any) => any;
	compare?:                    (a: any, b: any, path: string[]) => boolean; // true => equal
	diffFilter?:                 (path: string[]) => boolean | 'shallow';
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

export const getOptions = (root: object): ChronicleOptions => optionsCache.get(root) ?? {};
export const setOptions = (root: object, options: ChronicleOptions): void => { optionsCache.set(root, options); };

export const getLastUngrouped = (root: object): { id: string; at: number; } | undefined => lastUngrouped.get(root);
export const setLastUngrouped = (root: object, v: { id: string; at: number; }): void => { lastUngrouped.set(root, v); };
export const clearLastUngrouped = (root: object): void => { lastUngrouped.delete(root); };
