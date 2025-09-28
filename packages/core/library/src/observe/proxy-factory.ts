import {
	clearLastUngrouped, ensureHistory, getLastUngrouped, getOptions,
	nextGroupId, setLastUngrouped, trimHistoryByGroups,
} from './history.ts';
import { getListenerBucket, getNode } from './listener-trie.ts';
import { isArrayIndexKey, normalizeKey } from './path.ts';
import { notifyListeners } from './schedule-queue.ts';
import type { ChangeListener, ChangeMeta, ChangeRecord, PathTrieNode } from './types.ts';
import { clearRedoCache, isSuspended, resumeWrites, suspendWrites } from './undo-redo.ts';


export interface ProxyFactoryDeps {
	getBatchFrames: (root: object) => { marker: number; id: string; }[] | undefined;
	setProxyRoot:   (proxy: object, root: object) => void;
}

export interface ProxyFactory {
	createProxy:       <O extends object>(targetObject: O, path: string[] | undefined, rootObject: object) => O;
	invalidateCacheAt: (root: object, basePath: string[], alsoParentArray?: boolean) => void;
	clearProxyCache:   (root: object) => void;
}


// Per-root proxy cache: Map<pathKey, proxy>
const proxyCache: WeakMap<object, Map<string, any>> = new WeakMap();


const pathKeyOf = (segs: string[]) => segs.join('\x1f');

export const invalidateCacheAt = (root: object, basePath: string[], alsoParentArray?: boolean): void => {
	const opts = getOptions(root);
	if (!opts.cacheProxies)
		return;

	const perRoot = proxyCache.get(root);
	if (!perRoot)
		return;

	const base = pathKeyOf(basePath);
	for (const k of Array.from(perRoot.keys())) {
		if (k === base || k.startsWith(base + '\x1f'))
			perRoot.delete(k);
	}

	if (alsoParentArray) {
		const parentKey = pathKeyOf(basePath.slice(0, -1));
		for (const k of Array.from(perRoot.keys())) {
			if (k === parentKey || k.startsWith(parentKey + '\x1f'))
				perRoot.delete(k);
		}
	}
};

export const clearProxyCache = (root: object): void => {
	const perRoot = proxyCache.get(root);
	if (perRoot)
		perRoot.clear();
};


export const createProxyFactory = (deps: ProxyFactoryDeps): ProxyFactory => {
	const createProxy: ProxyFactory['createProxy'] = (targetObject, path = [], rootObject) => {
		const opts = getOptions(rootObject);
		if (opts.cacheProxies) {
			let perRoot = proxyCache.get(rootObject);
			if (!perRoot) {
				perRoot = new Map<string, any>();
				proxyCache.set(rootObject, perRoot);
			}

			const pathKey = path.join('\x1f');
			const cached = perRoot.get(pathKey);
			if (cached)
				return cached;
		}

		const proxy = new Proxy(targetObject, {
			get(target, prop) {
				const result = Reflect.get(target, prop);

				// Map/Set adapters: wrap mutating methods and bind non-mutators to raw target for brand checks
				const isMap = target instanceof Map;
				const isSet = target instanceof Set;
				if ((isMap || isSet) && typeof result === 'function') {
					const method = String(prop);
					const currentPath = path.slice(); // collection lives at this path

					const computeActiveGroupId = (): string => {
						const batchFrames = deps.getBatchFrames(rootObject);
						if (batchFrames && batchFrames.length > 0)
							return batchFrames[batchFrames.length - 1]!.id;

						const opts = getOptions(rootObject);
						if (opts && opts.mergeUngrouped) {
							const now = Date.now();
							const prev = getLastUngrouped(rootObject);
							const within = opts.mergeWindowMs == null
								|| (prev ? (now - prev.at) <= opts.mergeWindowMs : false);

							if (prev && within) {
								setLastUngrouped(rootObject, { id: prev.id, at: now });

								return prev.id;
							}

							const gid = nextGroupId(rootObject);
							setLastUngrouped(rootObject, { id: gid, at: now });

							return gid;
						}

						clearLastUngrouped(rootObject);

						return nextGroupId(rootObject);
					};

					const recordHistoryAndNotify = (rec: ChangeRecord, newValForListener: any, oldValForListener: any) => {
						if (!isSuspended(rootObject)) {
							const history = ensureHistory(rootObject);
							clearRedoCache(rootObject);
							const cfg = getOptions(rootObject);
							if (!cfg?.filter || cfg.filter(rec))
								history.push(rec);
							if (cfg && typeof cfg.maxHistory === 'number')
								trimHistoryByGroups(history, cfg.maxHistory);
						}

						const bucket = getListenerBucket(rootObject);
						if (bucket) {
							const affected: Set<ChangeListener> = new Set();
							bucket.global.forEach(l => affected.add(l));
							// Down listeners on ancestors
							{
								let node: PathTrieNode | undefined = bucket.trie;
								if (node && node.modes.size > 0)
									node.modes.get('down')?.forEach(l => affected.add(l));

								for (const s of currentPath) {
									node = node?.children.get(s);
									if (!node)
										break;

									node.modes.get('down')?.forEach(l => affected.add(l));
								}
							}
							// Exact listeners at collection node
							{
								const node = getNode(bucket.trie, currentPath);
								if (node)
									node.modes.get('exact')?.forEach(l => affected.add(l));
							}
							// Up listeners on descendants
							{
								const start = getNode(bucket.trie, currentPath);
								if (start) {
									for (const child of start.children.values()) {
										const stack: PathTrieNode[] = [ child ];
										while (stack.length) {
											const n = stack.pop()!;
											n.modes.get('up')?.forEach(l => affected.add(l));
											for (const c of n.children.values())
												stack.push(c);
										}
									}
								}
							}

							const meta: ChangeMeta = { type: rec.type, existedBefore: rec.existedBefore, groupId: rec.groupId };
							notifyListeners(rootObject, affected, [ currentPath, newValForListener, oldValForListener, meta ]);
						}
					};

					if (isMap) {
						if (method === 'set') {
							return function(this: any, key: any, value: any) {
								const m = target as Map<any, any>;
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
									groupId:       computeActiveGroupId(),
									collection:    'map',
									key,
								};
								recordHistoryAndNotify(rec, value, oldV);

								return this;
							};
						}
						if (method === 'delete') {
							return function(this: any, key: any) {
								const m = target as Map<any, any>;
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
										groupId:    computeActiveGroupId(),
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
								const m = target as Map<any, any>;
								const entries = Array.from(m.entries()) as [ any, any ][];
								const gid = computeActiveGroupId();
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
					}

					if (isSet) {
						if (method === 'add') {
							return function(this: any, value: any) {
								const s = target as Set<any>;
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
										groupId:       computeActiveGroupId(),
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
								const s = target as Set<any>;
								const had = s.has(value);
								const res = s.delete(value) as boolean;
								if (had) {
									const rec: ChangeRecord = {
										path:       currentPath.slice(),
										type:       'delete',
										oldValue:   value,
										newValue:   undefined,
										timestamp:  Date.now(),
										groupId:    computeActiveGroupId(),
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
								const s = target as Set<any>;
								const values = Array.from(s.values()) as any[];
								const gid = computeActiveGroupId();
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
					}

					// For other methods, bind to raw target to satisfy brand checks
					return (result as (...args: any[]) => any).bind(target);
				}
				if (!result || typeof result !== 'object')
					return result;

				const currentPath = [ ...path, normalizeKey(prop) ];

				return createProxy(result, currentPath, rootObject);
			},
			set(target, prop, value) {
				const currentPath = [ ...path, normalizeKey(prop) ];
				const hadBefore = Reflect.has(target, prop);
				const oldValue = Reflect.get(target, prop);
				// capture elements that will be removed if shrinking array length
				let removedForLengthShrink: { index: number; value: any; }[] | null = null;
				if (
					Array.isArray(target)
					&& normalizeKey(prop) === 'length'
					&& typeof oldValue === 'number'
					&& typeof value === 'number'
					&& value < oldValue
				) {
					removedForLengthShrink = [];
					for (let i = oldValue - 1; i >= value; i--)
						removedForLengthShrink.push({ index: i, value: (target as any)[i] });
				}

				const result = Reflect.set(target, prop, value);
				const bucket = getListenerBucket(rootObject);
				const batchFrames = deps.getBatchFrames(rootObject);
				let activeGroupId: string;
				if (batchFrames && batchFrames.length > 0) {
					activeGroupId = batchFrames[batchFrames.length - 1]!.id;
				}
				else {
					const opts = getOptions(rootObject);
					if (opts && opts.mergeUngrouped) {
						const now = Date.now();
						const prev = getLastUngrouped(rootObject);
						const within = opts.mergeWindowMs == null || (prev ? (now - prev.at) <= opts.mergeWindowMs : false);
						if (prev && within) {
							activeGroupId = prev.id;
							setLastUngrouped(rootObject, { id: prev.id, at: now });
						}
						else {
							const gid = nextGroupId(rootObject);
							setLastUngrouped(rootObject, { id: gid, at: now });
							activeGroupId = gid;
						}
					}
					else {
						clearLastUngrouped(rootObject);
						activeGroupId = nextGroupId(rootObject);
					}
				}

				// Record change in history unless suspended
				if (!isSuspended(rootObject)) {
					const history = ensureHistory(rootObject);
					clearRedoCache(rootObject);
					const cfg = getOptions(rootObject);
					const baseRecord: ChangeRecord = {
						path:          currentPath.slice(),
						type:          'set',
						oldValue,
						newValue:      value,
						timestamp:     Date.now(),
						existedBefore: hadBefore,
						groupId:       activeGroupId,
					};
					if (!cfg?.filter || cfg.filter(baseRecord))
						history.push(baseRecord);

					// If we shrank array length, synthesize delete records for removed indices
					if (removedForLengthShrink && removedForLengthShrink.length > 0) {
						const basePath = path.slice();
						for (const { index, value: oldVal } of removedForLengthShrink) {
							const delRec: ChangeRecord = {
								path:      [ ...basePath, String(index) ],
								type:      'delete',
								oldValue:  oldVal,
								newValue:  undefined,
								timestamp: Date.now(),
								groupId:   activeGroupId,
							};
							if (!cfg?.filter || cfg.filter(delRec))
								history.push(delRec);
						}
					}

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
				}

				// Invalidate proxy cache for this path; if shrinking array length, also invalidate the array base
				const shrinkingArray = Array.isArray(target)
					&& normalizeKey(prop) === 'length'
					&& typeof oldValue === 'number'
					&& typeof value === 'number'
					&& value < oldValue;

				invalidateCacheAt(rootObject, currentPath, shrinkingArray);

				if (bucket) {
					const affectedListeners: Set<ChangeListener> = new Set();

					bucket.global.forEach(listener => affectedListeners.add(listener));

					// Trie-based dispatch
					const root = bucket.trie;
					// collect down listeners from all ancestor nodes along currentPath
					{
						let node: PathTrieNode | undefined = root;
						if (node && node.modes.size > 0) {
							const down = node.modes.get('down');
							if (down)
								down.forEach(l => affectedListeners.add(l));
						}

						for (const s of currentPath) {
							node = node?.children.get(s);
							if (!node)
								break;

							node.modes.get('down')?.forEach(l => affectedListeners.add(l));
						}
					}
					// exact listeners at the leaf node
					{
						const node = getNode(root, currentPath);
						if (node) {
							const exact = node.modes.get('exact');
							if (exact)
								exact.forEach(l => affectedListeners.add(l));
						}
					}
					// up listeners on descendants (strictly deeper than currentPath)
					{
						const start = getNode(root, currentPath);
						if (start) {
							const stack: { node: PathTrieNode; depth: number; }[] = [];
							// seed with children to ensure strict depth
							for (const child of start.children.values())
								stack.push({ node: child, depth: 1 });

							while (stack.length > 0) {
								const { node } = stack.pop()!;
								const up = node.modes.get('up');
								if (up)
									up.forEach(l => affectedListeners.add(l));

								for (const child of node.children.values())
									stack.push({ node: child, depth: 1 });
							}
						}
					}

					const meta: ChangeMeta = { type: 'set', existedBefore: hadBefore, groupId: activeGroupId };
					notifyListeners(rootObject, affectedListeners, [ currentPath, value, oldValue, meta ]);
				}

				return result;
			},
			deleteProperty(target, prop) {
				const key = normalizeKey(prop);
				const currentPath = [ ...path, key ];
				const oldValue = Reflect.get(target, prop);
				const hadBefore = Reflect.has(target, prop);
				let result: boolean;

				// If deleting from an array by numeric index, use splice to avoid holes (parity with undo behavior)
				if (Array.isArray(target) && isArrayIndexKey(key)) {
					const idx = Number(key);
					// Perform the splice with history suspended to avoid noisy shift/length records
					suspendWrites(rootObject);
					try {
						(target as any).splice(idx, 1);
						result = true;
					}
					finally {
						resumeWrites(rootObject);
					}
				}
				else {
					result = Reflect.deleteProperty(target, prop);
				}

				const bucket = getListenerBucket(rootObject);
				const batchFrames = deps.getBatchFrames(rootObject);
				let activeGroupId: string;
				if (batchFrames && batchFrames.length > 0) {
					activeGroupId = batchFrames[batchFrames.length - 1]!.id;
				}
				else {
					const opts = getOptions(rootObject);
					if (opts && opts.mergeUngrouped) {
						const now = Date.now();
						const prev = getLastUngrouped(rootObject);
						const within = opts.mergeWindowMs == null || (prev ? (now - prev.at) <= opts.mergeWindowMs : false);
						if (prev && within) {
							activeGroupId = prev.id;
							setLastUngrouped(rootObject, { id: prev.id, at: now });
						}
						else {
							const gid = nextGroupId(rootObject);
							setLastUngrouped(rootObject, { id: gid, at: now });
							activeGroupId = gid;
						}
					}
					else {
						clearLastUngrouped(rootObject);
						activeGroupId = nextGroupId(rootObject);
					}
				}

				if (!isSuspended(rootObject)) {
					const history = ensureHistory(rootObject);
					clearRedoCache(rootObject);
					const opts = getOptions(rootObject);
					const delRec: ChangeRecord = {
						path:      currentPath.slice(),
						type:      'delete',
						oldValue,
						newValue:  undefined,
						timestamp: Date.now(),
						groupId:   activeGroupId,
					};
					if (!opts?.filter || opts.filter(delRec))
						history.push(delRec);

					// Enforce maxHistory by trimming whole groups from the front
					if (opts && typeof opts.maxHistory === 'number')
						trimHistoryByGroups(history, opts.maxHistory);
				}

				// Invalidate proxy cache for this path and, for array index splice case, also for the array base
				const isArrayIndex = Array.isArray(target) && isArrayIndexKey(key);
				invalidateCacheAt(rootObject, currentPath, isArrayIndex);

				// Notify listeners (deletes affect exact path only and descendants no longer exist)
				if (bucket) {
					const affectedListeners: Set<ChangeListener> = new Set();
					bucket.global.forEach(l => affectedListeners.add(l));
					// Trie-based dispatch
					const root = bucket.trie;
					// collect down listeners from all ancestor nodes along currentPath
					{
						let node: PathTrieNode | undefined = root;
						if (node && node.modes.size > 0) {
							const down = node.modes.get('down');
							if (down)
								down.forEach(l => affectedListeners.add(l));
						}

						for (const s of currentPath) {
							node = node?.children.get(s);
							if (!node)
								break;

							node.modes.get('down')?.forEach(l => affectedListeners.add(l));
						}
					}
					// exact listeners at the leaf node
					{
						const node = getNode(root, currentPath);
						if (node) {
							const exact = node.modes.get('exact');
							if (exact)
								exact.forEach((l: ChangeListener) => affectedListeners.add(l));
						}
					}
					// up listeners on descendants (strictly deeper than currentPath)
					{
						const start = getNode(root, currentPath);
						if (start) {
							const stack: { node: PathTrieNode; depth: number; }[] = [];
							for (const child of start.children.values())
								stack.push({ node: child, depth: 1 });

							while (stack.length > 0) {
								const { node } = stack.pop()!;
								const up = node.modes.get('up');
								if (up)
									up.forEach((l: ChangeListener) => affectedListeners.add(l));

								for (const child of node.children.values())
									stack.push({ node: child, depth: 1 });
							}
						}
					}

					const meta: ChangeMeta = { type: 'delete', existedBefore: hadBefore, groupId: activeGroupId };
					notifyListeners(rootObject, affectedListeners, [ currentPath, undefined, oldValue, meta ]);
				}

				return result;
			},
		});

		deps.setProxyRoot(proxy, rootObject);

		// Store in cache if enabled
		if (opts.cacheProxies) {
			const perRoot = proxyCache.get(rootObject)!;
			const pathKey = path.join('\x1f');
			perRoot.set(pathKey, proxy);
		}

		return proxy;
	};

	return { createProxy, invalidateCacheAt, clearProxyCache };
};
