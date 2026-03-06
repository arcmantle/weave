/**
 * Offset Mapping — Pure Functions
 *
 * Bidirectional offset mapping between source files and virtual HTML documents.
 * No vscode dependency — safe to use in tests and non-extension contexts.
 */
import type { HTMLRegion } from './html-region-detector';


/**
 * Converts a virtual HTML offset to a source file offset.
 * Returns undefined if the offset falls in a placeholder region.
 */
export function virtualToSourceOffset(
	region: HTMLRegion,
	virtualOffset: number,
): number | undefined {
	// Check if the offset is in a placeholder
	for (const ph of region.placeholders) {
		if (virtualOffset >= ph.virtualStart && virtualOffset < ph.virtualEnd)
			return undefined;
	}

	// Find the mapping that contains this virtual offset
	for (const m of region.mappings) {
		if (virtualOffset >= m.virtualStart && virtualOffset <= m.virtualEnd) {
			const delta = virtualOffset - m.virtualStart;

			return m.sourceStart + delta;
		}
	}

	return undefined;
}


/**
 * Converts a source file offset to a virtual HTML offset.
 * Returns undefined if the offset is outside any mapped region.
 */
export function sourceToVirtualOffset(
	region: HTMLRegion,
	sourceOffset: number,
): number | undefined {
	for (const m of region.mappings) {
		if (sourceOffset >= m.sourceStart && sourceOffset <= m.sourceEnd) {
			const delta = sourceOffset - m.sourceStart;

			return m.virtualStart + delta;
		}
	}

	return undefined;
}


/**
 * Checks whether a given source offset falls inside the HTML region.
 */
export function isOffsetInRegion(region: HTMLRegion, sourceOffset: number): boolean {
	return sourceOffset >= region.start && sourceOffset <= region.end;
}


/**
 * Checks if a diagnostic range falls within a placeholder region
 * and should be suppressed.
 */
export function isDiagnosticInPlaceholder(
	region: HTMLRegion,
	virtualStart: number,
	virtualEnd: number,
): boolean {
	for (const ph of region.placeholders) {
		// If any part of the range overlaps a placeholder, suppress it
		if (virtualStart < ph.virtualEnd && virtualEnd > ph.virtualStart)
			return true;
	}

	return false;
}
