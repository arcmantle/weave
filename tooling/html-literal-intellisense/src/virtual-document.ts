/**
 * Virtual Document Manager
 *
 * Manages virtual HTML documents for each detected HTML region, providing
 * bidirectional offset mapping between source ↔ virtual HTML positions.
 *
 * Pure offset functions (no vscode dependency) are in offset-mapping.ts.
 * This module re-exports them and adds vscode-dependent helpers.
 */
import * as vscode from 'vscode';

import type { HTMLRegion } from './html-region-detector';

export {
	isDiagnosticInPlaceholder,
	isOffsetInRegion,
	sourceToVirtualOffset,
	virtualToSourceOffset,
} from './offset-mapping';
import { isOffsetInRegion, virtualToSourceOffset } from './offset-mapping';
import { sourceToVirtualOffset } from './offset-mapping';


/**
 * Converts a vscode Position in the source document to a position in the virtual HTML document.
 */
export function sourcePositionToVirtual(
	sourceDocument: vscode.TextDocument,
	region: HTMLRegion,
	position: vscode.Position,
): number | undefined {
	const sourceOffset = sourceDocument.offsetAt(position);

	return sourceToVirtualOffset(region, sourceOffset);
}


/**
 * Converts a virtual HTML offset to a vscode Position in the source document.
 */
export function virtualOffsetToSourcePosition(
	sourceDocument: vscode.TextDocument,
	region: HTMLRegion,
	virtualOffset: number,
): vscode.Position | undefined {
	const sourceOffset = virtualToSourceOffset(region, virtualOffset);
	if (sourceOffset === undefined)
		return undefined;

	return sourceDocument.positionAt(sourceOffset);
}


/**
 * Converts a range in the virtual HTML to a Range in the source document.
 * Returns undefined if either endpoint falls in a placeholder.
 */
export function virtualRangeToSourceRange(
	sourceDocument: vscode.TextDocument,
	region: HTMLRegion,
	virtualStart: number,
	virtualEnd: number,
): vscode.Range | undefined {
	const startPos = virtualOffsetToSourcePosition(sourceDocument, region, virtualStart);
	const endPos = virtualOffsetToSourcePosition(sourceDocument, region, virtualEnd);

	if (!startPos || !endPos)
		return undefined;

	return new vscode.Range(startPos, endPos);
}


/**
 * Checks whether a given position falls inside the HTML region.
 */
export function isPositionInRegion(
	document: vscode.TextDocument,
	region: HTMLRegion,
	position: vscode.Position,
): boolean {
	const offset = document.offsetAt(position);

	return isOffsetInRegion(region, offset);
}


/**
 * Finds the HTML region at the given position, if any.
 * When multiple regions contain the position (nested templates),
 * returns the smallest (most specific) region.
 */
export function findRegionAtPosition(
	document: vscode.TextDocument,
	regions: HTMLRegion[],
	position: vscode.Position,
): HTMLRegion | undefined {
	const offset = document.offsetAt(position);
	let best: HTMLRegion | undefined;

	for (const r of regions) {
		if (!isOffsetInRegion(r, offset))
			continue;

		if (!best || (r.end - r.start) < (best.end - best.start))
			best = r;
	}

	return best;
}
