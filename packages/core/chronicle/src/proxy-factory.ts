import { captureShrinkRemovals, deleteIndex, isArrayIndexDeletion } from './array-mutations.ts';
import { adaptMapMethod, adaptSetMethod } from './collection-adapters.ts';
import { getOptions } from './config.ts';
import { computeActiveGroupId } from './grouping.ts';
import { recordArrayShrinkDeletes, recordDelete, recordSet } from './history-recorder.ts';
import { computeAffectedListeners } from './listener-affinity.ts';
import { getListenerBucket } from './listener-trie.ts';
import { normalizeKey } from './path.ts';
import { pathKeyOf } from './path-key.ts';
import { clear as clearProxyCacheInternal, getCached, invalidateAt, setCached } from './proxy-cache.ts';
import { notifyListeners } from './schedule-queue.ts';
import type { ChangeMeta } from './types.ts';


export interface ProxyFactoryDeps {
	getBatchFrames: (root: object) => { marker: number; id: string; }[] | undefined;
	setProxyRoot:   (proxy: object, root: object) => void;
}

export interface ProxyFactory {
	createProxy:       <O extends object>(targetObject: O, path: string[] | undefined, rootObject: object) => O;
	invalidateCacheAt: (root: object, basePath: string[], alsoParentArray?: boolean) => void;
	clearProxyCache:   (root: object) => void;
}


export const invalidateCacheAt: typeof invalidateAt = invalidateAt;
export const clearProxyCache: typeof clearProxyCacheInternal = clearProxyCacheInternal;


export const createProxyFactory = (deps: ProxyFactoryDeps): ProxyFactory => {
	const createProxy: ProxyFactory['createProxy'] = (targetObject, path = [], rootObject) => {
		const opts = getOptions(rootObject);
		if (opts.cacheProxies) {
			const pathKey = pathKeyOf(path);
			const cached = getCached(rootObject, pathKey);
			if (cached)
				return cached;
		}

		const proxy = new Proxy(targetObject, {
			get(target, prop) {
				const result = Reflect.get(target, prop);

				// Map/Set adapters: wrap mutating methods and bind non-mutators to raw target for brand checks
				const isMap = target instanceof Map;
				const isSet = target instanceof Set;
				if ((isMap || isSet) && typeof result === 'function') {
					const method = String(prop);
					const currentPath = path.slice(); // collection lives at this path

					if (isMap) {
						const adapted = adaptMapMethod(target as Map<any, any>, currentPath, rootObject, deps, method);
						if (adapted)
							return adapted;
					}

					if (isSet) {
						const adapted = adaptSetMethod(target as Set<any>, currentPath, rootObject, deps, method);
						if (adapted)
							return adapted;
					}

					// For other methods, bind to raw target to satisfy brand checks
					return (result as (...args: any[]) => any).bind(target);
				}
				if (!result || typeof result !== 'object')
					return result;

				const currentPath = [ ...path, normalizeKey(prop) ];

				return createProxy(result, currentPath, rootObject);
			},
			set(target, prop, value) {
				const currentPath = [ ...path, normalizeKey(prop) ];
				const hadBefore = Reflect.has(target, prop);
				const oldValue = Reflect.get(target, prop);

				// Capture elements that will be removed if shrinking array length
				let removedForLengthShrink: { index: number; value: any; }[] | null = null;
				if (
					Array.isArray(target)
					&& normalizeKey(prop) === 'length'
					&& typeof oldValue === 'number'
					&& typeof value === 'number'
					&& value < oldValue
				)
					removedForLengthShrink = captureShrinkRemovals(target, oldValue, value);


				const result = Reflect.set(target, prop, value);
				const bucket = getListenerBucket(rootObject);
				const activeGroupId = computeActiveGroupId(rootObject, deps.getBatchFrames);

				// Record change in history
				recordSet(rootObject, currentPath, oldValue, value, hadBefore, activeGroupId);

				// If we shrank array length, synthesize delete records for removed indices
				if (removedForLengthShrink && removedForLengthShrink.length > 0)
					recordArrayShrinkDeletes(rootObject, path, removedForLengthShrink, activeGroupId);

				// Invalidate proxy cache for this path; if shrinking array length, also invalidate the array base
				const shrinkingArray = Array.isArray(target)
					&& normalizeKey(prop) === 'length'
					&& typeof oldValue === 'number'
					&& typeof value === 'number'
					&& value < oldValue;

				invalidateAt(rootObject, currentPath, shrinkingArray);

				if (bucket) {
					const affectedListeners = computeAffectedListeners(rootObject, currentPath);
					const meta: ChangeMeta = { type: 'set', existedBefore: hadBefore, groupId: activeGroupId };
					notifyListeners(rootObject, affectedListeners, [ currentPath, value, oldValue, meta ]);
				}

				return result;
			},
			deleteProperty(target, prop) {
				const key = normalizeKey(prop);
				const currentPath = [ ...path, key ];
				const oldValue = Reflect.get(target, prop);
				const hadBefore = Reflect.has(target, prop);
				let result: boolean;

				// If deleting from an array by numeric index, use splice to avoid holes (parity with undo behavior)
				if (isArrayIndexDeletion(target, key)) {
					const idx = Number(key);
					result = deleteIndex(rootObject, target as any[], idx);
				}
				else {
					result = Reflect.deleteProperty(target, prop);
				}

				const bucket = getListenerBucket(rootObject);
				const activeGroupId = computeActiveGroupId(rootObject, deps.getBatchFrames);

				// Record change in history
				recordDelete(rootObject, currentPath, oldValue, activeGroupId);

				// Invalidate proxy cache for this path and, for array index splice case, also for the array base
				const isArrayIndex = isArrayIndexDeletion(target, key);
				invalidateAt(rootObject, currentPath, isArrayIndex);

				// Notify listeners (deletes affect exact path only and descendants no longer exist)
				if (bucket) {
					const affectedListeners = computeAffectedListeners(rootObject, currentPath);
					const meta: ChangeMeta = { type: 'delete', existedBefore: hadBefore, groupId: activeGroupId };
					notifyListeners(rootObject, affectedListeners, [ currentPath, undefined, oldValue, meta ]);
				}

				return result;
			},
		});

		deps.setProxyRoot(proxy, rootObject);

		// Store in cache if enabled
		if (opts.cacheProxies) {
			const pathKey = pathKeyOf(path);
			setCached(rootObject, pathKey, proxy);
		}

		return proxy;
	};

	return { createProxy, invalidateCacheAt, clearProxyCache };
};
