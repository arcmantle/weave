import { normalizePropertyKey } from './symbol-id.ts';


// Normalize property key to a stable string segment (symbols -> sym#id)
export const normalizeKey = (prop: PropertyKey): string => normalizePropertyKey(prop);

export const isArrayIndexKey = (k: string): boolean => /^(?:0|[1-9]\d*)$/.test(k);

export const getParentAndKey = (root: any, path: string[]): [ any, string ] | null => {
	if (path.length === 0)
		return null;

	let parent: any = root;
	for (const seg of path.slice(0, -1)) {
		if (parent == null)
			return null;

		parent = (parent as any)[seg as any];
	}

	const last = path[path.length - 1]!;

	return [ parent, last ];
};

export const setAtPath = (root: any, path: string[], value: any): void => {
	const res = getParentAndKey(root, path);
	if (!res)
		return;

	const [ parent, key ] = res;
	Reflect.set(parent, key, value);
};

export const deleteAtPath = (root: any, path: string[]): void => {
	const res = getParentAndKey(root, path);
	if (!res)
		return;

	const [ parent, key ] = res;
	if (parent == null)
		return;

	// If deleting from an array, prefer splice to avoid holes and adjust length
	if (Array.isArray(parent) && isArrayIndexKey(String(key))) {
		const idx = Number(key);
		if (Number.isInteger(idx))
			parent.splice(idx, 1);

		return;
	}

	Reflect.deleteProperty(parent, key as any);
};

export const ensureParents = (root: any, path: string[]): void => {
	let node: any = root;
	for (let i = 0; i < path.length - 1; i++) {
		const seg = path[i]!;
		let next = (node as any)[seg as any];
		if (next == null) {
			const following = path[i + 1]!;
			next = /^(?:0|[1-9]\d*)$/.test(following) ? [] : {};
			(node as any)[seg as any] = next;
		}

		node = next;
	}
};
