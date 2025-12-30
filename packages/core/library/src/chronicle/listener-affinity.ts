import { getListenerBucket, getNode } from './listener-trie.ts';
import type { ChangeListener, PathTrieNode } from './types.ts';


/**
 * Compute the set of listeners affected by a change at the given path.
 *
 * Collects listeners in this order:
 * - Global listeners (onAny)
 * - Down listeners on the path and all ancestors (listen for descendants)
 * - Exact listeners at the exact path
 * - Up listeners on all descendants (listen for ancestors)
 *
 * @param root - The root object
 * @param path - The path where the change occurred
 * @returns Set of all affected listeners
 */
export const computeAffectedListeners = (root: object, path: string[]): Set<ChangeListener> => {
	const bucket = getListenerBucket(root);
	const affected: Set<ChangeListener> = new Set();

	if (!bucket)
		return affected;

	// Global listeners
	bucket.global.forEach(l => affected.add(l));

	const rootNode = bucket.trie;

	// Down listeners on ancestors (including root)
	{
		let node: PathTrieNode | undefined = rootNode;
		if (node && node.modes.size > 0)
			node.modes.get('down')?.forEach(l => affected.add(l));

		for (const seg of path) {
			node = node?.children.get(seg);
			if (!node)
				break;

			node.modes.get('down')?.forEach(l => affected.add(l));
		}
	}

	// Exact listeners at the path
	{
		const node = getNode(rootNode, path);
		if (node)
			node.modes.get('exact')?.forEach(l => affected.add(l));
	}

	// Up listeners on descendants (strictly deeper than path)
	{
		const start = getNode(rootNode, path);
		if (start) {
			for (const child of start.children.values()) {
				const stack: PathTrieNode[] = [ child ];
				while (stack.length) {
					const n = stack.pop()!;
					n.modes.get('up')?.forEach(l => affected.add(l));
					for (const c of n.children.values())
						stack.push(c);
				}
			}
		}
	}

	return affected;
};
