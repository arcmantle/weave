/**
 * CSS Completion Provider
 *
 * Provides CSS completions inside detected CSS template literal regions.
 */
import * as vscode from 'vscode';
import type { CompletionItem as LSPCompletionItem } from 'vscode-languageserver-types';

import type { DetectorOptions } from './css-region-detector';
import { getCSSCompletions, lspPositionToOffset } from './css-service';
import { getRegions } from './document-cache';
import {
	findRegionAtPosition,
	sourcePositionToVirtual,
	virtualOffsetToSourcePosition,
} from './virtual-document';


export class CSSCompletionProvider implements vscode.CompletionItemProvider {

	constructor(private readonly options: Partial<DetectorOptions>) {}

	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		_token: vscode.CancellationToken,
		_context: vscode.CompletionContext,
	): vscode.CompletionList | undefined {
		const regions = getRegions(document, this.options);
		const region = findRegionAtPosition(document, regions, position);
		if (!region)
			return undefined;

		const virtualOffset = sourcePositionToVirtual(document, region, position);
		if (virtualOffset === undefined)
			return undefined;

		const uri = document.uri.toString() + '.css';
		const completions = getCSSCompletions(region.cssText, virtualOffset, uri);

		const items = completions.items.map(item => this.convertCompletionItem(item, document, region));

		return new vscode.CompletionList(items, completions.isIncomplete);
	}

	private convertCompletionItem(
		item: LSPCompletionItem,
		document: vscode.TextDocument,
		region: import('./css-region-detector').CSSRegion,
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
			const startOffset = lspPositionToOffset(region.cssText, item.textEdit.range.start, '');
			const endOffset = lspPositionToOffset(region.cssText, item.textEdit.range.end, '');
			const startPos = virtualOffsetToSourcePosition(document, region, startOffset);
			const endPos = virtualOffsetToSourcePosition(document, region, endOffset);

			if (startPos && endPos) {
				ci.range = new vscode.Range(startPos, endPos);
				ci.insertText = item.textEdit.newText;
			}
		}

		return ci;
	}

	private convertKind(kind?: number): vscode.CompletionItemKind {
		// LSP CompletionItemKind to vscode CompletionItemKind mapping
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
