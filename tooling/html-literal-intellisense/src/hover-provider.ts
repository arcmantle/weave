/**
 * HTML Hover Provider
 *
 * Provides HTML hover information inside detected HTML template literal regions.
 */
import * as vscode from 'vscode';

import { getRegions } from './document-cache';
import { getEventType, getPropertyType } from './event-type-resolver';
import type { DetectorOptions, HTMLRegion } from './html-region-detector';
import { getHTMLHover, lspPositionToOffset } from './html-service';
import { createLitTransform, type LitBindingInfo } from './lit-transform';
import { log } from './logger';
import {
	findRegionAtPosition,
	sourcePositionToVirtual,
	virtualOffsetToSourcePosition,
	virtualRangeToSourceRange,
} from './virtual-document';


export class HTMLHoverProvider implements vscode.HoverProvider {

	constructor(private readonly options: { current: Partial<DetectorOptions>; }) {}

	provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
	): vscode.Hover | undefined {
		try {
			const regions = getRegions(document, this.options.current);
			const region = findRegionAtPosition(document, regions, position);
			if (!region)
				return undefined;

			const virtualOffset = sourcePositionToVirtual(document, region, position);
			if (virtualOffset === undefined) {
				log(`Hover: sourcePositionToVirtual returned undefined at ${ position.line }:${ position.character }`);

				return undefined;
			}

			const transform = createLitTransform(region.htmlText);

			// Check if hovering on a Lit binding prefix/name
			const binding = findBindingAtOffset(transform.bindings, virtualOffset);
			if (binding) {
				const nameOffset = binding.originalStart + 1;
				const transformedNameOffset = transform.toTransformed(nameOffset);
				const uri = document.uri.toString() + '.html';
				const attrHover = getHTMLHover(transform.text, transformedNameOffset, uri);

				log(`Hover: Lit ${ binding.kind } '${ binding.name }' at ${ position.line }:${ position.character }`);

				return buildLitHover(binding, attrHover, region, document);
			}

			const transformedOffset = transform.toTransformed(virtualOffset);

			const uri = document.uri.toString() + '.html';
			const hover = getHTMLHover(transform.text, transformedOffset, uri);
			if (!hover) {
				log(`Hover: HTML service returned null at virtualOffset ${ virtualOffset }`);

				return undefined;
			}

			log(`Hover: got result at ${ position.line }:${ position.character }, virtualOffset=${ virtualOffset }`);

			const markdown = convertHoverContents(hover.contents);

			let range: vscode.Range | undefined;
			if (hover.range) {
				const tStart = lspPositionToOffset(transform.text, hover.range.start, '');
				const tEnd = lspPositionToOffset(transform.text, hover.range.end, '');
				const startOffset = transform.toOriginal(tStart);
				const endOffset = transform.toOriginal(tEnd);
				range = virtualRangeToSourceRange(document, region, startOffset, endOffset);
			}

			return new vscode.Hover(markdown, range);
		}
		catch (err) {
			log(`Hover ERROR: ${ err instanceof Error ? err.message : String(err) }`);

			return undefined;
		}
	}

}


function findBindingAtOffset(
	bindings: LitBindingInfo[],
	offset: number,
): LitBindingInfo | undefined {
	for (const b of bindings) {
		const end = b.originalStart + 1 + b.name.length;
		if (offset >= b.originalStart && offset < end)
			return b;
	}

	return undefined;
}


const LIT_KIND_LABELS: Record<import('./lit-transform').LitBindingKind, string> = {
	event:    'Lit event binding',
	property: 'Lit property binding',
	boolean:  'Lit boolean attribute binding',
};

const LIT_PREFIX_CHARS: Record<import('./lit-transform').LitBindingKind, string> = {
	event:    '@',
	property: '.',
	boolean:  '?',
};


function buildLitHover(
	binding: LitBindingInfo,
	attrHover: import('vscode-languageserver-types').Hover | null,
	region: HTMLRegion,
	document: vscode.TextDocument,
): vscode.Hover {
	const prefix = LIT_PREFIX_CHARS[binding.kind];
	const displayName = `${ prefix }${ binding.name }`;
	const kindLabel = LIT_KIND_LABELS[binding.kind];

	const parts: string[] = [ `**${ displayName }** — *${ kindLabel }*` ];

	const tagName = findEnclosingTagName(region.htmlText, binding.originalStart);

	if (binding.kind === 'event') {
		const eventType = getEventType(binding.name);
		parts.push(`Event type: \`${ eventType }\``);
	}
	else if (tagName) {
		const propType = getPropertyType(tagName, binding.name);
		if (propType)
			parts.push(`Type: \`${ propType }\``);
	}

	if (attrHover) {
		const content = convertHoverContents(attrHover.contents);
		parts.push('---', content.value);
	}

	const markdown = new vscode.MarkdownString(parts.join('\n\n'));

	const bindingEnd = binding.originalStart + 1 + binding.name.length;
	const startPos = virtualOffsetToSourcePosition(document, region, binding.originalStart);
	const endPos = virtualOffsetToSourcePosition(document, region, bindingEnd);
	const range = startPos && endPos
		? new vscode.Range(startPos, endPos)
		: undefined;

	return new vscode.Hover(markdown, range);
}


/**
 * Finds the tag name of the enclosing element at the given offset in HTML text.
 * Scans backward from offset to find the most recent `<tagname` that hasn't been closed.
 */
function findEnclosingTagName(htmlText: string, offset: number): string | undefined {
	// Scan backward from the binding position to find the opening '<'
	// of the enclosing tag (skipping nested tags).
	let pos = offset - 1;

	while (pos >= 0) {
		if (htmlText[pos] === '<') {
			// Check it's an opening tag (not closing or comment)
			const after = htmlText.slice(pos + 1, pos + 50);
			const tagMatch = /^([a-zA-Z][\w-]*)/.exec(after);
			if (tagMatch)
				return tagMatch[1]!.toLowerCase();

			break;
		}

		// Skip past closing tags or other < characters
		if (htmlText[pos] === '>') {
			// If we hit a '>' we might be passing through a nested tag or attribute value.
			// Just keep scanning backward — we want the outermost unclosed '<'.
			pos--;
			continue;
		}

		pos--;
	}

	return undefined;
}


type HoverContents = import('vscode-languageserver-types').Hover['contents'];

// Converts LSP hover contents to a VS Code MarkdownString.
// Handles: string, MarkupContent, MarkedString, and MarkedString[].
function convertHoverContents(contents: HoverContents): vscode.MarkdownString {
	if (typeof contents === 'string')
		return new vscode.MarkdownString(contents);

	if ('kind' in contents && !Array.isArray(contents))
		return new vscode.MarkdownString(contents.value);

	if (Array.isArray(contents)) {
		const parts = contents.map(c => {
			if (typeof c === 'string')
				return c;

			// MarkedString with language → render as fenced code block
			return `\`\`\`${ c.language }\n${ c.value }\n\`\`\``;
		});

		return new vscode.MarkdownString(parts.join('\n\n'));
	}

	// Single MarkedString with language
	return new vscode.MarkdownString(`\`\`\`${ contents.language }\n${ contents.value }\n\`\`\``);
}
