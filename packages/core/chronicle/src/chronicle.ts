import { createChronicleCore } from './api.ts';
import { type ChronicleApiMethods, createApiMethods } from './api-methods.ts';
import { type BatchAPI, createBatchTransaction } from './batch-transaction.ts';


interface Chronicle extends Omit<BatchAPI, 'getBatchFrames'>, ChronicleApiMethods {
	<T extends object>(object: T): T;
}

const core = createChronicleCore({ getBatchFrames: r => batchApi.getBatchFrames(r) });
const chronicle = core.chronicle as Chronicle;

const batchApi = createBatchTransaction(core);
const api = createApiMethods({ getRoot: core.getRoot });

chronicle.listen        = api.listen;
chronicle.onAny         = api.onAny;
chronicle.pause         = api.pause;
chronicle.resume        = api.resume;
chronicle.flush         = api.flush;
chronicle.getHistory    = api.getHistory;
chronicle.clearHistory  = api.clearHistory;
chronicle.reset         = api.reset;
chronicle.markPristine  = api.markPristine;
chronicle.undo          = api.undo;
chronicle.undoSince     = api.undoSince;
chronicle.diff          = api.diff;
chronicle.isPristine    = api.isPristine;
chronicle.snapshot      = api.snapshot;
chronicle.unwrap        = api.unwrap;
chronicle.merge         = api.merge;
chronicle.mark          = api.mark;
chronicle.undoGroups    = api.undoGroups;
chronicle.canUndo       = api.canUndo;
chronicle.canRedo       = api.canRedo;
chronicle.clearRedo     = api.clearRedo;
chronicle.redo          = api.redo;
chronicle.redoGroups    = api.redoGroups;
chronicle.configure     = api.configure;
chronicle.transaction   = batchApi.transaction;
chronicle.batch         = batchApi.batch;
chronicle.beginBatch    = (obj) => batchApi.beginBatch(core.getRoot(obj));
chronicle.commitBatch   = (obj) => batchApi.commitBatch(core.getRoot(obj));
chronicle.rollbackBatch = (obj) => batchApi.rollbackBatch(core.getRoot(obj));

export { chronicle };
export type { Chronicle };
