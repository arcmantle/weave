/*
 * Stable per-process symbol identity mapping used for path normalization.
 * Distinct symbols map to unique ids (sym#N), avoiding description-based collisions.
 */

const symbolIds: WeakMap<symbol, string> = new WeakMap();
let symbolCounter = 0;

export const getSymbolId = (s: symbol): string => {
	let id = symbolIds.get(s);
	if (!id) {
		id = `sym#${ ++symbolCounter }`;
		symbolIds.set(s, id);
	}

	return id;
};

export const normalizePropertyKey = (prop: PropertyKey): string =>
	typeof prop === 'symbol' ? getSymbolId(prop) : String(prop);
