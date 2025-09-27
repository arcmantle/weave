import { nameof } from '../function/nameof';

type ChangeListener = (path: string[], newValue: any, oldValue: any) => void;

type PathSelector<T> = (object: T) => any;

type PathMode = 'exact' | 'up' | 'down';

interface ListenerBucket {
	global: Set<ChangeListener>;
	paths:  Map<string, Map<PathMode, Set<ChangeListener>>>;
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
}

const historyCache: WeakMap<object, ChangeRecord[]> = new WeakMap();
const suspendWriteCounter: WeakMap<object, number> = new WeakMap();

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
		const sc = (globalThis as unknown as { structuredClone?: (x: unknown) => unknown; }).structuredClone;
		if (typeof sc === 'function')
			return sc(v) as T;
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
			paths:  new Map<string, Map<PathMode, Set<ChangeListener>>>(),
		};
		listenerCache.set(root, bucket);
	}

	return bucket;
};

const cleanupListenerBucket = (root: object, bucket: ListenerBucket) => {
	if (bucket.global.size === 0 && bucket.paths.size === 0)
		listenerCache.delete(root);
};


export const observe: (<T extends object>(object: T) => T) & {
	listen: <T extends object>(object: T, selector: PathSelector<T>, listener: ChangeListener, mode?: PathMode) => () => void;
} & {
	getHistory:   (object: object) => readonly ChangeRecord[];
	clearHistory: (object: object) => void;
	undo:         (object: object, steps?: number) => void;
	undoSince:    (object: object, historyLengthBefore: number) => void;
	diff:         (object: object) => readonly DiffRecord[];
	isPristine:   (object: object) => boolean;
	markPristine: (object: object) => void;
	mark:         (object: object) => number;
	transaction:  <T extends object, R>(object: T, action: (observed: T) => R) => { result: R; undo: () => void; marker: number; };
} = object => {
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
				const pathKey = currentPath.join('.');
				const bucket = listenerCache.get(rootObject);

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
							});
						}
					}
				}

				if (bucket) {
					const affectedListeners: Set<ChangeListener> = new Set();

					bucket.global.forEach(listener => affectedListeners.add(listener));

					if (bucket.paths.size > 0) {
						bucket.paths.forEach((modeMap, watchedPath) => {
							const exact = modeMap.get('exact');
							if (exact && pathKey === watchedPath)
								exact.forEach(l => affectedListeners.add(l));

							const down = modeMap.get('down');
							if (down && (pathKey === watchedPath || pathKey.startsWith(`${ watchedPath }.`)))
								down.forEach(l => affectedListeners.add(l));

							const up = modeMap.get('up');
							if (up && (watchedPath === pathKey || watchedPath.startsWith(`${ pathKey }.`)))
								up.forEach(l => affectedListeners.add(l));
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

				if (!isSuspended(rootObject)) {
					const history = ensureHistory(rootObject);
					history.push({
						path:      currentPath.slice(),
						type:      'delete',
						oldValue,
						newValue:  undefined,
						timestamp: Date.now(),
					});
				}

				// Notify listeners (deletes affect exact path only and descendants no longer exist)
				if (bucket) {
					const affectedListeners: Set<ChangeListener> = new Set();
					bucket.global.forEach(listener => affectedListeners.add(listener));
					if (bucket.paths.size > 0) {
						const pathKey = currentPath.join('.');
						bucket.paths.forEach((modeMap, watchedPath) => {
							const exact = modeMap.get('exact');
							if (exact && pathKey === watchedPath)
								exact.forEach(l => affectedListeners.add(l));

							const down = modeMap.get('down');
							if (down && (pathKey === watchedPath || pathKey.startsWith(`${ watchedPath }.`)))
								down.forEach(l => affectedListeners.add(l));

							const up = modeMap.get('up');
							if (up && (watchedPath === pathKey || watchedPath.startsWith(`${ pathKey }.`)))
								up.forEach(l => affectedListeners.add(l));
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
	const path = nameof(selector);
	const root = proxyToRoot.get(object as object) ?? (object as object);
	const bucket = ensureListenerBucket(root);

	if (path.length === 0) {
		bucket.global.add(listener);

		return () => {
			bucket.global.delete(listener);
			cleanupListenerBucket(root, bucket);
		};
	}

	const modeMap = bucket.paths.get(path) ?? new Map<PathMode, Set<ChangeListener>>();
	const set = modeMap.get(mode) ?? new Set<ChangeListener>();
	set.add(listener);
	modeMap.set(mode, set);
	bucket.paths.set(path, modeMap);

	return () => {
		set.delete(listener);
		if (set.size === 0) {
			modeMap.delete(mode);
			if (modeMap.size === 0)
				bucket.paths.delete(path);
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
};

observe.markPristine = (obj: object) => {
	const root = proxyToRoot.get(obj) ?? obj;
	originalSnapshotCache.set(root, deepClone(root as any));
	historyCache.delete(root);
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
	// capture a marker and run action; on error rollback to marker
	const root = (proxyToRoot.get(object as object) ?? (object as object));
	const marker = observe.mark(root);
	const observed = observe(object);

	try {
		const result = action(observed);

		return {
			result,
			marker,
			undo: () => observe.undoSince(root, marker),
		};
	}
	catch (err) {
		observe.undoSince(root, marker);
		throw err;
	}
};
