import { type ChronicleApiMethods, createApiMethods } from './api-methods.ts';
import { type BatchAPI, createBatchTransaction } from './batch-transaction.ts';
import { type ConfigureOptions, configureRoot } from './config.ts';
import type { ProxyFactory } from './proxy-factory.ts';
import { createProxyFactory } from './proxy-factory.ts';
import { cloneWithOptions, originalSnapshotCache } from './snapshot-diff.ts';


export interface ChronicleCoreDeps {
	getBatchFrames: (root: object) => { marker: number; id: string; }[] | undefined;
}

export interface ChronicleCore {
	chronicle: Chronicle;
	getRoot:   (obj: object) => object;
}


export interface Chronicle extends Omit<BatchAPI, 'getBatchFrames'>, ChronicleApiMethods {
	<T extends object>(object: T, options?: ConfigureOptions): T;
}


export const createChronicle = (): Chronicle => {
	const proxyToRoot: WeakMap<object, object> = new WeakMap();
	let proxyFactory: ProxyFactory | undefined;

	const chronicle = ((object, options?) => {
		const alreadyProxied = proxyToRoot.has(object);
		const root = proxyToRoot.get(object) ?? object;
		if (!proxyFactory) {
			proxyFactory = createProxyFactory({
				getBatchFrames: (r) => batchApi.getBatchFrames(r),
				setProxyRoot:   (proxy, r) => proxyToRoot.set(proxy, r),
			});
		}

		if (options)
			configureRoot(root, options);

		if (!originalSnapshotCache.has(root))
			originalSnapshotCache.set(root, cloneWithOptions(root, root));

		if (alreadyProxied)
			return object;

		return proxyFactory.createProxy(root, [], root);
	}) as Chronicle;

	const getRoot = (obj: object): object => proxyToRoot.get(obj) ?? obj;
	const batchApi = createBatchTransaction({ chronicle, getRoot });
	const api = createApiMethods({ getRoot });

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
	chronicle.beginBatch    = (obj) => batchApi.beginBatch(getRoot(obj));
	chronicle.commitBatch   = (obj) => batchApi.commitBatch(getRoot(obj));
	chronicle.rollbackBatch = (obj) => batchApi.rollbackBatch(getRoot(obj));

	return chronicle;
};
