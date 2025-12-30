import type { ChronicleOptions } from './history.ts';
import { clearLastUngrouped, getOptions, setOptions } from './history.ts';


export type ConfigureOptions = ChronicleOptions;


/**
 * Configure per-root observe behavior by merging options and managing mergeUngrouped window reset.
 */
export const configureRoot = (root: object, options: ConfigureOptions): void => {
	const prev = getOptions(root) ?? {};
	setOptions(root, { ...prev, ...options });
	if (!options.mergeUngrouped)
		clearLastUngrouped(root);
};
