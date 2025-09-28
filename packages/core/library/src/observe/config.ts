import { clearLastUngrouped, getOptions, setOptions as setObserveOptions } from './history.ts';

export interface ConfigureOptions {
	mergeUngrouped?:             boolean;
	mergeWindowMs?:              number;
	compactConsecutiveSamePath?: boolean;
	maxHistory?:                 number;
	filter?:                     (record: any) => boolean;
	clone?:                      (value: any) => any;
	compare?:                    (a: any, b: any, path: string[]) => boolean;
	diffFilter?:                 (path: string[]) => boolean | 'shallow';
	cacheProxies?:               boolean;
}

// Configure per-root observe behavior by merging options and managing mergeUngrouped window reset.
export const configureRoot = (root: object, options: ConfigureOptions): void => {
	const prev = getOptions(root) ?? {};
	setObserveOptions(root, { ...prev, ...options });
	if (!options.mergeUngrouped)
		clearLastUngrouped(root);
};
