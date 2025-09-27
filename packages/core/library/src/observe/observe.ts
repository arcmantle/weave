import { nameofSegments } from '../function/nameof';

type ChangeListener = (path: string[], newValue: any, oldValue: any) => void;

type PathSelector<T> = (object: T) => any;

type PathMode = 'exact' | 'up' | 'down';

interface ListenerBucket {
	global: Set<ChangeListener>;
	// Keyed by a stable stringified representation of the path segments
	// Value stores the original segments and the mode->listeners map
	paths:  Map<string, { segs: string[]; modes: Map<PathMode, Set<ChangeListener>>; }>;
}

const listenerCache: WeakMap<object, ListenerBucket> = new WeakMap();
const proxyToRoot: WeakMap<object, object> = new WeakMap();

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
}

const historyCache: WeakMap<object, ChangeRecord[]> = new WeakMap();
const suspendWriteCounter: WeakMap<object, number> = new WeakMap();
const batchStack: WeakMap<object, { marker: number; id: string; }[]> = new WeakMap();
const groupCounter: WeakMap<object, number> = new WeakMap();
/* eslint-disable key-spacing */
const optionsCache: WeakMap<object, {
	mergeUngrouped?:             boolean;
	mergeWindowMs?:              number;
	compactConsecutiveSamePath?: boolean;
}> = new WeakMap();
/* eslint-enable key-spacing */
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

// Deep clone utility for snapshotting
const deepClone = <T>(v: T): T => {
	try {
		return structuredClone(v) as T;
	}
	catch { /* ignore */ }

	try {
		return JSON.parse(JSON.stringify(v)) as T;
	}
	catch {
		return v;
	}
};

const ensureListenerBucket = (root: object): ListenerBucket => {
	let bucket = listenerCache.get(root);

	if (!bucket) {
		bucket = {
			global: new Set<ChangeListener>(),
			paths:  new Map<string, { segs: string[]; modes: Map<PathMode, Set<ChangeListener>>; }>(),
		};
		listenerCache.set(root, bucket);
	}

	return bucket;
};

const cleanupListenerBucket = (root: object, bucket: ListenerBucket) => {
	if (bucket.global.size === 0 && bucket.paths.size === 0)
		listenerCache.delete(root);
};

// --- Path helpers (segment-based matching) ---
type Path = string[];

// stable key for segment arrays without ambiguity from '.' in segment text
const keyFromSegments = (segs: Path): string => JSON.stringify(segs);

const pathEquals = (a: Path, b: Path): boolean => {
	if (a.length !== b.length)
		return false;

	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i])
			return false;
	}

	return true;
};

// prefix is a prefix of full (or equal)
const isPrefix = (prefix: Path, full: Path): boolean => {
	if (prefix.length > full.length)
		return false;

	for (let i = 0; i < prefix.length; i++) {
		if (prefix[i] !== full[i])
			return false;
	}

	return true;
};

/* eslint-disable key-spacing */
export const observe: (<T extends object>(object: T) => T) & {
	listen: <T extends object>(object: T, selector: PathSelector<T>, listener: ChangeListener, mode?: PathMode) => () => void;
} & {
	getHistory:   (object: object) => readonly ChangeRecord[];
	clearHistory: (object: object) => void;
	undo:         (object: object, steps?: number) => void;
	undoSince:    (object: object, historyLengthBefore: number) => void;
	undoGroups:   (object: object, groups?: number) => void;
	diff:         (object: object) => readonly DiffRecord[];
	isPristine:   (object: object) => boolean;
	markPristine: (object: object) => void;
	mark:         (object: object) => number;
	transaction:   <T extends object, R>(object: T, action: (observed: T) => R) => {
		result: R;
		undo:   () => void;
		marker: number;
	};
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
		}
	) => void;
} /* eslint-enable key-spacing */ = object => {
	// Capture original snapshot once per root
	if (!originalSnapshotCache.has(object as object))
		originalSnapshotCache.set(object as object, deepClone(object));

	const createProxy = <O extends object>(targetObject: O, path: string[] = [], rootObject: object = object) => {
		const proxy = new Proxy(targetObject, {
			get(target, prop) {
				const result = Reflect.get(target, prop);
				if (!result || typeof result !== 'object')
					return result;

				const currentPath = [ ...path, String(prop) ];

				return createProxy(result, currentPath, rootObject);
			},
			set(target, prop, value) {
				const currentPath = [ ...path, String(prop) ];
				const hadBefore = Reflect.has(target, prop);
				const oldValue = Reflect.get(target, prop);
				// capture elements that will be removed if shrinking array length
				let removedForLengthShrink: { index: number; value: any; }[] | null = null;
				if (
					Array.isArray(target)
					&& String(prop) === 'length'
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
					history.push({
						path:          currentPath.slice(),
						type:          'set',
						oldValue,
						newValue:      value,
						timestamp:     Date.now(),
						existedBefore: hadBefore,
						groupId:       activeGroupId,
					});

					// If we shrank array length, synthesize delete records for removed indices
					if (removedForLengthShrink && removedForLengthShrink.length > 0) {
						const basePath = path.slice();
						for (const { index, value: oldVal } of removedForLengthShrink) {
							history.push({
								path:      [ ...basePath, String(index) ],
								type:      'delete',
								oldValue:  oldVal,
								newValue:  undefined,
								timestamp: Date.now(),
								groupId:   activeGroupId,
							});
						}
					}

					// Optional compaction: merge consecutive sets on the same path within the same group
					const opts = optionsCache.get(rootObject);
					if (opts && opts.compactConsecutiveSamePath && history.length >= 2) {
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
				}

				if (bucket) {
					const affectedListeners: Set<ChangeListener> = new Set();

					bucket.global.forEach(listener => affectedListeners.add(listener));

					if (bucket.paths.size > 0) {
						bucket.paths.forEach(entry => {
							const watchedSegs = entry.segs;
							const exact = entry.modes.get('exact');
							if (exact && pathEquals(currentPath, watchedSegs))
								exact.forEach((l: ChangeListener) => affectedListeners.add(l));

							const down = entry.modes.get('down');
							if (down && isPrefix(watchedSegs, currentPath))
								down.forEach((l: ChangeListener) => affectedListeners.add(l));

							const up = entry.modes.get('up');
							if (up && isPrefix(currentPath, watchedSegs) && currentPath.length < watchedSegs.length)
								up.forEach((l: ChangeListener) => affectedListeners.add(l));
						});
					}

					affectedListeners.forEach(listener => listener(currentPath, value, oldValue));
				}

				return result;
			},
			deleteProperty(target, prop) {
				const currentPath = [ ...path, String(prop) ];
				const oldValue = Reflect.get(target, prop);
				const result = Reflect.deleteProperty(target, prop);
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
					history.push({
						path:      currentPath.slice(),
						type:      'delete',
						oldValue,
						newValue:  undefined,
						timestamp: Date.now(),
						groupId:   activeGroupId,
					});
				}

				// Notify listeners (deletes affect exact path only and descendants no longer exist)
				if (bucket) {
					const affectedListeners: Set<ChangeListener> = new Set();
					bucket.global.forEach(listener => affectedListeners.add(listener));
					if (bucket.paths.size > 0) {
						bucket.paths.forEach(entry => {
							const watchedSegs = entry.segs;
							const exact = entry.modes.get('exact');
							if (exact && pathEquals(currentPath, watchedSegs))
								exact.forEach((l: ChangeListener) => affectedListeners.add(l));

							const down = entry.modes.get('down');
							if (down && isPrefix(watchedSegs, currentPath))
								down.forEach((l: ChangeListener) => affectedListeners.add(l));

							const up = entry.modes.get('up');
							if (up && isPrefix(currentPath, watchedSegs) && currentPath.length < watchedSegs.length)
								up.forEach((l: ChangeListener) => affectedListeners.add(l));
						});
					}

					affectedListeners.forEach(listener => listener(currentPath, undefined, oldValue));
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
	mode: PathMode = 'down',
) => {
	const segs = nameofSegments(selector);
	const root = proxyToRoot.get(object as object) ?? (object as object);
	const bucket = ensureListenerBucket(root);
	const key = keyFromSegments(segs);

	if (segs.length === 0) {
		bucket.global.add(listener);

		return () => {
			bucket.global.delete(listener);
			cleanupListenerBucket(root, bucket);
		};
	}

	let entry = bucket.paths.get(key);
	if (!entry) {
		entry = { segs: segs.slice(), modes: new Map<PathMode, Set<ChangeListener>>() };
		bucket.paths.set(key, entry);
	}

	const set = entry.modes.get(mode) ?? new Set<ChangeListener>();
	set.add(listener);
	entry.modes.set(mode, set);

	return () => {
		set.delete(listener);
		if (set.size === 0) {
			entry!.modes.delete(mode);
			if (entry!.modes.size === 0)
				bucket.paths.delete(key);
		}

		cleanupListenerBucket(root, bucket);
	};
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
};

observe.markPristine = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	originalSnapshotCache.set(root, deepClone(root as any));
	historyCache.delete(root);

	lastUngrouped.delete(root);
};

observe.undo = (obj: object, steps: number = Number.POSITIVE_INFINITY) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const history = historyCache.get(root);
	if (!history || history.length === 0)
		return;

	suspendWrites(root);
	try {
		let remaining = steps;
		while (history.length > 0 && remaining > 0) {
			const rec = history.pop()!;
			ensureParents(root as any, rec.path);
			if (rec.type === 'set') {
				if (rec.existedBefore === false)
					deleteAtPath(root as any, rec.path);
				else
					setAtPath(root as any, rec.path, rec.oldValue);
			}
			else if (rec.type === 'delete') {
				setAtPath(root as any, rec.path, rec.oldValue);
			}

			remaining--;
		}
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

const diffValues = (a: any, b: any, path: string[], out: DiffRecord[], seen = new WeakMap<object, object>()) => {
	if (Object.is(a, b))
		return;

	if (isObject(a) && isObject(b)) {
		if (seen.get(a as object) === (b as object))
			return;

		seen.set(a as object, b as object);

		const aKeys = new Set(Object.keys(a));
		const bKeys = new Set(Object.keys(b));
		for (const k of aKeys) {
			const nextPath = [ ...path, k ];
			if (!bKeys.has(k))
				out.push({ path: nextPath, kind: 'removed', oldValue: (a as any)[k] });
			else
				diffValues((a as any)[k], (b as any)[k], nextPath, out, seen);
		}
		for (const k of bKeys) {
			if (!aKeys.has(k))
				out.push({ path: [ ...path, k ], kind: 'added', newValue: (b as any)[k] });
		}

		return;
	}

	// primitives or different types
	out.push({ path: path.slice(), kind: 'changed', oldValue: a, newValue: b });
};

observe.diff = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const original = originalSnapshotCache.get(root) ?? deepClone(root as any);
	const out: DiffRecord[] = [];
	diffValues(original, root, [], out);

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

	// Begin a batch for the transaction
	observe.beginBatch(root);
	const observed = observe(object);

	let groupId: string | undefined;
	try {
		const result = action(observed);
		// Capture current batch id before commit
		const frames = (batchStack.get(root) ?? []);
		groupId = frames.length > 0 ? frames[frames.length - 1]!.id : undefined;
		observe.commitBatch(root);

		return {
			result,
			marker,
			undo: () => {
				// If the transaction's group is still the top-most, undo one group; otherwise fallback to marker
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
		// Roll back the batch entirely
		observe.rollbackBatch(root);
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

// --- Options/configure API ---
/* eslint-disable key-spacing */
observe.configure = (
	obj: object,
	options: {
		mergeUngrouped?:             boolean;
		mergeWindowMs?:              number;
		compactConsecutiveSamePath?: boolean;
	},
) => {
	const root = proxyToRoot.get(obj) ?? obj;
	const prev = optionsCache.get(root) ?? {};
	optionsCache.set(root, { ...prev, ...options });
	if (!options.mergeUngrouped)
		lastUngrouped.delete(root);
};
/* eslint-enable key-spacing */
