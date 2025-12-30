import { nameofSegments } from '@arcmantle/library/function';

import { clearLastUngrouped, historyDelete, historyGet } from './history.ts';
import { addListenerToTrie, cleanupListenerBucket, ensureListenerBucket, removeListenerFromTrie } from './listener-trie.ts';
import { clearProxyCache as pfClearProxyCache } from './proxy-factory.ts';
import { buildEffectiveListener, flush as scheduleFlush, pause as schedulePause, resume as scheduleResume } from './schedule-queue.ts';
import { cloneWithOptions, diffValues, originalSnapshotCache } from './snapshot-diff.ts';
import type { ChangeListener, ChangeRecord, DiffRecord, ListenerOptions, PathMode, PathSelector } from './types.ts';
import { canRedo as coreCanRedo, canUndo as coreCanUndo, clearRedoCache, redo as coreRedo, redoGroups as coreRedoGroups, resumeWrites, suspendWrites, undo as coreUndo, undoGroups as coreUndoGroups, undoSince as coreUndoSince } from './undo-redo.ts';


export interface ApiDeps {
	getRoot: (obj: object) => object;
}


const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;


export interface ChronicleApiMethods {
	listen: <T extends object>(
		object: T,
		selector: PathSelector<T>,
		listener: ChangeListener,
		modeOrOptions?: PathMode | ListenerOptions,
		maybeOptions?: ListenerOptions,
	) => () => void;
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
	mark:         (obj: object) => number;
	undo:         (obj: object, steps?: number) => void;
	undoSince:    (obj: object, historyLengthBefore: number) => void;
	undoGroups:   (obj: object, groups?: number) => void;
	canUndo:      (obj: object) => boolean;
	canRedo:      (obj: object) => boolean;
	clearRedo:    (obj: object) => void;
	redo:         (obj: object, steps?: number) => void;
	redoGroups:   (obj: object, groups?: number) => void;
}

export const createApiMethods = (deps: ApiDeps): ChronicleApiMethods => {
	// listen/onAny --------------------------------------------------------------
	const listen = <T extends object>(
		object: T,
		selector: PathSelector<T>,
		listener: ChangeListener,
		modeOrOptions?: PathMode | ListenerOptions,
		maybeOptions?: ListenerOptions,
	) => {
		const segs = nameofSegments(selector);
		const root = deps.getRoot(object as object);
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

	const onAny = (obj: object, listener: ChangeListener, options?: ListenerOptions): () => void => {
		return listen(obj as any, s => s as any, listener, options);
	};

	// pause/resume/flush --------------------------------------------------------
	const pause = (obj: object): void => {
		const root = deps.getRoot(obj);
		schedulePause(root);
	};

	const resume = (obj: object): void => {
		const root = deps.getRoot(obj);
		scheduleResume(root);
	};

	const flush = (obj: object): void => {
		const root = deps.getRoot(obj);
		scheduleFlush(root);
	};

	// history ------------------------------------------------------------------
	const getHistory = (obj: object): ChangeRecord[] => {
		const root = deps.getRoot(obj);

		return (historyGet(root) ?? []).slice();
	};

	const clearHistory = (obj: object): void => {
		const root = deps.getRoot(obj);
		historyDelete(root);
		clearLastUngrouped(root);
		clearRedoCache(root);
	};

	// reset/markPristine/diff/pristine ----------------------------------------
	const markPristine = (obj: object): void => {
		const root = deps.getRoot(obj);
		originalSnapshotCache.set(root, cloneWithOptions(root, root));
		historyDelete(root);
		clearLastUngrouped(root);
		clearRedoCache(root);
		pfClearProxyCache(root);
	};

	const reset = (obj: object): void => {
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

	const diff = (obj: object): DiffRecord[] => {
		const root = deps.getRoot(obj);
		const original = originalSnapshotCache.get(root) ?? cloneWithOptions(root, root as any);
		const out: DiffRecord[] = [];
		diffValues(original, root, [], out, root);

		return out;
	};

	const isPristine = (obj: object): boolean => {
		const diffs = diff(obj);

		return diffs.length === 0;
	};

	// marks/undo/redo -----------------------------------------------------------
	const mark = (obj: object): number => {
		const root = deps.getRoot(obj);
		const history = historyGet(root);

		return history ? history.length : 0;
	};

	const undo = (obj: object, steps: number = Number.POSITIVE_INFINITY): void => {
		const root = deps.getRoot(obj);
		coreUndo(root, steps);
	};

	const undoSince = (obj: object, historyLengthBefore: number): void => {
		const root = deps.getRoot(obj);
		coreUndoSince(root, historyLengthBefore);
		clearLastUngrouped(root);
	};

	const undoGroups = (obj: object, groups: number = 1): void => {
		const root = deps.getRoot(obj);
		coreUndoGroups(root, groups);
		clearLastUngrouped(root);
	};

	const canUndo = (obj: object): boolean => {
		const root = deps.getRoot(obj);

		return coreCanUndo(root);
	};

	const canRedo = (obj: object): boolean => {
		const root = deps.getRoot(obj);

		return coreCanRedo(root);
	};

	const clearRedo = (obj: object): void => {
		const root = deps.getRoot(obj);
		clearRedoCache(root);
	};

	const redo = (obj: object, steps: number = Number.POSITIVE_INFINITY): void => {
		const root = deps.getRoot(obj);
		coreRedo(root, steps);
		clearLastUngrouped(root);
	};

	const redoGroups = (obj: object, groups: number = 1): void => {
		const root = deps.getRoot(obj);
		coreRedoGroups(root, groups);
		clearLastUngrouped(root);
	};

	return {
		listen:       listen,
		onAny:        onAny,
		pause:        pause,
		resume:       resume,
		flush:        flush,
		getHistory:   getHistory,
		clearHistory: clearHistory,
		reset:        reset,
		markPristine: markPristine,
		diff:         diff,
		isPristine:   isPristine,
		mark:         mark,
		undo:         undo,
		undoSince:    undoSince,
		undoGroups:   undoGroups,
		canUndo:      canUndo,
		canRedo:      canRedo,
		clearRedo:    clearRedo,
		redo:         redo,
		redoGroups:   redoGroups,
	};
};
