/**
 * HTML Completion Provider
 *
 * Provides HTML completions inside detected HTML template literal regions.
 * Includes Lit-specific binding completions (.property, ?boolean, @event).
 */
import * as vscode from 'vscode';
import type { CompletionItem as LSPCompletionItem } from 'vscode-languageserver-types';

import { getRegions } from './document-cache';
import type { DetectorOptions, HTMLRegion } from './html-region-detector';
import { getHTMLCompletions, lspPositionToOffset } from './html-service';
import { createLitTransform, detectLitPrefix, type LitPrefix, type LitTransform } from './lit-transform';
import { log } from './logger';
import {
	findRegionAtPosition,
	sourcePositionToVirtual,
	virtualOffsetToSourcePosition,
} from './virtual-document';


/** LSP CompletionItemKind for "Property" (used for HTML attributes). */
const LSP_KIND_PROPERTY = 10;

const LIT_BINDING_DETAIL: Record<LitPrefix, string> = {
	'.': 'Lit property binding',
	'?': 'Lit boolean attribute binding',
	'@': 'Lit event binding',
};


export class HTMLCompletionProvider implements vscode.CompletionItemProvider {

	constructor(private readonly options: { current: Partial<DetectorOptions>; }) {}

	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.CompletionContext,
	): vscode.CompletionList | undefined {
		try {
			const regions = getRegions(document, this.options.current);
			const region = findRegionAtPosition(document, regions, position);
			if (!region)
				return undefined;

			const virtualOffset = sourcePositionToVirtual(document, region, position);
			if (virtualOffset === undefined) {
				log(`Completion: sourcePositionToVirtual returned undefined at ${ position.line }:${ position.character }`);

				return undefined;
			}

			// Detect Lit binding prefix context
			const litPrefix = detectLitPrefix(region.htmlText, virtualOffset);

			log(`Completion: pos=${ position.line }:${ position.character }, `
				+ `virtualOffset=${ virtualOffset }, litPrefix=${ litPrefix }`);

			let items: vscode.CompletionItem[];

			if (litPrefix) {
				items = this.createLitCompletions(
					litPrefix, region, virtualOffset, document, position,
				);
			}
			else {
				const transform = createLitTransform(region.htmlText);
				const transformedOffset = transform.toTransformed(virtualOffset);
				const uri = document.uri.toString() + '.html';
				const completions = getHTMLCompletions(transform.text, transformedOffset, uri);

				log(`Completion: ${ completions.items.length } items at `
					+ `${ position.line }:${ position.character }, virtualOffset=${ virtualOffset }`);

				items = completions.items.map(
					item => this.convertCompletionItem(item, document, region, transform),
				);
			}

			return new vscode.CompletionList(items, true);
		}
		catch (err) {
			log(`Completion ERROR: ${ err instanceof Error ? err.message : String(err) }`);

			return undefined;
		}
	}

	/**
	 * Gets completions for a Lit binding prefix context.
	 * Patches the HTML to normalize the in-progress prefix so the HTML
	 * service can parse the tag and return relevant attribute completions.
	 * - `@` → replaced with `on` so the service suggests `onclick`, `onmouseover`, etc.
	 * - `.` / `?` → removed so the service suggests all standard attributes.
	 */
	protected createLitCompletions(
		prefix: LitPrefix,
		region: HTMLRegion,
		virtualOffset: number,
		document: vscode.TextDocument,
		cursorPosition: vscode.Position,
	): vscode.CompletionItem[] {
		// Find the prefix character's position in original htmlText
		let prefixOffset = virtualOffset - 1;
		while (prefixOffset >= 0 && /[-\w]/.test(region.htmlText[prefixOffset]!))
			prefixOffset--;

		// Build patched HTML where the prefix is normalized for the service
		let patchedHtml: string;
		let adjustedOffset: number;

		if (prefix === '@') {
			// Replace '@' with 'on' so the service sees valid on* event attributes
			patchedHtml = region.htmlText.slice(0, prefixOffset)
				+ 'on'
				+ region.htmlText.slice(prefixOffset + 1);
			adjustedOffset = virtualOffset + 1;
		}
		else {
			// Remove '.' or '?' so the service sees standard attributes
			patchedHtml = region.htmlText.slice(0, prefixOffset)
				+ region.htmlText.slice(prefixOffset + 1);
			adjustedOffset = virtualOffset - 1;
		}

		// Transform other complete bindings and get completions
		const patchedTransform = createLitTransform(patchedHtml);
		const transformedOffset = patchedTransform.toTransformed(adjustedOffset);
		const uri = document.uri.toString() + '.html';
		const completions = getHTMLCompletions(patchedTransform.text, transformedOffset, uri);

		log(`Completion (Lit ${ prefix }): ${ completions.items.length } items from patched HTML`);

		// Replacement range: from after the prefix character to the cursor
		const nameStartOffset = prefixOffset + 1;
		const rangeStart = virtualOffsetToSourcePosition(document, region, nameStartOffset);
		const replacementRange = rangeStart
			? new vscode.Range(rangeStart, cursorPosition)
			: undefined;

		// Filter and build Lit-prefixed completion items
		const items: vscode.CompletionItem[] = [];

		for (const item of completions.items) {
			const attrName = item.label;

			if (prefix === '@') {
				if (!attrName.startsWith('on') || attrName.length <= 2)
					continue;

				const eventName = attrName.slice(2);
				items.push(this.buildLitItem(prefix, eventName, item, replacementRange));
			}
			else {
				items.push(this.buildLitItem(prefix, attrName, item, replacementRange));
			}
		}

		return items;
	}

	/**
	 * Builds a single Lit-prefixed completion item.
	 * The label includes the prefix (e.g. `@click`), while the insertText
	 * is just the name (the prefix character is already typed in the source).
	 */
	protected buildLitItem(
		prefix: LitPrefix,
		name: string,
		original: LSPCompletionItem,
		replacementRange?: vscode.Range,
	): vscode.CompletionItem {
		const label = `${ prefix }${ name }`;
		const ci = new vscode.CompletionItem(label, vscode.CompletionItemKind.Property);

		ci.detail = LIT_BINDING_DETAIL[prefix];
		ci.documentation = original.documentation
			? new vscode.MarkdownString(
				typeof original.documentation === 'string'
					? original.documentation
					: original.documentation.value,
			)
			: undefined;

		ci.insertText = name;
		ci.filterText = name;
		ci.sortText = `0${ name }`;

		if (replacementRange)
			ci.range = replacementRange;

		return ci;
	}

	protected convertCompletionItem(
		item: LSPCompletionItem,
		document: vscode.TextDocument,
		region: HTMLRegion,
		transform: LitTransform,
	): vscode.CompletionItem {
		const kind = this.convertKind(item.kind);
		const ci = new vscode.CompletionItem(item.label, kind);

		ci.detail = item.detail;
		ci.documentation = item.documentation
			? new vscode.MarkdownString(
				typeof item.documentation === 'string'
					? item.documentation
					: item.documentation.value,
			)
			: undefined;

		ci.insertText = item.insertText ?? item.label;
		ci.filterText = item.filterText;
		ci.sortText = item.sortText;

		if (item.textEdit && 'range' in item.textEdit) {
			const tStart = lspPositionToOffset(transform.text, item.textEdit.range.start, '');
			const tEnd = lspPositionToOffset(transform.text, item.textEdit.range.end, '');
			const startOffset = transform.toOriginal(tStart);
			const endOffset = transform.toOriginal(tEnd);
			const startPos = virtualOffsetToSourcePosition(document, region, startOffset);
			const endPos = virtualOffsetToSourcePosition(document, region, endOffset);

			if (startPos && endPos) {
				ci.range = new vscode.Range(startPos, endPos);
				ci.insertText = item.textEdit.newText;
			}
		}

		return ci;
	}

	protected convertKind(kind?: number): vscode.CompletionItemKind {
		const map: Record<number, vscode.CompletionItemKind> = {
			1:  vscode.CompletionItemKind.Text,
			2:  vscode.CompletionItemKind.Method,
			3:  vscode.CompletionItemKind.Function,
			4:  vscode.CompletionItemKind.Constructor,
			5:  vscode.CompletionItemKind.Field,
			6:  vscode.CompletionItemKind.Variable,
			7:  vscode.CompletionItemKind.Class,
			8:  vscode.CompletionItemKind.Interface,
			9:  vscode.CompletionItemKind.Module,
			10: vscode.CompletionItemKind.Property,
			11: vscode.CompletionItemKind.Unit,
			12: vscode.CompletionItemKind.Value,
			13: vscode.CompletionItemKind.Enum,
			14: vscode.CompletionItemKind.Keyword,
			15: vscode.CompletionItemKind.Snippet,
			16: vscode.CompletionItemKind.Color,
			17: vscode.CompletionItemKind.File,
			18: vscode.CompletionItemKind.Reference,
			19: vscode.CompletionItemKind.Folder,
			20: vscode.CompletionItemKind.EnumMember,
			21: vscode.CompletionItemKind.Constant,
			22: vscode.CompletionItemKind.Struct,
			23: vscode.CompletionItemKind.Event,
			24: vscode.CompletionItemKind.Operator,
			25: vscode.CompletionItemKind.TypeParameter,
		};

		return (kind && map[kind]) ?? vscode.CompletionItemKind.Property;
	}

}
