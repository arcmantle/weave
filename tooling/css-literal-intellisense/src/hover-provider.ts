/**
 * CSS Hover Provider
 *
 * Provides CSS hover information inside detected CSS template literal regions.
 */
import * as vscode from 'vscode';

import type { DetectorOptions } from './css-region-detector';
import { getCSSHover, lspPositionToOffset } from './css-service';
import { getRegions } from './document-cache';
import {
	findRegionAtPosition,
	sourcePositionToVirtual,
	virtualRangeToSourceRange,
} from './virtual-document';


export class CSSHoverProvider implements vscode.HoverProvider {

	constructor(private readonly options: Partial<DetectorOptions>) {}

	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	): vscode.Hover | undefined {
		const regions = getRegions(document, this.options);
		const region = findRegionAtPosition(document, regions, position);
		if (!region)
			return undefined;

		const virtualOffset = sourcePositionToVirtual(document, region, position);
		if (virtualOffset === undefined)
			return undefined;

		const uri = document.uri.toString() + '.css';
		const hover = getCSSHover(region.cssText, virtualOffset, uri);
		if (!hover)
			return undefined;

		const contents = hover.contents;
		let markdown: vscode.MarkdownString;

		if (typeof contents === 'string') {
			markdown = new vscode.MarkdownString(contents);
		}
		else if ('kind' in contents) {
			markdown = new vscode.MarkdownString(contents.value);
		}
		else if (Array.isArray(contents)) {
			const parts = contents.map(c => typeof c === 'string' ? c : c.value);
			markdown = new vscode.MarkdownString(parts.join('\n\n'));
		}
		else {
			markdown = new vscode.MarkdownString(contents.value);
		}

		let range: vscode.Range | undefined;
		if (hover.range) {
			const startOffset = lspPositionToOffset(region.cssText, hover.range.start, '');
			const endOffset = lspPositionToOffset(region.cssText, hover.range.end, '');
			range = virtualRangeToSourceRange(document, region, startOffset, endOffset);
		}

		return new vscode.Hover(markdown, range);
	}

}
