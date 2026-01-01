import { getOptions } from './config.ts';
import { clearLastUngrouped, getLastUngrouped, nextGroupId, setLastUngrouped } from './history.ts';


/**
 * Compute the active group ID for a change.
 *
 * If inside a batch, uses the current batch frame's ID.
 * Otherwise, if mergeUngrouped is enabled and within the merge window,
 * reuses the last ungrouped ID. Otherwise generates a new group ID.
 *
 * @param root - The root object
 * @param getBatchFrames - Function to get batch frames for the root
 * @param nowProvider - Function to get current timestamp (defaults to Date.now)
 * @returns The group ID to use for the current change
 */
export const computeActiveGroupId = (
	root: object,
	getBatchFrames: (root: object) => { marker: number; id: string; }[] | undefined,
	nowProvider: () => number = Date.now,
): string => {
	const batchFrames = getBatchFrames(root);
	if (batchFrames && batchFrames.length > 0)
		return batchFrames[batchFrames.length - 1]!.id;

	const opts = getOptions(root);
	if (opts && opts.mergeUngrouped) {
		const now = nowProvider();
		const prev = getLastUngrouped(root);
		const within = opts.mergeWindowMs == null
			|| (prev ? (now - prev.at) <= opts.mergeWindowMs : false);

		if (prev && within) {
			setLastUngrouped(root, { id: prev.id, at: now });

			return prev.id;
		}

		const gid = nextGroupId(root);
		setLastUngrouped(root, { id: gid, at: now });

		return gid;
	}

	clearLastUngrouped(root);

	return nextGroupId(root);
};
