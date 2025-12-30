import type { ProxyFactory } from './proxy-factory.ts';
import { createProxyFactory } from './proxy-factory.ts';
import { cloneWithOptions, originalSnapshotCache } from './snapshot-diff.ts';


export interface ChronicleCoreDeps {
	getBatchFrames: (root: object) => { marker: number; id: string; }[] | undefined;
}

export interface ChronicleCore {
	chronicle: <T extends object>(object: T) => T;
	getRoot:   (obj: object) => object;
}


export const createChronicleCore = (deps: ChronicleCoreDeps): ChronicleCore => {
	const proxyToRoot: WeakMap<object, object> = new WeakMap();
	let proxyFactory: ProxyFactory | undefined;

	const chronicle = (object => {
		const existingRoot = proxyToRoot.get(object);
		if (!proxyFactory) {
			proxyFactory = createProxyFactory({
				getBatchFrames: (r) => deps.getBatchFrames(r),
				setProxyRoot:   (proxy, r) => proxyToRoot.set(proxy, r),
			});
		}

		// If called on an already observed proxy, return it to avoid double-proxying
		if (existingRoot) {
			if (!originalSnapshotCache.has(existingRoot)) {
				originalSnapshotCache.set(
					existingRoot,
					cloneWithOptions(existingRoot, existingRoot),
				);
			}

			return object;
		}

		const root = (object as object);
		const { createProxy } = proxyFactory!;

		if (!originalSnapshotCache.has(root))
			originalSnapshotCache.set(root, cloneWithOptions(root, root));

		return createProxy(root as object, [], root);
	}) as (<T extends object>(object: T) => T);

	const getRoot = (obj: object): object => proxyToRoot.get(obj) ?? obj;

	return { chronicle: chronicle, getRoot };
};
