import { type ConfigureOptions, configureRoot } from './config.ts';
import { clearLastUngrouped, historyDelete, historyGet } from './history.ts';
import { addListenerToTrie, cleanupListenerBucket, ensureListenerBucket, removeListenerFromTrie } from './listener-trie.ts';
import { nameofSegments } from './nameof.ts';
import { clearProxyCache as pfClearProxyCache } from './proxy-factory.ts';
import { buildEffectiveListener, flush as scheduleFlush, pause as schedulePause, resume as scheduleResume } from './schedule-queue.ts';
import { cloneWithOptions, diffValues, originalSnapshotCache } from './snapshot-diff.ts';
import { threeWayMerge } from './three-way-merge.ts';
import type { ChangeListener, ChangeRecord, ConflictResolutions, DiffRecord, ListenerOptions, MergeResult, PathMode, PathSelector } from './types.ts';
import { canRedo as coreCanRedo, canUndo as coreCanUndo, clearRedoCache, redo as coreRedo, redoGroups as coreRedoGroups, resumeWrites, suspendWrites, undo as coreUndo, undoGroups as coreUndoGroups, undoSince as coreUndoSince } from './undo-redo.ts';


export interface ApiDeps {
	getRoot: (obj: object) => object;
}


const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;


export interface ChronicleApiMethods {
	listen<T extends object>(object: T, selector: PathSelector<T>, listener: ChangeListener): () => void;
	// eslint-disable-next-line @typescript-eslint/unified-signatures
	listen<T extends object>(object: T, selector: PathSelector<T>, listener: ChangeListener, options: ListenerOptions): () => void;
	// eslint-disable-next-line @typescript-eslint/unified-signatures
	listen<T extends object>(object: T, selector: PathSelector<T>, listener: ChangeListener, mode: PathMode): () => void;
	// eslint-disable-next-line @stylistic/max-len, @typescript-eslint/unified-signatures
	listen<T extends object>(object: T, selector: PathSelector<T>, listener: ChangeListener, mode: PathMode, options: ListenerOptions): () => void;
	onAny:        (obj: object, listener: ChangeListener, options?: ListenerOptions) => () => void;
	pause:        (obj: object) => void;
	resume:       (obj: object) => void;
	flush:        (obj: object) => void;
	getHistory:   (obj: object) => ChangeRecord[];
	clearHistory: (obj: object) => void;
	reset:        (obj: object) => void;
	markPristine: (obj: object) => void;
	diff:         (obj: object) => DiffRecord[];
	isPristine:   (obj: object) => boolean;
	snapshot:     <T extends object>(obj: T) => T;
	unwrap:       <T extends object>(obj: T) => T;
	merge:        (obj: object, incomingObject: object, resolutions?: ConflictResolutions) => MergeResult;
	mark:         (obj: object) => number;
	undo:         (obj: object, steps?: number) => void;
	undoSince:    (obj: object, historyLengthBefore: number) => void;
	undoGroups:   (obj: object, groups?: number) => void;
	canUndo:      (obj: object) => boolean;
	canRedo:      (obj: object) => boolean;
	clearRedo:    (obj: object) => void;
	redo:         (obj: object, steps?: number) => void;
	redoGroups:   (obj: object, groups?: number) => void;
	configure:    (obj: object, options: ConfigureOptions) => void;
}

export const createApiMethods = (deps: ApiDeps): ChronicleApiMethods => {
	// listen/onAny --------------------------------------------------------------
	const listen: ChronicleApiMethods['listen'] = (
		object,
		selector,
		listener,
		modeOrOptions?: PathMode | ListenerOptions,
		maybeOptions?: ListenerOptions,
	) => {
		const segs = nameofSegments(selector);
		const root = deps.getRoot(object);
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

	const onAny: ChronicleApiMethods['onAny'] = (obj, listener, options) => {
		return listen(obj, s => s, listener, options!);
	};

	// pause/resume/flush --------------------------------------------------------
	const pause: ChronicleApiMethods['pause'] = (obj) => {
		const root = deps.getRoot(obj);
		schedulePause(root);
	};

	const resume: ChronicleApiMethods['resume'] = (obj) => {
		const root = deps.getRoot(obj);
		scheduleResume(root);
	};

	const flush: ChronicleApiMethods['flush'] = (obj) => {
		const root = deps.getRoot(obj);
		scheduleFlush(root);
	};

	// history ------------------------------------------------------------------
	const getHistory: ChronicleApiMethods['getHistory'] = (obj) => {
		const root = deps.getRoot(obj);

		return (historyGet(root) ?? []).slice();
	};

	const clearHistory: ChronicleApiMethods['clearHistory'] = (obj) => {
		const root = deps.getRoot(obj);
		historyDelete(root);
		clearLastUngrouped(root);
		clearRedoCache(root);
	};

	// reset/markPristine/diff/pristine ----------------------------------------
	const markPristine: ChronicleApiMethods['markPristine'] = (obj) => {
		const root = deps.getRoot(obj);
		originalSnapshotCache.set(root, cloneWithOptions(root, root));
		historyDelete(root);
		clearLastUngrouped(root);
		clearRedoCache(root);
		pfClearProxyCache(root);
	};

	const reset: ChronicleApiMethods['reset'] = (obj) => {
		const root = deps.getRoot(obj);
		const snapshot = originalSnapshotCache.get(root);
		if (!snapshot) {
			markPristine(root);

			return;
		}

		const overwriteDeep = (target: any, source: any) => {
			if (Array.isArray(target) && Array.isArray(source)) {
				target.length = source.length;
				for (let i = 0; i < source.length; i++)
					target[i] = cloneWithOptions(root, source[i]);

				return;
			}

			const isPlainObject = (v: any) => Object.prototype.toString.call(v) === '[object Object]';
			if (isObject(target) && isObject(source) && isPlainObject(target) && isPlainObject(source)) {
				for (const k of Reflect.ownKeys(target)) {
					if (!Object.prototype.hasOwnProperty.call(source, k))
						// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
						delete (target as any)[k as any];
				}
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

			for (const k of Reflect.ownKeys(target))
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete (target as any)[k];
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

		markPristine(root);
		clearRedoCache(root);
	};

	const diff: ChronicleApiMethods['diff'] = (obj) => {
		const root = deps.getRoot(obj);
		const original = originalSnapshotCache.get(root) ?? cloneWithOptions(root, root as any);
		const out: DiffRecord[] = [];
		diffValues(original, root, [], out, root);

		return out;
	};

	const isPristine: ChronicleApiMethods['isPristine'] = (obj) => {
		const diffs = diff(obj);

		return diffs.length === 0;
	};

	const snapshot: ChronicleApiMethods['snapshot'] = (obj) => {
		const root = deps.getRoot(obj);

		return cloneWithOptions(root, root) as any;
	};

	const unwrap: ChronicleApiMethods['unwrap'] = (obj) => {
		const root = deps.getRoot(obj);

		return root as any;
	};

	const merge: ChronicleApiMethods['merge'] = (obj, incomingObject, resolutions?) => {
		const root = deps.getRoot(obj);

		return threeWayMerge(root, obj, incomingObject, resolutions);
	};

	// marks/undo/redo -----------------------------------------------------------
	const mark: ChronicleApiMethods['mark'] = (obj) => {
		const root = deps.getRoot(obj);
		const history = historyGet(root);

		return history ? history.length : 0;
	};

	const undo: ChronicleApiMethods['undo'] = (obj, steps = Number.POSITIVE_INFINITY) => {
		const root = deps.getRoot(obj);
		coreUndo(root, steps);
	};

	const undoSince: ChronicleApiMethods['undoSince'] = (obj, historyLengthBefore) => {
		const root = deps.getRoot(obj);
		coreUndoSince(root, historyLengthBefore);
		clearLastUngrouped(root);
	};

	const undoGroups: ChronicleApiMethods['undoGroups'] = (obj, groups = 1) => {
		const root = deps.getRoot(obj);
		coreUndoGroups(root, groups);
		clearLastUngrouped(root);
	};

	const canUndo: ChronicleApiMethods['canUndo'] = (obj) => {
		const root = deps.getRoot(obj);

		return coreCanUndo(root);
	};

	const canRedo: ChronicleApiMethods['canRedo'] = (obj) => {
		const root = deps.getRoot(obj);

		return coreCanRedo(root);
	};

	const clearRedo: ChronicleApiMethods['clearRedo'] = (obj) => {
		const root = deps.getRoot(obj);
		clearRedoCache(root);
	};

	const redo: ChronicleApiMethods['redo'] = (obj, steps = Number.POSITIVE_INFINITY) => {
		const root = deps.getRoot(obj);
		coreRedo(root, steps);
		clearLastUngrouped(root);
	};

	const redoGroups: ChronicleApiMethods['redoGroups'] = (obj, groups = 1) => {
		const root = deps.getRoot(obj);
		coreRedoGroups(root, groups);
		clearLastUngrouped(root);
	};

	const configure: ChronicleApiMethods['configure'] = (obj, options) => {
		const root = deps.getRoot(obj);
		configureRoot(root, options);
	};

	return {
		listen,
		onAny,
		pause,
		resume,
		flush,
		getHistory,
		clearHistory,
		reset,
		markPristine,
		diff,
		isPristine,
		snapshot,
		unwrap,
		merge,
		mark,
		undo,
		undoSince,
		undoGroups,
		canUndo,
		canRedo,
		clearRedo,
		redo,
		redoGroups,
		configure,
	};
};
