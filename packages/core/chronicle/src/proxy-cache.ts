import { getOptions } from './history.ts';
import { pathKeyOf } from './path-key.ts';


/**
 * Per-root proxy cache: Map<pathKey, proxy>
 * Enables stable proxy identity when cacheProxies option is enabled.
 */
const proxyCache: WeakMap<object, Map<string, any>> = new WeakMap();


/**
 * Get a cached proxy for the given root and path.
 *
 * @param root - The root object
 * @param pathKey - The path key (from pathKeyOf)
 * @returns The cached proxy, or undefined if not cached
 */
export const getCached = (root: object, pathKey: string): any | undefined => {
	const perRoot = proxyCache.get(root);

	return perRoot?.get(pathKey);
};


/**
 * Store a proxy in the cache for the given root and path.
 *
 * @param root - The root object
 * @param pathKey - The path key (from pathKeyOf)
 * @param proxy - The proxy to cache
 */
export const setCached = (root: object, pathKey: string, proxy: any): void => {
	let perRoot = proxyCache.get(root);
	if (!perRoot) {
		perRoot = new Map<string, any>();
		proxyCache.set(root, perRoot);
	}

	perRoot.set(pathKey, proxy);
};


/**
 * Invalidate cached proxies at and below the given base path.
 * Optionally also invalidates the parent path (for array shrinkage).
 *
 * @param root - The root object
 * @param basePath - The base path to invalidate
 * @param alsoParentArray - Whether to also invalidate the parent path
 */
export const invalidateAt = (root: object, basePath: string[], alsoParentArray?: boolean): void => {
	const opts = getOptions(root);
	if (!opts.cacheProxies)
		return;

	const perRoot = proxyCache.get(root);
	if (!perRoot)
		return;

	const base = pathKeyOf(basePath);
	for (const k of Array.from(perRoot.keys())) {
		if (k === base || k.startsWith(base + '\x1f'))
			perRoot.delete(k);
	}

	if (alsoParentArray) {
		const parentKey = pathKeyOf(basePath.slice(0, -1));
		for (const k of Array.from(perRoot.keys())) {
			if (k === parentKey || k.startsWith(parentKey + '\x1f'))
				perRoot.delete(k);
		}
	}
};


/**
 * Clear all cached proxies for the given root.
 *
 * @param root - The root object
 */
export const clear = (root: object): void => {
	const perRoot = proxyCache.get(root);
	if (perRoot)
		perRoot.clear();
};
