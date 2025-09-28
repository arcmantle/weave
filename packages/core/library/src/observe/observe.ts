import { nameofSegments } from '../function/nameof';
import type { BatchAPI } from './batch-transaction.ts';
import { createBatchTransaction } from './batch-transaction.ts';
import { type ConfigureOptions, configureRoot } from './config.ts';
import { clearLastUngrouped, historyDelete, historyGet } from './history.ts';
import { addListenerToTrie, cleanupListenerBucket, ensureListenerBucket, removeListenerFromTrie } from './listener-trie.ts';
import type { ProxyFactory } from './proxy-factory.ts';
import { clearProxyCache as pfClearProxyCache, createProxyFactory } from './proxy-factory.ts';
import { buildEffectiveListener, flush as scheduleFlush, pause as schedulePause, resume as scheduleResume } from './schedule-queue.ts';
import { cloneWithOptions, diffValues, originalSnapshotCache } from './snapshot-diff.ts';
import type { ChangeListener, ChangeRecord, DiffRecord, ListenerOptions, PathMode, PathSelector } from './types.ts';
import { canRedo as coreCanRedo, canUndo as coreCanUndo, clearRedoCache, redo as coreRedo, redoGroups as coreRedoGroups, resumeWrites, suspendWrites, undo as coreUndo, undoGroups as coreUndoGroups, undoSince as coreUndoSince } from './undo-redo.ts';

const proxyToRoot: WeakMap<object, object> = new WeakMap();
// pause/queue state is managed in schedule-queue.ts

// --- Batching/transactions (extracted module) ---
let batchApi: BatchAPI | undefined;

// Proxy creation and cache handled by proxy-factory
let proxyFactory: ProxyFactory | undefined;

// redo cache and write suspension managed in undo-redo.ts

// --- Observability core: proxy creation ---

export interface Observe {
	<T extends object>(object: T): T;
	listen<T extends object>(
		object: T,
		selector: PathSelector<T>,
		listener: ChangeListener,
		modeOrOptions?: PathMode | ListenerOptions,
		maybeOptions?: ListenerOptions
	): () => void;
	onAny(obj: object, listener: ChangeListener, options?: ListenerOptions): () => void;
	pause(obj: object): void;
	resume(obj: object): void;
	flush(obj: object): void;
	getHistory(obj: object): ChangeRecord[];
	clearHistory(obj: object): void;
	reset(obj: object): void;
	markPristine(obj: object): void;
	undo(obj: object, steps?: number): void;
	undoSince(obj: object, historyLengthBefore: number): void;
	diff(obj: object): DiffRecord[];
	isPristine(obj: object): boolean;
	mark(obj: object): number;
	transaction<T extends object, R>(object: T, action: (observed: T) => R): { result: R; marker: number; undo: () => void; };
	transactionAsync<T extends object, R>(
		object: T,
		action: (observed: T) => Promise<R>
	): Promise<{ result: R; marker: number; undo: () => void; }>;
	beginBatch(obj: object): void;
	commitBatch(obj: object): void;
	rollbackBatch(obj: object): void;
	batch<T extends object, R>(object: T, action: (observed: T) => R): R;
	undoGroups(obj: object, groups?: number): void;
	canUndo(obj: object): boolean;
	canRedo(obj: object): boolean;
	clearRedo(obj: object): void;
	redo(obj: object, steps?: number): void;
	redoGroups(obj: object, groups?: number): void;
	configure(
		obj: object,
		options: ConfigureOptions,
	): void;
}

export const observe: Observe = ((object: any) => {
	const existingRoot = proxyToRoot.get(object as object);
	if (!proxyFactory) {
		proxyFactory = createProxyFactory({
			getBatchFrames: (r: object) => batchApi?.getBatchFrames(r),
			setProxyRoot:   (proxy: object, r: object) => proxyToRoot.set(proxy, r),
		});
	}

	// If called on an already observed proxy, return it to avoid double-proxying
	if (existingRoot) {
		if (!originalSnapshotCache.has(existingRoot))
			originalSnapshotCache.set(existingRoot, cloneWithOptions(existingRoot, existingRoot));

		return object;
	}

	const root = (object as object);
	const { createProxy } = proxyFactory;

	if (!originalSnapshotCache.has(root))
		originalSnapshotCache.set(root, cloneWithOptions(root, root));

	return createProxy(root as object, [], root);
}) as unknown as Observe;

// Initialize batch/transaction API now that observe is defined
batchApi = createBatchTransaction({
	observe: ((o: any) => observe(o)) as any,
	getRoot: (o: object) => proxyToRoot.get(o) ?? o,
});


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
	pfClearProxyCache(root);
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

observe.transaction = <T extends object, R>(object: T, action: (observed: T) => R) => batchApi!.transaction(object, action);

observe.transactionAsync = async <T extends object, R>(
	object: T,
	action: (observed: T) => Promise<R>,
) => batchApi!.transactionAsync(object, action);

// --- Batching APIs ---
observe.beginBatch = (obj: object) => batchApi.beginBatch(proxyToRoot.get(obj) ?? obj);

observe.commitBatch = (obj: object) => batchApi.commitBatch(proxyToRoot.get(obj) ?? obj);

observe.rollbackBatch = (obj: object) => batchApi.rollbackBatch(proxyToRoot.get(obj) ?? obj);

observe.batch = <T extends object, R>(object: T, action: (observed: T) => R) => batchApi!.batch(object, action);

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
observe.configure = (obj: object, options: ConfigureOptions) => {
	const root = proxyToRoot.get(obj) ?? obj;
	configureRoot(root, options);
};
/* eslint-enable key-spacing */
