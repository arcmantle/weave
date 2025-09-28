import type { ChangeListener, ListenerBucket, PathMode, PathTrieNode } from './types.ts';

// Per-root listener registry (global + trie)
const listenerCache: WeakMap<object, ListenerBucket> = new WeakMap();

export const getListenerBucket = (root: object): ListenerBucket | undefined => listenerCache.get(root);

export const ensureListenerBucket = (root: object): ListenerBucket => {
	let bucket = listenerCache.get(root);

	if (!bucket) {
		bucket = {
			global: new Set<ChangeListener>(),
			trie:   { children: new Map<string, PathTrieNode>(), modes: new Map<PathMode, Set<ChangeListener>>() },
		};
		listenerCache.set(root, bucket);
	}

	return bucket;
};

const isNodeEmpty = (node: PathTrieNode): boolean => node.children.size === 0 && (node.modes.size === 0);

export const cleanupListenerBucket = (root: object, bucket: ListenerBucket): void => {
	if (bucket.global.size === 0 && isNodeEmpty(bucket.trie))
		listenerCache.delete(root);
};

export const getOrCreateNode = (root: PathTrieNode, segs: string[]): PathTrieNode => {
	let node = root;
	for (const s of segs) {
		let next = node.children.get(s);
		if (!next) {
			next = { children: new Map<string, PathTrieNode>(), modes: new Map<PathMode, Set<ChangeListener>>() };
			node.children.set(s, next);
		}

		node = next;
	}

	return node;
};

export const getNode = (root: PathTrieNode, segs: string[]): PathTrieNode | undefined => {
	let node: PathTrieNode | undefined = root;
	for (const s of segs) {
		node = node?.children.get(s);
		if (!node)
			return undefined;
	}

	return node;
};

export const prunePathIfEmpty = (root: PathTrieNode, segs: string[]): void => {
	const stack: { seg: string; node: PathTrieNode; }[] = [];
	let node: PathTrieNode | undefined = root;
	for (const s of segs) {
		if (!node)
			return;

		stack.push({ seg: s, node });
		node = node.children.get(s);
	}
	// node is the target node
	if (!node)
		return;

	// Walk back up pruning empty nodes
	for (let i = segs.length - 1; i >= 0; i--) {
		const parent = stack[i]!.node;
		const seg = stack[i]!.seg;
		const child = parent.children.get(seg)!;
		if (child.children.size === 0 && child.modes.size === 0)
			parent.children.delete(seg);
		else
			break;
	}
};

export const addListenerToTrie = (root: PathTrieNode, segs: string[], mode: PathMode, listener: ChangeListener): PathTrieNode => {
	const node = getOrCreateNode(root, segs);
	const set = node.modes.get(mode) ?? new Set<ChangeListener>();
	set.add(listener);
	node.modes.set(mode, set);

	return node;
};

export const removeListenerFromTrie = (root: PathTrieNode, segs: string[], mode: PathMode, listener: ChangeListener): void => {
	const node = getNode(root, segs);
	if (!node)
		return;

	const set = node.modes.get(mode);
	if (set) {
		set.delete(listener);
		if (set.size === 0)
			node.modes.delete(mode);
	}

	prunePathIfEmpty(root, segs);
};
