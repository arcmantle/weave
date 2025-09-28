import { getOptions } from './history.ts';
import { normalizeKey } from './path.ts';
import type { DiffRecord } from './types.ts';

// Original snapshot for diff/isPristine
export const originalSnapshotCache: WeakMap<object, any> = new WeakMap();

// Deep clone utility honoring options.clone and falling back to structuredClone
export const deepClone = <T>(v: T): T => {
	try {
		return structuredClone(v) as T;
	}
	catch {
		return v;
	}
};

export const cloneWithOptions = <T>(root: object, v: T): T => {
	const opts = getOptions(root);
	if (opts.clone) {
		try {
			return opts.clone(v);
		}
		catch { /* fall through */ }
	}

	return deepClone(v);
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export const diffValues = (
	a: any,
	b: any,
	path: string[],
	out: DiffRecord[],
	root: object,
	seenParam?: WeakMap<object, object>,
): void => {
	const opts = getOptions(root);
	const equal = opts.compare ?? ((x: any, y: any) => Object.is(x, y));
	const filter = opts.diffFilter;
	const seen = seenParam ?? new WeakMap<object, object>();

	const f = filter ? filter(path) : true;
	if (f === false)
		return; // skip subtree
	if (f === 'shallow') {
		if (!equal(a, b, path))
			out.push({ path: path.slice(), kind: 'changed', oldValue: a, newValue: b });

		return;
	}

	if (equal(a, b, path))
		return;

	if (isObject(a) && isObject(b)) {
		if (seen.get(a as object) === (b as object))
			return;

		seen.set(a as object, b as object);

		const aKeyMap: Map<string, PropertyKey> = new Map();
		for (const k of Reflect.ownKeys(a))
			aKeyMap.set(normalizeKey(k), k);
		const bKeyMap: Map<string, PropertyKey> = new Map();
		for (const k of Reflect.ownKeys(b))
			bKeyMap.set(normalizeKey(k), k);

		const aKeys = new Set(aKeyMap.keys());
		const bKeys = new Set(bKeyMap.keys());

		for (const nk of aKeys) {
			const nextPath = [ ...path, nk ];
			if (!bKeys.has(nk))
				out.push({ path: nextPath, kind: 'removed', oldValue: (a as any)[aKeyMap.get(nk)!] });
			else
				diffValues((a as any)[aKeyMap.get(nk)!], (b as any)[bKeyMap.get(nk)!], nextPath, out, root, seen);
		}
		for (const nk of bKeys) {
			if (!aKeys.has(nk))
				out.push({ path: [ ...path, nk ], kind: 'added', newValue: (b as any)[bKeyMap.get(nk)!] });
		}

		return;
	}

	out.push({ path: path.slice(), kind: 'changed', oldValue: a, newValue: b });
};
