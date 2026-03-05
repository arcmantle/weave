/**
 * CSS Hover Provider
 *
 * Provides CSS hover information inside detected CSS template literal regions.
 */
import * as vscode from 'vscode';

import type { DetectorOptions } from './css-region-detector';
import { getCSSHover, lspPositionToOffset } from './css-service';
import { getRegions } from './document-cache';
import { log } from './logger';
import {
	findRegionAtPosition,
	sourcePositionToVirtual,
	virtualRangeToSourceRange,
} from './virtual-document';


export class CSSHoverProvider implements vscode.HoverProvider {

	constructor(private readonly options: { current: Partial<DetectorOptions> }) {}

	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	): vscode.Hover | undefined {
		try {
			const regions = getRegions(document, this.options.current);
			const region = findRegionAtPosition(document, regions, position);
			if (!region) {
				return undefined;
			}

			const virtualOffset = sourcePositionToVirtual(document, region, position);
			if (virtualOffset === undefined) {
				log(`Hover: sourcePositionToVirtual returned undefined at ${position.line}:${position.character}`);

				return undefined;
			}

			const uri = document.uri.toString() + '.css';
			const hover = getCSSHover(region.cssText, virtualOffset, uri);
			if (!hover) {
				log(`Hover: CSS service returned null at virtualOffset ${virtualOffset}`);

				return undefined;
			}

			log(`Hover: got result at ${position.line}:${position.character}, virtualOffset=${virtualOffset}`);

			const markdown = convertHoverContents(hover.contents);

			let range: vscode.Range | undefined;
			if (hover.range) {
				const startOffset = lspPositionToOffset(region.cssText, hover.range.start, '');
				const endOffset = lspPositionToOffset(region.cssText, hover.range.end, '');
				range = virtualRangeToSourceRange(document, region, startOffset, endOffset);
			}

			return new vscode.Hover(markdown, range);
		}
		catch (err) {
			log(`Hover ERROR: ${err instanceof Error ? err.message : String(err)}`);

			return undefined;
		}
	}

}


type HoverContents = import('vscode-languageserver-types').Hover['contents'];

// Converts LSP hover contents to a VS Code MarkdownString.
// Handles: string, MarkupContent, MarkedString, and MarkedString[].
function convertHoverContents(contents: HoverContents): vscode.MarkdownString {
	if (typeof contents === 'string') {
		return new vscode.MarkdownString(contents);
	}

	if ('kind' in contents && !Array.isArray(contents)) {
		return new vscode.MarkdownString(contents.value);
	}

	if (Array.isArray(contents)) {
		const parts = contents.map(c => {
			if (typeof c === 'string')
				return c;

			// MarkedString with language → render as fenced code block
			return `\`\`\`${c.language}\n${c.value}\n\`\`\``;
		});

		return new vscode.MarkdownString(parts.join('\n\n'));
	}

	// Single MarkedString with language
	return new vscode.MarkdownString(`\`\`\`${contents.language}\n${contents.value}\n\`\`\``);
}
