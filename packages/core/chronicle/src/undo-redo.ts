import { ensureHistory, historyGet, nextGroupId } from './history.ts';
import { deleteAtPath, ensureParents, getParentAndKey, isArrayIndexKey, setAtPath } from './path.ts';
import type { ChangeRecord } from './types.ts';


// Redo cache per root
const redoCache: WeakMap<object, ChangeRecord[]> = new WeakMap();

// Write suspension counter per root (used to avoid recording/dispatch during programmatic changes)
const suspendWriteCounter: WeakMap<object, number> = new WeakMap();

export const isSuspended = (root: object): boolean => (suspendWriteCounter.get(root) ?? 0) > 0;
export const suspendWrites = (root: object): void => { suspendWriteCounter.set(root, (suspendWriteCounter.get(root) ?? 0) + 1); };
export const resumeWrites = (root: object): void => {
	const n = (suspendWriteCounter.get(root) ?? 0) - 1;
	if (n <= 0)
		suspendWriteCounter.delete(root);
	else
		suspendWriteCounter.set(root, n);
};

const getRedo = (root: object): ChangeRecord[] => {
	let r = redoCache.get(root);
	if (!r) {
		r = [];
		redoCache.set(root, r);
	}

	return r;
};

export const clearRedoCache = (root: object): void => { redoCache.delete(root); };

export const canUndo = (root: object): boolean => (historyGet(root) ?? []).length > 0;
export const canRedo = (root: object): boolean => (redoCache.get(root) ?? []).length > 0;

// Helper to get object at path
const getAtPath = (rootNode: any, p: string[]) => {
	let node = rootNode;
	for (const seg of p) {
		if (node == null)
			return undefined;

		node = node[seg as any];
	}

	return node;
};

// Apply a change record forward (redo side) without emitting notifications
const applyForward = (root: any, rec: ChangeRecord) => {
	if (rec.collection === 'map') {
		const m: Map<any, any> | undefined = getAtPath(root, rec.path);
		if (m && m instanceof Map) {
			if (rec.type === 'set')
				m.set(rec.key, rec.newValue);
			else if (rec.type === 'delete')
				m.delete(rec.key);
		}

		return;
	}

	if (rec.collection === 'set') {
		const s: Set<any> | undefined = getAtPath(root, rec.path);
		if (s && s instanceof Set) {
			if (rec.type === 'set')
				s.add(rec.key);
			else if (rec.type === 'delete')
				s.delete(rec.key);
		}

		return;
	}

	if (rec.type === 'set') {
		setAtPath(root, rec.path, rec.newValue);
	}
	else if (rec.type === 'delete') {
		const parentAndKey = getParentAndKey(root, rec.path);
		if (parentAndKey) {
			const [ parent, key ] = parentAndKey;
			if (Array.isArray(parent) && isArrayIndexKey(String(key)))
				(parent as any).splice(Number(key), 1);
			else
				Reflect.deleteProperty(parent, key as any);
		}
	}
};

export const undo = (root: object, steps: number = Number.POSITIVE_INFINITY): void => {
	const history = historyGet(root);
	if (!history || history.length === 0)
		return;

	suspendWrites(root);
	try {
		let remaining = steps;
		const undone: ChangeRecord[] = [];
		while (history.length > 0 && remaining > 0) {
			const rec = history.pop()!;

			if (rec.collection === 'map') {
				const m: Map<any, any> | undefined = getAtPath(root as any, rec.path);
				if (m && m instanceof Map) {
					if (rec.type === 'set') {
						if (rec.existedBefore === false)
							m.delete(rec.key);
						else
							m.set(rec.key, rec.oldValue);
					}
					else if (rec.type === 'delete') {
						m.set(rec.key, rec.oldValue);
					}
				}
			}
			else if (rec.collection === 'set') {
				const s: Set<any> | undefined = getAtPath(root as any, rec.path);
				if (s && s instanceof Set) {
					if (rec.type === 'set')
						s.delete(rec.key);
					else if (rec.type === 'delete')
						s.add(rec.key);
				}
			}
			else {
				// Ensure parent containers exist for plain object/array paths
				ensureParents(root as any, rec.path);
				if (rec.type === 'set') {
					if (rec.existedBefore === false)
						deleteAtPath(root as any, rec.path);
					else
						setAtPath(root as any, rec.path, rec.oldValue);
				}
				else if (rec.type === 'delete') {
					// If the path points into an array at a numeric index, use splice to re-insert
					const parentAndKey = getParentAndKey(root as any, rec.path);
					if (parentAndKey) {
						const [ parent, key ] = parentAndKey;
						if (Array.isArray(parent) && isArrayIndexKey(String(key)))
							(parent as any).splice(Number(key), 0, rec.oldValue);
						else
							setAtPath(root as any, rec.path, rec.oldValue);
					}
				}
			}

			remaining--;
			undone.push(rec);
		}
		if (undone.length > 0)
			getRedo(root).push(...undone);
	}
	finally {
		resumeWrites(root);
	}
};

export const undoSince = (root: object, historyLengthBefore: number): void => {
	const history = historyGet(root);
	if (!history)
		return;

	const steps = Math.max(0, history.length - Math.max(0, historyLengthBefore | 0));
	if (steps > 0)
		undo(root, steps);
};

export const undoGroups = (root: object, groups: number = 1): void => {
	const history = historyGet(root);
	if (!history || history.length === 0)
		return;

	const toUndo = Math.max(0, groups | 0);
	if (toUndo === 0)
		return;

	let steps = 0;
	const seen: Set<string> = new Set();
	for (let i = history.length - 1; i >= 0; i--) {
		const gid = (history[i]!.groupId ?? `__g#${ i }`);
		if (seen.size === toUndo && !seen.has(gid))
			break;

		seen.add(gid);
		steps++;
	}

	if (steps > 0)
		undo(root, steps);
};

export const redo = (root: object, steps: number = Number.POSITIVE_INFINITY): void => {
	const redo = redoCache.get(root);
	if (!redo || redo.length === 0)
		return;

	suspendWrites(root);
	try {
		let remaining = steps;
		const gid = nextGroupId(root);
		while (redo.length > 0 && remaining > 0) {
			const rec = redo.pop()!; // get earliest undone first due to push order
			applyForward(root as any, rec);
			const history = ensureHistory(root);
			const copy: ChangeRecord = { ...rec, groupId: gid, timestamp: Date.now() };
			history.push(copy);
			remaining--;
		}
	}
	finally {
		resumeWrites(root);
	}
};

export const redoGroups = (root: object, groups: number = 1): void => {
	const redo = redoCache.get(root);
	if (!redo || redo.length === 0)
		return;

	const toRedo = Math.max(0, groups | 0);
	if (toRedo === 0)
		return;

	suspendWrites(root);
	try {
		let doneGroups = 0;
		while (redo.length > 0 && doneGroups < toRedo) {
			const lastGid = redo[redo.length - 1]!.groupId ?? `__g#${ redo.length - 1 }`;
			const gidNew = nextGroupId(root);
			// pop until group boundary changes
			while (redo.length > 0) {
				const rec = redo[redo.length - 1]!;
				const recG = rec.groupId ?? `__g#${ redo.length - 1 }`;
				if (recG !== lastGid)
					break;

				redo.pop();
				applyForward(root as any, rec);
				const history = ensureHistory(root);
				history.push({ ...rec, groupId: gidNew, timestamp: Date.now() });
			}
			doneGroups++;
		}
	}
	finally {
		resumeWrites(root);
	}
};
