/**
 * Virtual Document Manager
 *
 * Manages virtual CSS documents for each detected CSS region, providing
 * bidirectional offset mapping between source ↔ virtual CSS positions.
 *
 * Pure offset functions (no vscode dependency) are in offset-mapping.ts.
 * This module re-exports them and adds vscode-dependent helpers.
 */
import * as vscode from 'vscode';

import type { CSSRegion } from './css-region-detector';

export {
	isDiagnosticInPlaceholder,
	isOffsetInRegion,
	sourceToVirtualOffset,
	virtualToSourceOffset,
} from './offset-mapping';
import { isOffsetInRegion, virtualToSourceOffset } from './offset-mapping';
import { sourceToVirtualOffset } from './offset-mapping';


/**
 * Converts a vscode Position in the source document to a position in the virtual CSS document.
 */
export function sourcePositionToVirtual(
	sourceDocument: vscode.TextDocument,
	region: CSSRegion,
	position: vscode.Position,
): number | undefined {
	const sourceOffset = sourceDocument.offsetAt(position);

	return sourceToVirtualOffset(region, sourceOffset);
}


/**
 * Converts a virtual CSS offset to a vscode Position in the source document.
 */
export function virtualOffsetToSourcePosition(
	sourceDocument: vscode.TextDocument,
	region: CSSRegion,
	virtualOffset: number,
): vscode.Position | undefined {
	const sourceOffset = virtualToSourceOffset(region, virtualOffset);
	if (sourceOffset === undefined)
		return undefined;

	return sourceDocument.positionAt(sourceOffset);
}


/**
 * Converts a range in the virtual CSS to a Range in the source document.
 * Returns undefined if either endpoint falls in a placeholder.
 */
export function virtualRangeToSourceRange(
	sourceDocument: vscode.TextDocument,
	region: CSSRegion,
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
 * Checks whether a given position falls inside the CSS region.
 */
export function isPositionInRegion(
	document: vscode.TextDocument,
	region: CSSRegion,
	position: vscode.Position,
): boolean {
	const offset = document.offsetAt(position);

	return isOffsetInRegion(region, offset);
}


/**
 * Finds the CSS region at the given position, if any.
 */
export function findRegionAtPosition(
	document: vscode.TextDocument,
	regions: CSSRegion[],
	position: vscode.Position,
): CSSRegion | undefined {
	const offset = document.offsetAt(position);

	return regions.find(r => isOffsetInRegion(r, offset));
}
