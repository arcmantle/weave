/**
 * Document Cache
 *
 * Caches HTML region detection results per document version to avoid
 * re-parsing on every provider invocation during the same edit cycle.
 */
import * as vscode from 'vscode';

import { detectHTMLRegions, DetectorOptions, HTMLRegion } from './html-region-detector';


interface CacheEntry {
	version: number;
	regions: HTMLRegion[];
}

const cache: Map<string, CacheEntry> = new Map();


/** Get (or compute) HTML regions for a document, caching by version. */
export function getRegions(
	document: vscode.TextDocument,
	options: Partial<DetectorOptions> = {},
): HTMLRegion[] {
	const key = document.uri.toString();
	const existing = cache.get(key);

	if (existing && existing.version === document.version)
		return existing.regions;

	const regions = detectHTMLRegions(
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
