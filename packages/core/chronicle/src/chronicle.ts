import { createChronicleCore } from './api.ts';
import { createApiMethods } from './api-methods.ts';
import { createBatchTransaction } from './batch-transaction.ts';
import { type ConfigureOptions, configureRoot } from './config.ts';
import type { ChangeListener, ChangeRecord, DiffRecord, ListenerOptions, PathMode, PathSelector } from './types.ts';


interface Chronicle {
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
	transaction<T extends object, R>(object: T, action: (observed: T) => R): TransactionResult<R>;
	transactionAsync<T extends object, R>(object: T, action: (observed: T) => Promise<R>): Promise<TransactionResult<R>>;
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

interface TransactionResult<R> {
	result: R;
	marker: number;
	undo:   () => void;
}

const core = createChronicleCore({ getBatchFrames: r => batchApi.getBatchFrames(r) });
const chronicle = core.chronicle as Chronicle;

const batchApi = createBatchTransaction(core);
const api = createApiMethods({ getRoot: core.getRoot });

chronicle.listen       = api.listen;
chronicle.onAny        = api.onAny;
chronicle.pause        = api.pause;
chronicle.resume       = api.resume;
chronicle.flush        = api.flush;
chronicle.getHistory   = api.getHistory;
chronicle.clearHistory = api.clearHistory;
chronicle.reset        = api.reset;
chronicle.markPristine = api.markPristine;
chronicle.undo         = api.undo;
chronicle.undoSince    = api.undoSince;
chronicle.diff         = api.diff;
chronicle.isPristine   = api.isPristine;
chronicle.mark         = api.mark;
chronicle.undoGroups   = api.undoGroups;
chronicle.canUndo      = api.canUndo;
chronicle.canRedo      = api.canRedo;
chronicle.clearRedo    = api.clearRedo;
chronicle.redo         = api.redo;
chronicle.redoGroups   = api.redoGroups;


chronicle.transaction = <T extends object, R>(object: T, action: (observed: T) => R) =>
	batchApi.transaction(object, action);
chronicle.transactionAsync = async <T extends object, R>(object: T, action: (observed: T) => Promise<R>) =>
	batchApi.transactionAsync(object, action);
chronicle.beginBatch = (obj) => batchApi.beginBatch(core.getRoot(obj));
chronicle.commitBatch = (obj) => batchApi.commitBatch(core.getRoot(obj));
chronicle.rollbackBatch = (obj) => batchApi.rollbackBatch(core.getRoot(obj));
chronicle.batch = <T extends object, R>(object: T, action: (observed: T) => R) =>
	batchApi.batch(object, action);


chronicle.configure = (obj: object, options: ConfigureOptions) => {
	const root = core.getRoot(obj);
	configureRoot(root, options);
};

export { chronicle };
export type { Chronicle };
