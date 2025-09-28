import { nameofSegments } from '../function/nameof';
import { normalizePropertyKey } from '../util/symbol-id.ts';

interface ChangeMeta { type: 'set' | 'delete'; existedBefore?: boolean; groupId?: string; }
type ChangeListener = (path: string[], newValue: any, oldValue: any, meta?: ChangeMeta) => void;

type PathSelector<T> = (object: T) => any;

type PathMode = 'exact' | 'up' | 'down';

interface PathTrieNode {
	children: Map<string, PathTrieNode>;
	modes:    Map<PathMode, Set<ChangeListener>>;
}

interface ListenerBucket {
	global: Set<ChangeListener>;
	trie:   PathTrieNode;
}

interface ListenerOptions {
	once?:       boolean;
	debounceMs?: number;
	throttleMs?: number;
	schedule?:   'sync' | 'microtask';
}

const listenerCache: WeakMap<object, ListenerBucket> = new WeakMap();
const proxyToRoot: WeakMap<object, object> = new WeakMap();
interface QueuedCall { listener: ChangeListener; args: [ string[], any, any, ChangeMeta | undefined ]; }
const pauseState: WeakMap<object, { paused: boolean; queue: QueuedCall[]; }> = new WeakMap();

// --- Change history (for undo/diff) ---
type ChangeType = 'set' | 'delete';
interface ChangeRecord {
	path:           string[];
	type:           ChangeType;
	oldValue:       any;
	newValue:       any;
	timestamp:      number;
	existedBefore?: boolean;
	groupId?:       string;
	// Collection metadata (for Map/Set adapters)
	collection?:    'map' | 'set';
	key?:           any; // Map key (or Set entry when needed)
}

const historyCache: WeakMap<object, ChangeRecord[]> = new WeakMap();
const redoCache:    WeakMap<object, ChangeRecord[]> = new WeakMap();
const suspendWriteCounter: WeakMap<object, number> = new WeakMap();
const batchStack: WeakMap<object, { marker: number; id: string; }[]> = new WeakMap();
const groupCounter: WeakMap<object, number> = new WeakMap();
const optionsCache: WeakMap<object, {
	mergeUngrouped?:             boolean;
	mergeWindowMs?:              number;
	compactConsecutiveSamePath?: boolean;
	maxHistory?:                 number;
	filter?:                     (record: ChangeRecord) => boolean;
	clone?:                      (value: any) => any;
	compare?:                    (a: any, b: any, path: string[]) => boolean; // true => equal
	diffFilter?:                 (path: string[]) => boolean | 'shallow';
}> = new WeakMap();
const lastUngrouped: WeakMap<object, { id: string; at: number; }> = new WeakMap();

const nextGroupId = (root: object): string => {
	const n = (groupCounter.get(root) ?? 0) + 1;
	groupCounter.set(root, n);

	return `g${ n }`;
};

const ensureHistory = (root: object): ChangeRecord[] => {
	let h = historyCache.get(root);
	if (!h) {
		h = [];
		historyCache.set(root, h);
	}

	return h;
};

// Trim history by removing whole groups from the front until length <= max.
// This keeps undoGroups coherent and avoids splitting groups.
const trimHistoryByGroups = (history: ChangeRecord[], max: number) => {
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

const isSuspended = (root: object): boolean => (suspendWriteCounter.get(root) ?? 0) > 0;
const suspendWrites = (root: object) => suspendWriteCounter.set(root, (suspendWriteCounter.get(root) ?? 0) + 1);
const resumeWrites = (root: object) => {
	const n = (suspendWriteCounter.get(root) ?? 0) - 1;
	if (n <= 0)
		suspendWriteCounter.delete(root);
	else
		suspendWriteCounter.set(root, n);
};

const getParentAndKey = (root: any, path: string[]): [any, string] | null => {
	if (path.length === 0)
		return null;

	let parent: any = root;
	for (const seg of path.slice(0, -1)) {
		if (parent == null)
			return null;

		parent = (parent as any)[seg as any];
	}

	const last = path[path.length - 1]!;

	return [ parent, last ];
};

const setAtPath = (root: any, path: string[], value: any) => {
	const res = getParentAndKey(root, path);
	if (!res)
		return;

	const [ parent, key ] = res;
	Reflect.set(parent, key, value);
};

const isArrayIndexKey = (k: string) => /^(?:0|[1-9]\d*)$/.test(k);

const deleteAtPath = (root: any, path: string[]) => {
	const res = getParentAndKey(root, path);
	if (!res)
		return;

	const [ parent, key ] = res;
	if (parent == null)
		return;

	// If deleting from an array, prefer splice to avoid holes and adjust length
	if (Array.isArray(parent) && isArrayIndexKey(String(key))) {
		const idx = Number(key);
		if (Number.isInteger(idx))
			parent.splice(idx, 1);

		return;
	}

	Reflect.deleteProperty(parent, key as any);
};

const ensureParents = (root: any, path: string[]) => {
	let node: any = root;
	for (let i = 0; i < path.length - 1; i++) {
		const seg = path[i]!;
		let next = (node as any)[seg as any];
		if (next == null) {
			const following = path[i + 1]!;
			next = /^(?:0|[1-9]\d*)$/.test(following) ? [] : {};
			(node as any)[seg as any] = next;
		}

		node = next;
	}
};

// Original snapshot for diff/isPristine
const originalSnapshotCache: WeakMap<object, any> = new WeakMap();

// Deep clone utility for snapshotting (structuredClone-first; fallback to identity)
const deepClone = <T>(v: T): T => {
	try {
		return structuredClone(v) as T;
	}
	catch { /* ignore */ }

	return v;
};

const getOptions = (root: object) => optionsCache.get(root) ?? {};
const getRedo = (root: object): ChangeRecord[] => {
	let r = redoCache.get(root);
	if (!r) {
		r = [];
		redoCache.set(root, r);
	}

	return r;
};
const clearRedoInternal = (root: object) => redoCache.delete(root);
const cloneWithOptions = <T>(root: object, v: T): T => {
	const opts = getOptions(root);
	if (opts.clone) {
		try {
			return opts.clone(v);
		}
		catch {
			// fall through to default deepClone
		}
	}


	return deepClone(v);
};

const ensureListenerBucket = (root: object): ListenerBucket => {
	let bucket = listenerCache.get(root);

	if (!bucket) {
		bucket = {
			global: new Set<ChangeListener>(),
			trie:   { children: new Map<string, PathTrieNode>(), modes: new Map<PathMode, Set<ChangeListener>>() },
		};
		listenerCache.set(root, bucket);
	}

	return bucket;
};

const isNodeEmpty = (node: PathTrieNode): boolean => node.children.size === 0 && (node.modes.size === 0);

const cleanupListenerBucket = (root: object, bucket: ListenerBucket) => {
	if (bucket.global.size === 0 && isNodeEmpty(bucket.trie))
		listenerCache.delete(root);
};

const getOrCreateNode = (root: PathTrieNode, segs: string[]): PathTrieNode => {
	let node = root;
	for (const s of segs) {
		let next = node.children.get(s);
		if (!next) {
			next = { children: new Map<string, PathTrieNode>(), modes: new Map<PathMode, Set<ChangeListener>>() };
			node.children.set(s, next);
		}

		node = next;
	}

	return node;
};

const getNode = (root: PathTrieNode, segs: string[]): PathTrieNode | undefined => {
	let node: PathTrieNode | undefined = root;
	for (const s of segs) {
		node = node?.children.get(s);
		if (!node)
			return undefined;
	}

	return node;
};

const prunePathIfEmpty = (root: PathTrieNode, segs: string[]) => {
	const stack: { seg: string; node: PathTrieNode; }[] = [];
	let node: PathTrieNode | undefined = root;
	for (const s of segs) {
		if (!node)
			return;

		stack.push({ seg: s, node });
		node = node.children.get(s);
	}
	// node is the target node
	if (!node)
		return;

	// Walk back up pruning empty nodes
	for (let i = segs.length - 1; i >= 0; i--) {
		const parent = stack[i]!.node;
		const seg = stack[i]!.seg;
		const child = parent.children.get(seg)!;
		if (child.children.size === 0 && child.modes.size === 0)
			parent.children.delete(seg);
		else
			break;
	}
};

const _addListenerToTrie = (root: PathTrieNode, segs: string[], mode: PathMode, listener: ChangeListener): PathTrieNode => {
	const node = getOrCreateNode(root, segs);
	const set = node.modes.get(mode) ?? new Set<ChangeListener>();
	set.add(listener);
	node.modes.set(mode, set);

	return node;
};

const _removeListenerFromTrie = (root: PathTrieNode, segs: string[], mode: PathMode, listener: ChangeListener) => {
	const node = getNode(root, segs);
	if (!node)
		return;

	const set = node.modes.get(mode);
	if (set) {
		set.delete(listener);
		if (set.size === 0)
			node.modes.delete(mode);
	}

	prunePathIfEmpty(root, segs);
};

// --- Path helpers (segment-based matching) ---

// Normalize property key to a stable string segment (symbols -> sym#id)
const normalizeKey = (prop: PropertyKey): string => normalizePropertyKey(prop);

// (segment compare helpers removed; trie-based dispatch no longer uses them)

/* eslint-disable key-spacing */
export const observe: (<T extends object>(object: T) => T) & {
	listen: <T extends object>(
		object: T,
		selector: PathSelector<T>,
		listener: ChangeListener,
		modeOrOptions?: PathMode | ListenerOptions,
		maybeOptions?: ListenerOptions,
	) => () => void;
} & {
	onAny:  (object: object, listener: ChangeListener, options?: ListenerOptions) => () => void;
	pause:  (object: object) => void;
	resume: (object: object) => void;
	flush:  (object: object) => void;
} & {
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
		}
	) => void;
} /* eslint-enable key-spacing */ = object => {
	// Capture original snapshot once per root
	if (!originalSnapshotCache.has(object))
		originalSnapshotCache.set(object, cloneWithOptions(object, object));

	const isPaused = (root: object) => (pauseState.get(root)?.paused === true);
	const enqueue = (root: object, call: QueuedCall) => {
		let st = pauseState.get(root);
		if (!st) {
			st = { paused: true, queue: [] };
			pauseState.set(root, st);
		}

		st.queue.push(call);
	};
	const notifyListeners = (
		root: object,
		listeners: Set<ChangeListener>,
		args: [ string[], any, any, ChangeMeta | undefined ],
	) => {
		if (listeners.size === 0)
			return;

		if (isPaused(root)) {
			listeners.forEach(listener => enqueue(root, { listener, args }));

			return;
		}

		listeners.forEach(listener => listener(...args));
	};

	const createProxy = <O extends object>(targetObject: O, path: string[] = [], rootObject: object = object) => {
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

						const opts = optionsCache.get(rootObject);
						if (opts && opts.mergeUngrouped) {
							const now = Date.now();
							const prev = lastUngrouped.get(rootObject);
							const within = opts.mergeWindowMs == null || (prev ? (now - prev.at) <= opts.mergeWindowMs : false);
							if (prev && within) {
								lastUngrouped.set(rootObject, { id: prev.id, at: now });

								return prev.id;
							}

							const gid = nextGroupId(rootObject);
							lastUngrouped.set(rootObject, { id: gid, at: now });

							return gid;
						}

						lastUngrouped.delete(rootObject);

						return nextGroupId(rootObject);
					};

					const recordHistoryAndNotify = (rec: ChangeRecord, newValForListener: any, oldValForListener: any) => {
						if (!isSuspended(rootObject)) {
							const history = ensureHistory(rootObject);
							clearRedoInternal(rootObject);
							const cfg = optionsCache.get(rootObject);
							if (!cfg?.filter || cfg.filter(rec))
								history.push(rec);
							if (cfg && typeof cfg.maxHistory === 'number')
								trimHistoryByGroups(history, cfg.maxHistory);
						}

						const bucket = listenerCache.get(rootObject);
						if (bucket) {
							const affected: Set<ChangeListener> = new Set();
							bucket.global.forEach(l => affected.add(l));
							// Down listeners on ancestors
							{
								let node: PathTrieNode | undefined = bucket.trie;
								if (node.modes.size > 0)
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
				const bucket = listenerCache.get(rootObject);
				const batchFrames = batchStack.get(rootObject);
				let activeGroupId: string;
				if (batchFrames && batchFrames.length > 0) {
					activeGroupId = batchFrames[batchFrames.length - 1]!.id;
				}
				else {
					const opts = optionsCache.get(rootObject);
					if (opts && opts.mergeUngrouped) {
						const now = Date.now();
						const prev = lastUngrouped.get(rootObject);
						const within = opts.mergeWindowMs == null || (prev ? (now - prev.at) <= opts.mergeWindowMs : false);
						if (prev && within) {
							activeGroupId = prev.id;
							lastUngrouped.set(rootObject, { id: prev.id, at: now });
						}
						else {
							const gid = nextGroupId(rootObject);
							lastUngrouped.set(rootObject, { id: gid, at: now });
							activeGroupId = gid;
						}
					}
					else {
						lastUngrouped.delete(rootObject);
						activeGroupId = nextGroupId(rootObject);
					}
				}

				// Record change in history unless suspended
				if (!isSuspended(rootObject)) {
					const history = ensureHistory(rootObject);
					clearRedoInternal(rootObject);
					const cfg = optionsCache.get(rootObject);
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

				if (bucket) {
					const affectedListeners: Set<ChangeListener> = new Set();

					bucket.global.forEach(listener => affectedListeners.add(listener));

					// Trie-based dispatch
					const root = bucket.trie;
					// collect down listeners from all ancestor nodes along currentPath
					{
						let node: PathTrieNode | undefined = root;
						if (node.modes.size > 0) {
							const down = node.modes.get('down');
							if (down)
								down.forEach((l: ChangeListener) => affectedListeners.add(l));
						}

						for (const s of currentPath) {
							node = node?.children.get(s);
							if (!node)
								break;

							node.modes.get('down')?.forEach((l: ChangeListener) => affectedListeners.add(l));
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
							// seed with children to ensure strict depth
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

				const bucket = listenerCache.get(rootObject);
				const batchFrames = batchStack.get(rootObject);
				let activeGroupId: string;
				if (batchFrames && batchFrames.length > 0) {
					activeGroupId = batchFrames[batchFrames.length - 1]!.id;
				}
				else {
					const opts = optionsCache.get(rootObject);
					if (opts && opts.mergeUngrouped) {
						const now = Date.now();
						const prev = lastUngrouped.get(rootObject);
						const within = opts.mergeWindowMs == null || (prev ? (now - prev.at) <= opts.mergeWindowMs : false);
						if (prev && within) {
							activeGroupId = prev.id;
							lastUngrouped.set(rootObject, { id: prev.id, at: now });
						}
						else {
							const gid = nextGroupId(rootObject);
							lastUngrouped.set(rootObject, { id: gid, at: now });
							activeGroupId = gid;
						}
					}
					else {
						lastUngrouped.delete(rootObject);
						activeGroupId = nextGroupId(rootObject);
					}
				}

				if (!isSuspended(rootObject)) {
					const history = ensureHistory(rootObject);
					clearRedoInternal(rootObject);
					const opts = optionsCache.get(rootObject);
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

				// Notify listeners (deletes affect exact path only and descendants no longer exist)
				if (bucket) {
					const affectedListeners: Set<ChangeListener> = new Set();
					bucket.global.forEach(listener => affectedListeners.add(listener));
					// Trie-based dispatch
					const root = bucket.trie;
					// collect down listeners from all ancestor nodes along currentPath
					{
						let node: PathTrieNode | undefined = root;
						if (node.modes.size > 0) {
							const down = node.modes.get('down');
							if (down)
								down.forEach((l: ChangeListener) => affectedListeners.add(l));
						}

						for (const s of currentPath) {
							node = node?.children.get(s);
							if (!node)
								break;

							node.modes.get('down')?.forEach((l: ChangeListener) => affectedListeners.add(l));
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
		mode = modeOrOptions as PathMode;
		options = maybeOptions;
	}
	else {
		options = modeOrOptions as ListenerOptions | undefined;
	}

	// Wrap the listener with scheduling and QoL options
	let unsubscribe: (() => void) | undefined;
	const opts = options ?? {};
	const scheduleInvoke = (fn: () => void) => {
		if (opts.schedule === 'microtask')
			queueMicrotask(fn);
		else
			fn();
	};

	let calledOnce = false;
	let debounceTimer: any = null;
	let throttleTimer: any = null;
	let nextAllowed = 0;
	let pendingArgs: [string[], any, any, ChangeMeta | undefined] | null = null;

	const invoke = (args: [string[], any, any, ChangeMeta | undefined]) => {
		if (opts.once && calledOnce)
			return;

		scheduleInvoke(() => {
			listener(...args);
			if (opts.once) {
				calledOnce = true;
				// Proactively unsubscribe to release references
				if (unsubscribe)
					unsubscribe();
			}
		});
	};

	const effectiveListener: ChangeListener = (path, newValue, oldValue, meta) => {
		const args: [string[], any, any, ChangeMeta | undefined] = [ path, newValue, oldValue, meta ];
		if (opts.debounceMs != null && opts.debounceMs >= 0) {
			pendingArgs = args;
			if (debounceTimer)
				clearTimeout(debounceTimer);

			debounceTimer = setTimeout(() => {
				const a = pendingArgs!;
				pendingArgs = null;
				invoke(a);
			}, opts.debounceMs);

			return;
		}

		if (opts.throttleMs != null && opts.throttleMs > 0) {
			const now = Date.now();
			if (now >= nextAllowed) {
				nextAllowed = now + opts.throttleMs;
				invoke(args);
			}
			else {
				pendingArgs = args;
				if (!throttleTimer) {
					throttleTimer = setTimeout(() => {
						throttleTimer = null;
						const a = pendingArgs!;
						pendingArgs = null;
						nextAllowed = Date.now() + (opts.throttleMs ?? 0);
						invoke(a);
					}, Math.max(0, nextAllowed - now));
				}
			}

			return;
		}

		// default immediate
		invoke(args);
	};

	if (segs.length === 0) {
		bucket.global.add(effectiveListener);

		unsubscribe = () => {
			bucket.global.delete(effectiveListener);
			cleanupListenerBucket(root, bucket);
		};

		return unsubscribe;
	}

	_addListenerToTrie(bucket.trie, segs, mode, effectiveListener);

	unsubscribe = () => {
		_removeListenerFromTrie(bucket.trie, segs, mode, effectiveListener);
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
	const st = pauseState.get(root);
	if (st)
		st.paused = true;
	else
		pauseState.set(root, { paused: true, queue: [] });
};

observe.resume = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const st = pauseState.get(root);
	if (!st)
		return;

	// Deliver queued notifications in FIFO order
	const q = st.queue.splice(0, st.queue.length);
	st.paused = false;
	for (const { listener, args } of q)
		listener(...args);
};

observe.flush = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const st = pauseState.get(root);
	if (!st || st.queue.length === 0)
		return;

	const q = st.queue.splice(0, st.queue.length);
	for (const { listener, args } of q)
		listener(...args);
};

// --- Public history APIs ---
observe.getHistory = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;

	return (historyCache.get(root) ?? []).slice();
};

observe.clearHistory = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	historyCache.delete(root);

	lastUngrouped.delete(root);
	clearRedoInternal(root);
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
	clearRedoInternal(root);
};

observe.markPristine = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	originalSnapshotCache.set(root, cloneWithOptions(root, root));
	historyCache.delete(root);

	lastUngrouped.delete(root);
	clearRedoInternal(root);
};

observe.undo = (obj: object, steps: number = Number.POSITIVE_INFINITY) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const history = historyCache.get(root);
	if (!history || history.length === 0)
		return;

	suspendWrites(root);
	try {
		let remaining = steps;
		const undone: ChangeRecord[] = [];
		while (history.length > 0 && remaining > 0) {
			const rec = history.pop()!;

			// Helper to traverse to node at path
			const getAtPath = (rootNode: any, p: string[]) => {
				let node = rootNode;
				for (const seg of p) {
					if (node == null)
						return undefined;

					node = node[seg as any];
				}

				return node;
			};

			// Collection-aware undo
			if (rec.collection === 'map') {
				const m: Map<any, any> | undefined = getAtPath(root as any, rec.path);
				if (m && m instanceof Map) {
					if (rec.type === 'set') {
						if (rec.existedBefore === false)
							m.delete(rec.key);
						else
							m.set(rec.key, rec.oldValue);
					}
					else if (rec.type === 'delete') {
						m.set(rec.key, rec.oldValue);
					}
				}
			}
			else if (rec.collection === 'set') {
				const s: Set<any> | undefined = getAtPath(root as any, rec.path);
				if (s && s instanceof Set) {
					if (rec.type === 'set')
						s.delete(rec.key);
					else if (rec.type === 'delete')
						s.add(rec.key);
				}
			}
			else {
				ensureParents(root as any, rec.path);
				if (rec.type === 'set') {
					if (rec.existedBefore === false)
						deleteAtPath(root as any, rec.path);
					else
						setAtPath(root as any, rec.path, rec.oldValue);
				}
				else if (rec.type === 'delete') {
					// If the path points into an array at a numeric index, use splice to re-insert
					const parentAndKey = getParentAndKey(root as any, rec.path);
					if (parentAndKey) {
						const [ parent, key ] = parentAndKey;
						if (Array.isArray(parent) && isArrayIndexKey(String(key)))
							(parent as any).splice(Number(key), 0, rec.oldValue);
						else
							setAtPath(root as any, rec.path, rec.oldValue);
					}
				}
			}

			remaining--;
			undone.push(rec);
		}
		if (undone.length > 0)
			getRedo(root).push(...undone);
	}
	finally {
		resumeWrites(root);
	}
};

// Convenience: undo everything recorded after a previous history length marker
observe.undoSince = (obj: object, historyLengthBefore: number) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const history = historyCache.get(root);
	if (!history)
		return;

	const steps = Math.max(0, history.length - Math.max(0, historyLengthBefore | 0));
	if (steps > 0)
		observe.undo(root, steps);

	lastUngrouped.delete(root);
};

// --- Diff and pristine helpers ---
type DiffKind = 'added' | 'removed' | 'changed';
interface DiffRecord {
	path:      string[];
	kind:      DiffKind;
	oldValue?: any;
	newValue?: any;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const diffValues = (
	a: any,
	b: any,
	path: string[],
	out: DiffRecord[],
	root: object,
	seen = new WeakMap<object, object>(),
) => {
	const opts = getOptions(root);
	const equal = opts.compare ?? ((x: any, y: any) => Object.is(x, y));
	const filter = opts.diffFilter;

	const f = filter ? filter(path) : true;
	if (f === false)
		return; // skip subtree
	if (f === 'shallow') {
		if (!equal(a, b, path))
			out.push({ path: path.slice(), kind: 'changed', oldValue: a, newValue: b });

		return;
	}

	if (equal(a, b, path))
		return;

	if (isObject(a) && isObject(b)) {
		if (seen.get(a as object) === (b as object))
			return;

		seen.set(a as object, b as object);

		const aKeyMap: Map<string, PropertyKey> = new Map();
		for (const k of Reflect.ownKeys(a))
			aKeyMap.set(normalizePropertyKey(k), k);
		const bKeyMap: Map<string, PropertyKey> = new Map();
		for (const k of Reflect.ownKeys(b))
			bKeyMap.set(normalizePropertyKey(k), k);

		const aKeys = new Set(aKeyMap.keys());
		const bKeys = new Set(bKeyMap.keys());

		for (const nk of aKeys) {
			const nextPath = [ ...path, nk ];
			if (!bKeys.has(nk))
				out.push({ path: nextPath, kind: 'removed', oldValue: (a as any)[aKeyMap.get(nk)!] });
			else
				diffValues((a as any)[aKeyMap.get(nk)!], (b as any)[bKeyMap.get(nk)!], nextPath, out, root, seen);
		}
		for (const nk of bKeys) {
			if (!aKeys.has(nk))
				out.push({ path: [ ...path, nk ], kind: 'added', newValue: (b as any)[bKeyMap.get(nk)!] });
		}

		return;
	}

	out.push({ path: path.slice(), kind: 'changed', oldValue: a, newValue: b });
};

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
	const history = historyCache.get(root);

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
				const h = historyCache.get(root);
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
				const h = historyCache.get(root);
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
	lastUngrouped.delete(root);
};

observe.commitBatch = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const frames = batchStack.get(root);
	if (!frames || frames.length === 0)
		return;

	frames.pop();
	if (frames.length === 0)
		batchStack.delete(root);

	lastUngrouped.delete(root);
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

	lastUngrouped.delete(root);
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
	const history = historyCache.get(root);
	if (!history || history.length === 0)
		return;

	const toUndo = Math.max(0, groups | 0);
	if (toUndo === 0)
		return;

	let steps = 0;
	const seen: Set<string> = new Set();
	for (let i = history.length - 1; i >= 0; i--) {
		const gid = (history[i]!.groupId ?? `__g#${ i }`);
		if (seen.size === toUndo && !seen.has(gid))
			break;

		seen.add(gid);
		steps++;
	}

	if (steps > 0)
		observe.undo(root, steps);

	lastUngrouped.delete(root);
};

// --- Redo APIs ---
observe.canUndo = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;

	return (historyCache.get(root) ?? []).length > 0;
};

observe.canRedo = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;

	return (redoCache.get(root) ?? []).length > 0;
};

observe.clearRedo = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	clearRedoInternal(root);
};

// Apply a change record forward (redo side) without emitting notifications
const applyForward = (root: any, rec: ChangeRecord) => {
	const getAtPath = (rootNode: any, p: string[]) => {
		let node = rootNode;
		for (const seg of p) {
			if (node == null)
				return undefined;

			node = node[seg as any];
		}

		return node;
	};

	if (rec.collection === 'map') {
		const m: Map<any, any> | undefined = getAtPath(root, rec.path);
		if (m && m instanceof Map) {
			if (rec.type === 'set')
				m.set(rec.key, rec.newValue);
			else if (rec.type === 'delete')
				m.delete(rec.key);
		}

		return;
	}

	if (rec.collection === 'set') {
		const s: Set<any> | undefined = getAtPath(root, rec.path);
		if (s && s instanceof Set) {
			if (rec.type === 'set')
				s.add(rec.key);
			else if (rec.type === 'delete')
				s.delete(rec.key);
		}

		return;
	}

	if (rec.type === 'set') {
		setAtPath(root, rec.path, rec.newValue);
	}
	else if (rec.type === 'delete') {
		const parentAndKey = getParentAndKey(root, rec.path);
		if (parentAndKey) {
			const [ parent, key ] = parentAndKey;
			if (Array.isArray(parent) && isArrayIndexKey(String(key)))
				(parent as any).splice(Number(key), 1);
			else
				Reflect.deleteProperty(parent, key as any);
		}
	}
};

observe.redo = (obj: object, steps: number = Number.POSITIVE_INFINITY) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const redo = redoCache.get(root);
	if (!redo || redo.length === 0)
		return;

	suspendWrites(root);
	try {
		let remaining = steps;
		const gid = nextGroupId(root);
		while (redo.length > 0 && remaining > 0) {
			const rec = redo.pop()!; // get earliest undone first due to push order
			applyForward(root as any, rec);
			const history = ensureHistory(root);
			const copy: ChangeRecord = { ...rec, groupId: gid, timestamp: Date.now() };
			history.push(copy);
			remaining--;
		}
	}
	finally {
		resumeWrites(root);
	}

	lastUngrouped.delete(root);
};

observe.redoGroups = (obj: object, groups: number = 1) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const redo = redoCache.get(root);
	if (!redo || redo.length === 0)
		return;

	const toRedo = Math.max(0, groups | 0);
	if (toRedo === 0)
		return;

	suspendWrites(root);
	try {
		let doneGroups = 0;
		while (redo.length > 0 && doneGroups < toRedo) {
			const lastGid = redo[redo.length - 1]!.groupId ?? `__g#${ redo.length - 1 }`;
			const gidNew = nextGroupId(root);
			// pop until group boundary changes
			while (redo.length > 0) {
				const rec = redo[redo.length - 1]!;
				const recG = rec.groupId ?? `__g#${ redo.length - 1 }`;
				if (recG !== lastGid)
					break;

				redo.pop();
				applyForward(root as any, rec);
				const history = ensureHistory(root);
				history.push({ ...rec, groupId: gidNew, timestamp: Date.now() });
			}
			doneGroups++;
		}
	}
	finally {
		resumeWrites(root);
	}

	lastUngrouped.delete(root);
};

// --- Options/configure API ---
/* eslint-disable key-spacing */
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
	},
) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const prev = optionsCache.get(root) ?? {};
	optionsCache.set(root, { ...prev, ...options });
	if (!options.mergeUngrouped)
		lastUngrouped.delete(root);
};
/* eslint-enable key-spacing */
