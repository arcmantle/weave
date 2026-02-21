import { getOptions } from './config.ts';
import { computeActiveGroupId } from './grouping.ts';
import { ensureHistory, trimHistoryByGroups } from './history.ts';
import { computeAffectedListeners } from './listener-affinity.ts';
import { notifyListeners } from './schedule-queue.ts';
import type { ChangeMeta, ChangeRecord } from './types.ts';
import { clearRedoCache, isSuspended } from './undo-redo.ts';


export interface CollectionAdapterDeps {
	getBatchFrames: (root: object) => { marker: number; id: string; }[] | undefined;
}


/**
 * Create a history-and-notify callback for Map/Set mutations.
 * This shared helper records the change and notifies listeners.
 */
const createRecordAndNotify = (
	rootObject: object,
	currentPath: string[],
) => (rec: ChangeRecord, newValForListener: any, oldValForListener: any): void => {
	// Record in history (Map/Set records have collection/key metadata, so push directly)
	if (!isSuspended(rootObject)) {
		const history = ensureHistory(rootObject);
		clearRedoCache(rootObject);
		const cfg = getOptions(rootObject);
		if (!cfg?.filter || cfg.filter(rec))
			history.push(rec);
		if (cfg && typeof cfg.maxHistory === 'number')
			trimHistoryByGroups(history, cfg.maxHistory);
	}

	// Notify listeners
	const affected = computeAffectedListeners(rootObject, currentPath);
	if (affected.size > 0) {
		const meta: ChangeMeta = { type: rec.type, existedBefore: rec.existedBefore, groupId: rec.groupId };
		notifyListeners(rootObject, affected, [ currentPath, newValForListener, oldValForListener, meta ]);
	}
};


/**
 * Wrap Map mutating methods to record changes and notify listeners.
 *
 * @param target - The Map instance
 * @param currentPath - The path to the Map
 * @param rootObject - The root object
 * @param deps - Dependencies (getBatchFrames)
 * @param method - The method name being accessed
 * @returns Wrapped method or undefined if not a mutating method
 */
export const adaptMapMethod = (
	target: Map<any, any>,
	currentPath: string[],
	rootObject: object,
	deps: CollectionAdapterDeps,
	method: string,
): ((...args: any[]) => any) | undefined => {
	const recordHistoryAndNotify = createRecordAndNotify(rootObject, currentPath);

	if (method === 'set') {
		return function(this: any, key: any, value: any) {
			const m = target;
			const had = m.has(key);
			const oldV = had ? m.get(key) : undefined;
			m.set(key, value);

			const rec: ChangeRecord = {
				path:          currentPath.slice(),
				type:          'set',
				oldValue:      oldV,
				newValue:      value,
				timestamp:     Date.now(),
				existedBefore: had,
				groupId:       computeActiveGroupId(rootObject, deps.getBatchFrames),
				collection:    'map',
				key,
			};
			recordHistoryAndNotify(rec, value, oldV);

			return this;
		};
	}

	if (method === 'delete') {
		return function(this: any, key: any) {
			const m = target;
			const had = m.has(key);
			const oldV = had ? m.get(key) : undefined;
			const res = m.delete(key) as boolean;
			if (had) {
				const rec: ChangeRecord = {
					path:       currentPath.slice(),
					type:       'delete',
					oldValue:   oldV,
					newValue:   undefined,
					timestamp:  Date.now(),
					groupId:    computeActiveGroupId(rootObject, deps.getBatchFrames),
					collection: 'map',
					key,
				};
				recordHistoryAndNotify(rec, undefined, oldV);
			}

			return res;
		};
	}

	if (method === 'clear') {
		return function(this: any) {
			const m = target;
			const entries = Array.from(m.entries()) as [ any, any ][];
			const gid = computeActiveGroupId(rootObject, deps.getBatchFrames);
			m.clear();
			for (const [ k, v ] of entries) {
				const rec: ChangeRecord = {
					path:       currentPath.slice(),
					type:       'delete',
					oldValue:   v,
					newValue:   undefined,
					timestamp:  Date.now(),
					groupId:    gid,
					collection: 'map',
					key:        k,
				};
				recordHistoryAndNotify(rec, undefined, v);
			}
		};
	}

	return undefined;
};


/**
 * Wrap Set mutating methods to record changes and notify listeners.
 *
 * @param target - The Set instance
 * @param currentPath - The path to the Set
 * @param rootObject - The root object
 * @param deps - Dependencies (getBatchFrames)
 * @param method - The method name being accessed
 * @returns Wrapped method or undefined if not a mutating method
 */
export const adaptSetMethod = (
	target: Set<any>,
	currentPath: string[],
	rootObject: object,
	deps: CollectionAdapterDeps,
	method: string,
): ((...args: any[]) => any) | undefined => {
	const recordHistoryAndNotify = createRecordAndNotify(rootObject, currentPath);

	if (method === 'add') {
		return function(this: any, value: any) {
			const s = target;
			const had = s.has(value);
			s.add(value);
			if (!had) {
				const rec: ChangeRecord = {
					path:          currentPath.slice(),
					type:          'set',
					oldValue:      undefined,
					newValue:      value,
					timestamp:     Date.now(),
					existedBefore: false,
					groupId:       computeActiveGroupId(rootObject, deps.getBatchFrames),
					collection:    'set',
					key:           value,
				};
				recordHistoryAndNotify(rec, value, undefined);
			}

			return this; // chaining
		};
	}

	if (method === 'delete') {
		return function(this: any, value: any) {
			const s = target;
			const had = s.has(value);
			const res = s.delete(value) as boolean;
			if (had) {
				const rec: ChangeRecord = {
					path:       currentPath.slice(),
					type:       'delete',
					oldValue:   value,
					newValue:   undefined,
					timestamp:  Date.now(),
					groupId:    computeActiveGroupId(rootObject, deps.getBatchFrames),
					collection: 'set',
					key:        value,
				};
				recordHistoryAndNotify(rec, undefined, value);
			}

			return res; // boolean
		};
	}

	if (method === 'clear') {
		return function(this: any) {
			const s = target;
			const values = Array.from(s.values()) as any[];
			const gid = computeActiveGroupId(rootObject, deps.getBatchFrames);
			s.clear();
			for (const v of values) {
				const rec: ChangeRecord = {
					path:       currentPath.slice(),
					type:       'delete',
					oldValue:   v,
					newValue:   undefined,
					timestamp:  Date.now(),
					groupId:    gid,
					collection: 'set',
					key:        v,
				};
				recordHistoryAndNotify(rec, undefined, v);
			}
		};
	}

	return undefined;
};
