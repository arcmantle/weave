/**
 * Document Cache
 *
 * Caches CSS region detection results per document version to avoid
 * re-parsing on every provider invocation during the same edit cycle.
 */
import * as vscode from 'vscode';

import { CSSRegion, detectCSSRegions, DetectorOptions } from './css-region-detector';


interface CacheEntry {
	version: number;
	regions: CSSRegion[];
}

const cache: Map<string, CacheEntry> = new Map();


/** Get (or compute) CSS regions for a document, caching by version. */
export function getRegions(
	document: vscode.TextDocument,
	options: Partial<DetectorOptions> = {},
): CSSRegion[] {
	const key = document.uri.toString();
	const existing = cache.get(key);

	if (existing && existing.version === document.version)
		return existing.regions;

	const regions = detectCSSRegions(
		document.getText(),
		document.fileName,
		options,
	);

	cache.set(key, { version: document.version, regions });

	return regions;
}


/** Invalidate cache for a specific document. */
export function invalidate(uri: string): void {
	cache.delete(uri);
}


/** Clear the entire cache. */
export function clearAll(): void {
	cache.clear();
}
