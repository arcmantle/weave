import { resolveValueProvider } from '../function/value-provider.js';


type Provider<T> = T | (() => T);


const createMap     = <K, V>(): Map<K, V> => new Map<K, V>();
const createWeakMap = <K extends object, V>(): WeakMap<K, V> => new WeakMap<K, V>();
const createSet     = <T>(): Set<T> => new Set<T>();
const createWeakSet = <T extends object>(): WeakSet<T> => new WeakSet<T>();


export const lazyMap: {
	/**
	 * Get a `TValue` from the `map`, and add it first if it doesn't already exist in the map.
	 * @param map - The map containing values.
	 * @param key - The key to use when retrieving a value.
	 * @param valueProvider - The creator function or value to
	 * use when the key does not already exist in the map.
	 * @param retrieveAction - An optional action to
	 * perform on the value when it already exists in the map.
	 */
	<TMap extends Map<any, any>>(
		map: TMap,
		key: Parameters<TMap['get']>['0'],
		valueProvider: Provider<Exclude<ReturnType<TMap['get']>, undefined>>,
		retrieveAction?: (value: Exclude<ReturnType<TMap['get']>, undefined>) => void,
	): Exclude<ReturnType<TMap['get']>, undefined>;

	createMap:     typeof createMap;
	createWeakMap: typeof createWeakMap;
	createSet:     typeof createSet;
	createWeakSet: typeof createWeakSet;
} = (map, key, valueProvider, retrieveAction) => {
	if (map.has(key)) {
		const val = map.get(key)!;
		retrieveAction?.(val);

		return val;
	}

	const val = resolveValueProvider(valueProvider);
	map.set(key, val);

	return val;
};
lazyMap.createMap     = createMap;
lazyMap.createWeakMap = createWeakMap;
lazyMap.createSet     = createSet;
lazyMap.createWeakSet = createWeakSet;


export const lazyWeakmap: {
	/**
	 * Wrapper for mapGetLazy that accepts weak map.
	 *
	 * {@link lazyMap}
	 */
	<TMap extends WeakMap<object, any>>(
		map: TMap,
		key: Parameters<TMap['get']>['0'],
		valueProvider: Provider<Exclude<ReturnType<TMap['get']>, undefined>>,
		retrieveAction?: (value: Exclude<ReturnType<TMap['get']>, undefined>) => void,
	): Exclude<ReturnType<TMap['get']>, undefined>;

	createMap:     typeof createMap;
	createWeakMap: typeof createWeakMap;
	createSet:     typeof createSet;
	createWeakSet: typeof createWeakSet;
} = (
	map,
	key,
	valueProvider,
	retrieveAction,
) => lazyMap(map as unknown as Map<any, any>, key, valueProvider, retrieveAction);

lazyWeakmap.createMap     = createMap;
lazyWeakmap.createWeakMap = createWeakMap;
lazyWeakmap.createSet     = createSet;
lazyWeakmap.createWeakSet = createWeakSet;
