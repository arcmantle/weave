import { type ChronicleHistoryOptions, clearLastUngrouped, defaultHistoryOptions } from './history.ts';


export interface ChronicleOptions extends ChronicleHistoryOptions {
	// Future non-history options can be added here
}

const optionsCache: WeakMap<object, ChronicleOptions> = new WeakMap();

const defaultOptions: ChronicleOptions = {
	...defaultHistoryOptions,
	// Future default options can be added here
};

export const getOptions = (root: object): ChronicleOptions => {
	const opts = optionsCache.get(root);
	if (!opts)
		return defaultOptions;

	return {
		...defaultOptions,
		...opts,
	};
};

export const setOptions = (root: object, options: ChronicleOptions): void => {
	optionsCache.set(root, options);
};

export type ConfigureOptions = Partial<ChronicleOptions>;


/**
 * Configure per-root observe behavior by merging options and managing mergeUngrouped window reset.
 */
export const configureRoot = (root: object, options: ConfigureOptions): void => {
	const prev = getOptions(root);
	setOptions(root, { ...prev, ...options });

	if (options.mergeUngrouped === false)
		clearLastUngrouped(root);
};
