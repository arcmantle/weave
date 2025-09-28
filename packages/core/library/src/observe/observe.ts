import { nameofSegments } from '../function/nameof';
import { clearLastUngrouped, ensureHistory, getLastUngrouped, getOptions, historyDelete, historyGet, nextGroupId, setLastUngrouped, setOptions as setObserveOptions, trimHistoryByGroups } from './history.ts';
import { addListenerToTrie, cleanupListenerBucket, ensureListenerBucket, getListenerBucket, getNode, removeListenerFromTrie } from './listener-trie.ts';
import { normalizeKey } from './path.ts';
import { buildEffectiveListener, flush as scheduleFlush, notifyListeners, pause as schedulePause, resume as scheduleResume } from './schedule-queue.ts';
import { cloneWithOptions, diffValues, originalSnapshotCache } from './snapshot-diff.ts';
import type { ChangeListener, ChangeMeta, ChangeRecord, DiffRecord, ListenerOptions, PathMode, PathSelector, PathTrieNode } from './types.ts';
import { canRedo as coreCanRedo, canUndo as coreCanUndo, clearRedoCache, isSuspended, redo as coreRedo, redoGroups as coreRedoGroups, resumeWrites, suspendWrites, undo as coreUndo, undoGroups as coreUndoGroups, undoSince as coreUndoSince } from './undo-redo.ts';

const proxyToRoot: WeakMap<object, object> = new WeakMap();
// pause/queue state is managed in schedule-queue.ts

// --- Change history (for undo/diff) ---
const batchStack: WeakMap<object, { marker: number; id: string; }[]> = new WeakMap();

// Per-root proxy cache: Map<pathKey, proxy>
const proxyCache: WeakMap<object, Map<string, any>> = new WeakMap();

// redo cache and write suspension managed in undo-redo.ts

// --- Path helpers (segment-based matching) ---

export const observe: (<T extends object>(object: T) => T) & {
	listen: <T extends object>(
		object: T,
		selector: PathSelector<T>,
		listener: ChangeListener,
		modeOrOptions?: PathMode | ListenerOptions,
		maybeOptions?: ListenerOptions,
	) => () => void;
	onAny:        (object: object, listener: ChangeListener, options?: ListenerOptions) => () => void;
	pause:        (object: object) => void;
	resume:       (object: object) => void;
	flush:        (object: object) => void;
	getHistory:   (object: object) => readonly ChangeRecord[];
	clearHistory: (object: object) => void;
	reset:        (object: object) => void;
	undo:         (object: object, steps?: number) => void;
	undoSince:    (object: object, historyLengthBefore: number) => void;
	undoGroups:   (object: object, groups?: number) => void;
	redo:         (object: object, steps?: number) => void;
	redoGroups:   (object: object, groups?: number) => void;
	canUndo:      (object: object) => boolean;
	canRedo:      (object: object) => boolean;
	clearRedo:    (object: object) => void;
	diff:         (object: object) => readonly DiffRecord[];
	isPristine:   (object: object) => boolean;
	markPristine: (object: object) => void;
	mark:         (object: object) => number;
	transaction:   <T extends object, R>(object: T, action: (observed: T) => R) => {
		result: R;
		undo:   () => void;
		marker: number;
	};
	transactionAsync: <T extends object, R>(object: T, action: (observed: T) => Promise<R>) => Promise<{
		result: R;
		undo:   () => void;
		marker: number;
	}>;
	beginBatch:    (object: object) => void;
	commitBatch:   (object: object) => void;
	rollbackBatch: (object: object) => void;
	batch:         <T extends object, R>(object: T, action: (observed: T) => R) => R;
	configure:     (
		object: object,
		options: {
			mergeUngrouped?:             boolean;
			mergeWindowMs?:              number;
			compactConsecutiveSamePath?: boolean;
			maxHistory?:                 number;
			filter?:                     (record: ChangeRecord) => boolean;
			clone?:                      (value: any) => any;
			compare?:                    (a: any, b: any, path: string[]) => boolean;
			diffFilter?:                 (path: string[]) => boolean | 'shallow';
			cacheProxies?:               boolean;
		}
	) => void;
} = object => {
	// Capture original snapshot once per root
	if (!originalSnapshotCache.has(object))
		originalSnapshotCache.set(object, cloneWithOptions(object, object));

	// pause/queue handled by schedule-queue
	const pathKeyOf = (segs: string[]) => segs.join('\x1f');
	const invalidateCacheAt = (root: object, basePath: string[], alsoParentArray?: boolean) => {
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
	// notification delegated to schedule-queue.notifyListeners

	const createProxy = <O extends object>(targetObject: O, path: string[] = [], rootObject: object = object) => {
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
				return cached as O;
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
						const batchFrames = batchStack.get(rootObject);
						if (batchFrames && batchFrames.length > 0)
							return batchFrames[batchFrames.length - 1]!.id;

						const opts = getOptions(rootObject);
						if (opts && opts.mergeUngrouped) {
							const now = Date.now();
							const prev = getLastUngrouped(rootObject);
							const within = opts.mergeWindowMs == null || (prev ? (now - prev.at) <= opts.mergeWindowMs : false);
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
				const batchFrames = batchStack.get(rootObject);
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
				if (Array.isArray(target) && /^(?:0|[1-9]\d*)$/.test(key)) {
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
				const batchFrames = batchStack.get(rootObject);
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
				const isArrayIndex = Array.isArray(target) && /^(?:0|[1-9]\d*)$/.test(key);
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

		proxyToRoot.set(proxy, rootObject);

		// Store in cache if enabled
		if (opts.cacheProxies) {
			const perRoot = proxyCache.get(rootObject)!;
			const pathKey = path.join('\x1f');
			perRoot.set(pathKey, proxy);
		}

		return proxy;
	};

	return createProxy(object, [], object);
};


observe.listen = <T extends object>(
	object: T,
	selector: PathSelector<T>,
	listener: ChangeListener,
	modeOrOptions?: PathMode | ListenerOptions,
	maybeOptions?: ListenerOptions,
) => {
	const segs = nameofSegments(selector);
	const root = proxyToRoot.get(object as object) ?? (object as object);
	const bucket = ensureListenerBucket(root);

	let mode: PathMode = 'down';
	let options: ListenerOptions | undefined;
	if (typeof modeOrOptions === 'string') {
		mode = modeOrOptions;
		options = maybeOptions;
	}
	else {
		options = modeOrOptions;
	}

	// Wrap the listener with scheduling and QoL options (delegated)
	let unsubscribe: (() => void) | undefined;
	const { effective: effectiveListener, setUnsubscribe } = buildEffectiveListener(listener, options);
	setUnsubscribe(() => {
		if (unsubscribe)
			unsubscribe();
	});

	if (segs.length === 0) {
		bucket.global.add(effectiveListener);

		unsubscribe = () => {
			bucket.global.delete(effectiveListener);
			cleanupListenerBucket(root, bucket);
		};

		return unsubscribe;
	}

	addListenerToTrie(bucket.trie, segs, mode, effectiveListener);

	unsubscribe = () => {
		removeListenerFromTrie(bucket.trie, segs, mode, effectiveListener);
		cleanupListenerBucket(root, bucket);
	};

	return unsubscribe;
};

// --- Observability surface ---
observe.onAny = (obj: object, listener: ChangeListener, options?: ListenerOptions) => {
	// Use an identity selector to target the root (global bucket)
	return observe.listen(obj as any, s => s as any, listener, options);
};

observe.pause = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	schedulePause(root);
};

observe.resume = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	scheduleResume(root);
};

observe.flush = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	scheduleFlush(root);
};

// --- Public history APIs ---
observe.getHistory = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;

	return (historyGet(root) ?? []).slice();
};

observe.clearHistory = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	historyDelete(root);

	clearLastUngrouped(root);
	clearRedoCache(root);
};

// Reset the observed object back to its pristine snapshot, regardless of history size.
// This performs a deep overwrite with writes suspended, then marks the state pristine.
observe.reset = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const snapshot = originalSnapshotCache.get(root);
	if (!snapshot) {
		// Nothing to reset to; just clear history and take current as pristine
		observe.markPristine(root);

		return;
	}

	const overwriteDeep = (target: any, source: any) => {
		// Arrays
		if (Array.isArray(target) && Array.isArray(source)) {
			target.length = source.length;
			for (let i = 0; i < source.length; i++)
				target[i] = cloneWithOptions(root, source[i]);

			return;
		}

		// Plain objects
		const isPlainObject = (v: any) => Object.prototype.toString.call(v) === '[object Object]';
		if (isObject(target) && isObject(source) && isPlainObject(target) && isPlainObject(source)) {
			// delete keys not in source (include symbol keys)
			for (const k of Reflect.ownKeys(target)) {
				if (!Object.prototype.hasOwnProperty.call(source, k))
					// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
					delete (target as any)[k as any];
			}
			// set/overwrite from source (include symbol keys)
			for (const k of Reflect.ownKeys(source)) {
				const sv = (source as any)[k as any];
				const tv = (target as any)[k as any];
				const bothArrays = Array.isArray(sv) && Array.isArray(tv);
				const bothObjects = isObject(sv) && isObject(tv) && isPlainObject(sv) && isPlainObject(tv);
				if (bothArrays || bothObjects)
					overwriteDeep(tv, sv);
				else
					(target as any)[k as any] = cloneWithOptions(root, sv);
			}

			return;
		}

		// Fallback: replace by shallow reassign of enumerable props
		for (const k of Reflect.ownKeys(target)) {
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete (target as any)[k];
		}
		for (const k of Reflect.ownKeys(source))
			(target as any)[k] = cloneWithOptions(root, (source as any)[k]);
	};

	suspendWrites(root);
	try {
		overwriteDeep(root as any, snapshot);
	}
	finally {
		resumeWrites(root);
	}

	// Clear history and update the pristine snapshot to the new state
	observe.markPristine(root);
	clearRedoCache(root);
};

observe.markPristine = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	originalSnapshotCache.set(root, cloneWithOptions(root, root));
	historyDelete(root);

	clearLastUngrouped(root);
	clearRedoCache(root);

	// Clear proxy cache to avoid stale entries after marking pristine/reset
	const perRoot = proxyCache.get(root);
	if (perRoot)
		perRoot.clear();
};

observe.undo = (obj: object, steps: number = Number.POSITIVE_INFINITY) => {
	const root = proxyToRoot.get(obj) ?? obj;
	coreUndo(root, steps);
};

// Convenience: undo everything recorded after a previous history length marker
observe.undoSince = (obj: object, historyLengthBefore: number) => {
	const root = proxyToRoot.get(obj) ?? obj;
	coreUndoSince(root, historyLengthBefore);
	clearLastUngrouped(root);
};

// --- Diff and pristine helpers ---

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;


observe.diff = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const original = originalSnapshotCache.get(root) ?? cloneWithOptions(root, root as any);
	const out: DiffRecord[] = [];
	diffValues(original, root, [], out, root);

	return out;
};

observe.isPristine = (obj: object) => {
	const diffs = observe.diff!(obj);

	return diffs.length === 0;
};

// --- Marks and transactions ---
observe.mark = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const history = historyGet(root);

	return history ? history.length : 0;
};

observe.transaction = <T extends object, R>(object: T, action: (observed: T) => R) => {
	const root = (proxyToRoot.get(object as object) ?? (object as object));
	const marker = observe.mark(root);

	const framesBefore = (batchStack.get(root) ?? []).length;
	const isTopLevel = framesBefore === 0;
	if (isTopLevel)
		observe.beginBatch(root);

	const observed = observe(object);
	let groupId: string | undefined;
	try {
		const result = action(observed);
		const frames = (batchStack.get(root) ?? []);
		groupId = frames.length > 0 ? frames[frames.length - 1]!.id : undefined;
		if (isTopLevel)
			observe.commitBatch(root);

		return {
			result,
			marker,
			undo: () => {
				const h = historyGet(root);
				if (groupId && h && h.length > 0) {
					const topGroup = h[h.length - 1]!.groupId ?? `__g#${ h.length - 1 }`;
					if (topGroup === groupId) {
						observe.undoGroups(root, 1);

						return;
					}
				}

				observe.undoSince(root, marker);
			},
		};
	}
	catch (err) {
		if (isTopLevel)
			observe.rollbackBatch(root);
		else
			observe.undoSince(root, marker);

		throw err;
	}
};

observe.transactionAsync = async <T extends object, R>(
	object: T,
	action: (observed: T) => Promise<R>,
) => {
	const root = (proxyToRoot.get(object as object) ?? (object as object));
	const marker = observe.mark(root);

	const framesBefore = (batchStack.get(root) ?? []).length;
	const isTopLevel = framesBefore === 0;
	if (isTopLevel)
		observe.beginBatch(root);

	const observed = observe(object);
	let groupId: string | undefined;
	try {
		const result = await action(observed);
		const frames = (batchStack.get(root) ?? []);
		groupId = frames.length > 0 ? frames[frames.length - 1]!.id : undefined;
		if (isTopLevel)
			observe.commitBatch(root);

		return {
			result,
			marker,
			undo: () => {
				const h = historyGet(root);
				if (groupId && h && h.length > 0) {
					const topGroup = h[h.length - 1]!.groupId ?? `__g#${ h.length - 1 }`;
					if (topGroup === groupId) {
						observe.undoGroups(root, 1);

						return;
					}
				}

				observe.undoSince(root, marker);
			},
		};
	}
	catch (err) {
		if (isTopLevel)
			observe.rollbackBatch(root);
		else
			observe.undoSince(root, marker);

		throw err;
	}
};

// --- Batching APIs ---
observe.beginBatch = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const history = ensureHistory(root);
	const frames = batchStack.get(root) ?? [];
	const id = nextGroupId(root);
	frames.push({ marker: history.length, id });
	batchStack.set(root, frames);
	clearLastUngrouped(root);
};

observe.commitBatch = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const frames = batchStack.get(root);
	if (!frames || frames.length === 0)
		return;

	frames.pop();
	if (frames.length === 0)
		batchStack.delete(root);

	clearLastUngrouped(root);
};

observe.rollbackBatch = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const frames = batchStack.get(root);
	if (!frames || frames.length === 0)
		return;

	const frame = frames.pop()!;
	observe.undoSince(root, frame.marker);
	if (frames.length === 0)
		batchStack.delete(root);

	clearLastUngrouped(root);
};

observe.batch = <T extends object, R>(object: T, action: (observed: T) => R) => {
	const root = (proxyToRoot.get(object as object) ?? (object as object));
	observe.beginBatch(root);
	const observed = observe(object);
	try {
		const result = action(observed);
		observe.commitBatch(root);

		return result;
	}
	catch (err) {
		observe.rollbackBatch(root);
		throw err;
	}
};

// Undo by operation groups (batch groups)
observe.undoGroups = (obj: object, groups: number = 1) => {
	const root = proxyToRoot.get(obj) ?? obj;
	coreUndoGroups(root, groups);
	clearLastUngrouped(root);
};

// --- Redo APIs ---
observe.canUndo = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;

	return coreCanUndo(root);
};

observe.canRedo = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;

	return coreCanRedo(root);
};

observe.clearRedo = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	clearRedoCache(root);
};

// Apply a change record forward (redo side) without emitting notifications
// applyForward moved into undo-redo.ts

observe.redo = (obj: object, steps: number = Number.POSITIVE_INFINITY) => {
	const root = proxyToRoot.get(obj) ?? obj;
	coreRedo(root, steps);
	clearLastUngrouped(root);
};

observe.redoGroups = (obj: object, groups: number = 1) => {
	const root = proxyToRoot.get(obj) ?? obj;
	coreRedoGroups(root, groups);
	clearLastUngrouped(root);
};

// --- Options/configure API ---
observe.configure = (
	obj: object,
	options: {
		mergeUngrouped?:             boolean;
		mergeWindowMs?:              number;
		compactConsecutiveSamePath?: boolean;
		maxHistory?:                 number;
		filter?:                     (record: ChangeRecord) => boolean;
		clone?:                      (value: any) => any;
		compare?:                    (a: any, b: any, path: string[]) => boolean;
		diffFilter?:                 (path: string[]) => boolean | 'shallow';
		cacheProxies?:               boolean;
	},
) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const prev = getOptions(root) ?? {};
	setObserveOptions(root, { ...prev, ...options });
	if (!options.mergeUngrouped)
		clearLastUngrouped(root);
};
/* eslint-enable key-spacing */
