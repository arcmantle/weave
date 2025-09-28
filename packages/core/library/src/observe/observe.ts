import { createObserveCore } from './api.ts';
import { createApiMethods } from './api-methods.ts';
import { createBatchTransaction } from './batch-transaction.ts';
import { type ConfigureOptions, configureRoot } from './config.ts';
import type { ChangeListener, ChangeRecord, DiffRecord, ListenerOptions, PathMode, PathSelector } from './types.ts';


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

const core = createObserveCore({ getBatchFrames: (r: object) => batchApi?.getBatchFrames(r) });
export const observe: Observe = core.observe as Observe;

const batchApi = createBatchTransaction({ observe: core.observe, getRoot: core.getRoot });
const api = createApiMethods({ getRoot: core.getRoot });

observe.listen = api.listen;
observe.onAny = api.onAny;
observe.pause = api.pause;
observe.resume = api.resume;
observe.flush = api.flush;
observe.getHistory = api.getHistory;
observe.clearHistory = api.clearHistory;
observe.reset = api.reset;
observe.markPristine = api.markPristine;
observe.undo = api.undo;
observe.undoSince = api.undoSince;
observe.diff = api.diff;
observe.isPristine = api.isPristine;
observe.mark = api.mark;
observe.undoGroups = api.undoGroups;
observe.canUndo = api.canUndo;
observe.canRedo = api.canRedo;
observe.clearRedo = api.clearRedo;
observe.redo = api.redo;
observe.redoGroups = api.redoGroups;


observe.transaction = <T extends object, R>(object: T, action: (observed: T) => R) =>
	batchApi.transaction(object, action);
observe.transactionAsync = async <T extends object, R>(object: T, action: (observed: T) => Promise<R>) =>
	batchApi.transactionAsync(object, action);
observe.beginBatch = (obj: object) => batchApi.beginBatch(core.getRoot(obj));
observe.commitBatch = (obj: object) => batchApi.commitBatch(core.getRoot(obj));
observe.rollbackBatch = (obj: object) => batchApi.rollbackBatch(core.getRoot(obj));
observe.batch = <T extends object, R>(object: T, action: (observed: T) => R) =>
	batchApi.batch(object, action);


observe.configure = (obj: object, options: ConfigureOptions) => {
	const root = core.getRoot(obj);
	configureRoot(root, options);
};
