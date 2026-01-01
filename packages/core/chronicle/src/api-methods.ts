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
	/**
	 * Subscribe to changes at a specific path in the object. The listener is called whenever
	 * the selected property or any of its descendants change. Returns an unsubscribe function.
	 *
	 * @param object - The chronicled object to listen to
	 * @param selector - Function that selects the path to watch (e.g., `obj => obj.user.name`)
	 * @param listener - Callback invoked on changes with (path, newValue, oldValue, meta)
	 * @returns Unsubscribe function to stop listening
	 *
	 * @example
	 * ```ts
	 * const unsubscribe = chronicle.listen(state, s => s.count, (path, newVal, oldVal) => {
	 *   console.log(`count changed from ${oldVal} to ${newVal}`);
	 * });
	 * ```
	 */
	listen<T extends object>(object: T, selector: PathSelector<T>, listener: ChangeListener): () => void;
	/**
	 * Subscribe to changes at a specific path with listener options like debouncing or throttling.
	*
	* @param object - The chronicled object to listen to
	* @param selector - Function that selects the path to watch
	* @param listener - Callback invoked on changes
	* @param options - Listener configuration (once, debounceMs, throttleMs, schedule)
	* @returns Unsubscribe function
	*/
	// eslint-disable-next-line @typescript-eslint/unified-signatures
	listen<T extends object>(object: T, selector: PathSelector<T>, listener: ChangeListener, options: ListenerOptions): () => void;
	/**
	 * Subscribe to changes at a specific path with a traversal mode.
	 *
	 * @param object - The chronicled object to listen to
	 * @param selector - Function that selects the path to watch
	 * @param listener - Callback invoked on changes
	 * @param mode - Path matching mode: 'exact' (only this path), 'up' (ancestors), 'down' (descendants)
	 * @returns Unsubscribe function
	 */
	// eslint-disable-next-line @typescript-eslint/unified-signatures
	listen<T extends object>(object: T, selector: PathSelector<T>, listener: ChangeListener, mode: PathMode): () => void;
	/**
	 * Subscribe to changes at a specific path with both traversal mode and listener options.
	 *
	 * @param object - The chronicled object to listen to
	 * @param selector - Function that selects the path to watch
	 * @param listener - Callback invoked on changes
	 * @param mode - Path matching mode: 'exact', 'up', or 'down'
	 * @param options - Listener configuration (once, debounceMs, throttleMs, schedule)
	 * @returns Unsubscribe function
	 */
	// eslint-disable-next-line @stylistic/max-len, @typescript-eslint/unified-signatures
	listen<T extends object>(object: T, selector: PathSelector<T>, listener: ChangeListener, mode: PathMode, options: ListenerOptions): () => void;

	/**
	 * Subscribe to all changes on the object, regardless of path. Useful for broad monitoring.
	 *
	 * @param obj - The chronicled object to listen to
	 * @param listener - Callback invoked on any change with (path, newValue, oldValue, meta)
	 * @param options - Optional listener configuration (once, debounceMs, throttleMs, schedule)
	 * @returns Unsubscribe function to stop listening
	 */
	onAny: (obj: object, listener: ChangeListener, options?: ListenerOptions) => () => void;

	/**
	 * Temporarily pause change notifications for this object. Changes still occur and are
	 * recorded in history, but listeners won't be notified until resume() is called.
	 *
	 * @param obj - The chronicled object to pause
	 */
	pause: (obj: object) => void;

	/**
	 * Resume change notifications that were paused. Accumulated changes are not batched;
	 * call flush() if you want to trigger pending notifications immediately.
	 *
	 * @param obj - The chronicled object to resume
	 */
	resume: (obj: object) => void;

	/**
	 * Immediately flush any pending change notifications that are scheduled asynchronously.
	 * Useful when you need synchronous notification delivery.
	 *
	 * @param obj - The chronicled object to flush
	 */
	flush: (obj: object) => void;

	/**
	 * Get a copy of the complete change history for this object. Each record contains
	 * path, type, oldValue, newValue, timestamp, and groupId for undo/redo operations.
	 *
	 * @param obj - The chronicled object
	 * @returns Array of change records (copy, safe to modify)
	 */
	getHistory: (obj: object) => ChangeRecord[];

	/**
	 * Clear all change history and redo cache. The object's current state is preserved,
	 * but undo/redo will no longer work until new changes are made.
	 *
	 * @param obj - The chronicled object
	 */
	clearHistory: (obj: object) => void;

	/**
	 * Reset the object to its pristine state (the state when first chronicled or when
	 * markPristine was last called). This is an un-doable operation.
	 *
	 * @param obj - The chronicled object to reset
	 */
	reset: (obj: object) => void;

	/**
	 * Mark the current state as the new pristine baseline. Clears history and resets the
	 * snapshot used for diff() and reset(). Useful after saving to server or committing changes.
	 *
	 * @param obj - The chronicled object
	 */
	markPristine: (obj: object) => void;

	/**
	 * Get the differences between the current state and the pristine state. Returns an array
	 * of changes showing what was added, removed, or modified.
	 *
	 * @param obj - The chronicled object
	 * @returns Array of diff records with path, kind ('added'|'removed'|'changed'), and values
	 */
	diff: (obj: object) => DiffRecord[];

	/**
	 * Check if the object has any changes from its pristine state. Returns true if the object
	 * matches its original or last markPristine() state.
	 *
	 * @param obj - The chronicled object
	 * @returns True if no changes exist, false otherwise
	 */
	isPristine: (obj: object) => boolean;

	/**
	 * Create a deep clone snapshot of the current state. The snapshot is a plain object,
	 * not a chronicle proxy, and can be serialized or stored independently.
	 *
	 * @param obj - The chronicled object
	 * @returns Deep clone of the current state
	 */
	snapshot: <T extends object>(obj: T) => T;

	/**
	 * Get the original unwrapped object (removes the chronicle proxy). Use with caution:
	 * changes to the unwrapped object won't be tracked or trigger listeners.
	 *
	 * @param obj - The chronicled object
	 * @returns The underlying object without proxy wrapper
	 */
	unwrap: <T extends object>(obj: T) => T;

	/**
	 * Perform a three-way merge between the pristine state (base), current state (ours),
	 * and incoming changes (theirs). Detects conflicts and allows resolution strategies.
	 * Useful for syncing local changes with server updates.
	 *
	 * @param obj - The chronicled object
	 * @param incomingObject - The incoming state to merge
	 * @param resolutions - Optional conflict resolution strategies per path
	 * @returns Merge result with success status, conflicts array, and count of applied changes
	 */
	merge: (obj: object, incomingObject: object, resolutions?: ConflictResolutions) => MergeResult;

	/**
	 * Get a marker representing the current history length. Use with undoSince() to undo
	 * changes made after this point. Useful for transaction-like rollback behavior.
	 *
	 * @param obj - The chronicled object
	 * @returns Current history length (marker value)
	 */
	mark: (obj: object) => number;

	/**
	 * Undo the last N changes (or all changes if steps not specified). Changes are undone
	 * individually. For grouped operations, use undoGroups() instead.
	 *
	 * @param obj - The chronicled object
	 * @param steps - Number of changes to undo (default: all)
	 */
	undo: (obj: object, steps?: number) => void;

	/**
	 * Undo all changes made since the specified marker. The marker should come from mark().
	 * This undoes everything after that point in history.
	 *
	 * @param obj - The chronicled object
	 * @param historyLengthBefore - The marker value from mark()
	 */
	undoSince: (obj: object, historyLengthBefore: number) => void;

	/**
	 * Undo the last N undo groups (batches/transactions). Unlike undo() which works on
	 * individual changes, this respects the grouping from batches and transactions.
	 *
	 * @param obj - The chronicled object
	 * @param groups - Number of groups to undo (default: 1)
	 */
	undoGroups: (obj: object, groups?: number) => void;

	/**
	 * Check if undo is available (history has changes that can be undone).
	 *
	 * @param obj - The chronicled object
	 * @returns True if undo is possible, false otherwise
	 */
	canUndo: (obj: object) => boolean;

	/**
	 * Check if redo is available (there are undone changes that can be reapplied).
	 *
	 * @param obj - The chronicled object
	 * @returns True if redo is possible, false otherwise
	 */
	canRedo: (obj: object) => boolean;

	/**
	 * Clear the redo cache, making undone changes un-re-doable. The object's current state
	 * and undo history are preserved.
	 *
	 * @param obj - The chronicled object
	 */
	clearRedo: (obj: object) => void;

	/**
	 * Redo the last N undone changes (or all undone changes if steps not specified).
	 * Changes are redone individually.
	 *
	 * @param obj - The chronicled object
	 * @param steps - Number of changes to redo (default: all)
	 */
	redo: (obj: object, steps?: number) => void;

	/**
	 * Redo the last N undo groups. Unlike redo() which works on individual changes,
	 * this respects the grouping from batches and transactions.
	 *
	 * @param obj - The chronicled object
	 * @param groups - Number of groups to redo (default: 1)
	 */
	redoGroups: (obj: object, groups?: number) => void;

	/**
	 * Configure chronicle options for this object. Options include history limits, merge
	 * behavior, custom clone/compare functions, and proxy caching. Can be called multiple
	 * times; new options are merged with existing ones.
	 *
	 * @param obj - The chronicled object
	 * @param options - Configuration options to apply
	 */
	configure: (obj: object, options: ConfigureOptions) => void;
}

export const createApiMethods = (deps: ApiDeps): ChronicleApiMethods => {
	// listen/onAny
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

	// pause/resume/flush
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

	// history
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

	// reset/markPristine/diff/pristine
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
		const original = originalSnapshotCache.get(root) ?? cloneWithOptions(root, root);
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

		return cloneWithOptions(root, root) as typeof obj;
	};

	const unwrap: ChronicleApiMethods['unwrap'] = (obj) => {
		const root = deps.getRoot(obj);

		return root as typeof obj;
	};

	const merge: ChronicleApiMethods['merge'] = (obj, incomingObject, resolutions?) => {
		const root = deps.getRoot(obj);

		return threeWayMerge(root, obj, incomingObject, resolutions);
	};

	// marks/undo/redo
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
