/**
 * Extracts typed dataset attributes from an event's currentTarget.
 * Centralizes the `HTMLElement` cast and provides autocomplete for the destructured keys.
 */
export function dataAttrs<K extends string>(ev: Event, ...keys: K[]): Record<K, string | undefined> {
	const ds = (ev.currentTarget as HTMLElement).dataset;

	return Object.fromEntries(keys.map(k => [ k, ds?.[k] ])) as Record<K, string | undefined>;
}
