import type { ChronicleCore } from './api.ts';
import { clearLastUngrouped, ensureHistory, historyGet, nextGroupId } from './history.ts';
import { undoGroups, undoSince } from './undo-redo.ts';


const batchStack: WeakMap<object, BatchFrame[]> = new WeakMap();


export type BatchDeps = Pick<ChronicleCore, 'chronicle' | 'getRoot'>;

export interface BatchFrame { marker: number; id: string; }

export interface BatchAPI {
	getBatchFrames: (root: object) => BatchFrame[] | undefined;
	beginBatch:     (obj: object) => void;
	commitBatch:    (obj: object) => void;
	rollbackBatch:  (obj: object) => void;
	batch:          <T extends object, R>(object: T, action: (observed: T) => R) => R;
	transaction: <T extends object, R>(object: T, action: (observed: T) => R) =>
	{ result: R; marker: number; undo: () => void; };
	transactionAsync: <T extends object, R>(object: T, action: (observed: T) => Promise<R>) =>
	Promise<{ result: R; marker: number; undo: () => void; }>;
}


export const createBatchTransaction = (deps: BatchDeps): BatchAPI => {
	const getBatchFrames: BatchAPI['getBatchFrames'] = (root) => batchStack.get(root);

	const beginBatch: BatchAPI['beginBatch'] = (obj) => {
		const root = deps.getRoot(obj);
		const history = ensureHistory(root);
		const frames = batchStack.get(root) ?? [];
		const id = nextGroupId(root);
		frames.push({ marker: history.length, id });
		batchStack.set(root, frames);
		clearLastUngrouped(root);
	};

	const commitBatch: BatchAPI['commitBatch'] = (obj) => {
		const root = deps.getRoot(obj);
		const frames = batchStack.get(root);
		if (!frames || frames.length === 0)
			return;

		frames.pop();
		if (frames.length === 0)
			batchStack.delete(root);

		clearLastUngrouped(root);
	};

	const rollbackBatch: BatchAPI['rollbackBatch'] = (obj) => {
		const root = deps.getRoot(obj);
		const frames = batchStack.get(root);
		if (!frames || frames.length === 0)
			return;

		const frame = frames.pop()!;
		undoSince(root, frame.marker);
		if (frames.length === 0)
			batchStack.delete(root);

		clearLastUngrouped(root);
	};

	const batch: BatchAPI['batch'] = (object, action) => {
		const root = deps.getRoot(object as unknown as object);
		beginBatch(root);
		const observed = deps.chronicle(object);
		try {
			const result = action(observed);
			commitBatch(root);

			return result;
		}
		catch (err) {
			rollbackBatch(root);
			throw err;
		}
	};

	const transaction: BatchAPI['transaction'] = (object, action) => {
		const root = deps.getRoot(object as unknown as object);
		const marker = (historyGet(root) ?? []).length;

		const framesBefore = (batchStack.get(root) ?? []).length;
		const isTopLevel = framesBefore === 0;
		if (isTopLevel)
			beginBatch(root);

		const observed = deps.chronicle(object);
		let groupId: string | undefined;
		try {
			const result = action(observed);
			const frames = (batchStack.get(root) ?? []);
			groupId = frames.length > 0 ? frames[frames.length - 1]!.id : undefined;
			if (isTopLevel)
				commitBatch(root);

			return {
				result,
				marker,
				undo: () => {
					const h = historyGet(root);
					if (groupId && h && h.length > 0) {
						const topGroup = h[h.length - 1]!.groupId ?? `__g#${ h.length - 1 }`;
						if (topGroup === groupId) {
							undoGroups(root, 1);

							return;
						}
					}

					undoSince(root, marker);
				},
			};
		}
		catch (err) {
			if (isTopLevel)
				rollbackBatch(root);
			else
				undoSince(root, marker);

			throw err;
		}
	};

	const transactionAsync: BatchAPI['transactionAsync'] = async (object, action) => {
		const root = deps.getRoot(object as unknown as object);
		const marker = (historyGet(root) ?? []).length;

		const framesBefore = (batchStack.get(root) ?? []).length;
		const isTopLevel = framesBefore === 0;
		if (isTopLevel)
			beginBatch(root);

		const observed = deps.chronicle(object);
		let groupId: string | undefined;
		try {
			const result = await action(observed);
			const frames = (batchStack.get(root) ?? []);
			groupId = frames.length > 0 ? frames[frames.length - 1]!.id : undefined;
			if (isTopLevel)
				commitBatch(root);

			return {
				result,
				marker,
				undo: () => {
					const h = historyGet(root);
					if (groupId && h && h.length > 0) {
						const topGroup = h[h.length - 1]!.groupId ?? `__g#${ h.length - 1 }`;
						if (topGroup === groupId) {
							undoGroups(root, 1);

							return;
						}
					}

					undoSince(root, marker);
				},
			};
		}
		catch (err) {
			if (isTopLevel)
				rollbackBatch(root);
			else
				undoSince(root, marker);

			throw err;
		}
	};

	return {
		getBatchFrames,
		beginBatch,
		commitBatch,
		rollbackBatch,
		batch,
		transaction,
		transactionAsync,
	};
};
