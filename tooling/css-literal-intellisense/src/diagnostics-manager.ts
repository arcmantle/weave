/**
 * CSS Diagnostics Manager
 *
 * Provides CSS validation diagnostics for detected CSS template literal regions.
 * Publishes diagnostics into a DiagnosticCollection, mapping virtual CSS
 * positions back to the original source document.
 */
import * as vscode from 'vscode';
import type { Diagnostic as LSPDiagnostic } from 'vscode-languageserver-types';

import type { DetectorOptions } from './css-region-detector';
import { getCSSDiagnostics, lspPositionToOffset } from './css-service';
import { getRegions } from './document-cache';
import { isDiagnosticInPlaceholder, virtualRangeToSourceRange } from './virtual-document';


export class CSSDiagnosticsManager {

	private readonly collection: vscode.DiagnosticCollection;
	private readonly options:    Partial<DetectorOptions>;
	private enabled:             boolean;

	constructor(
		collection: vscode.DiagnosticCollection,
		options: Partial<DetectorOptions>,
		enabled: boolean,
	) {
		this.collection = collection;
		this.options = options;
		this.enabled = enabled;
	}

	setEnabled(value: boolean): void {
		this.enabled = value;
		if (!value)
			this.collection.clear();
	}

	/** Update diagnostics for a single document. */
	update(document: vscode.TextDocument): void {
		if (!this.enabled) {
			this.collection.delete(document.uri);

			return;
		}

		const regions = getRegions(document, this.options);
		if (regions.length === 0) {
			this.collection.delete(document.uri);

			return;
		}

		const diagnostics: vscode.Diagnostic[] = [];

		for (const region of regions) {
			const uri = document.uri.toString() + '.css';
			const lspDiags = getCSSDiagnostics(region.cssText, uri);

			for (const lspDiag of lspDiags) {
				const mapped = this.convertDiagnostic(lspDiag, document, region);
				if (mapped)
					diagnostics.push(mapped);
			}
		}

		this.collection.set(document.uri, diagnostics);
	}

	/** Clear diagnostics for a specific URI. */
	clear(uri: vscode.Uri): void {
		this.collection.delete(uri);
	}

	/** Dispose the diagnostic collection. */
	dispose(): void {
		this.collection.dispose();
	}

	private convertDiagnostic(
		lspDiag: LSPDiagnostic,
		document: vscode.TextDocument,
		region: import('./css-region-detector').CSSRegion,
	): vscode.Diagnostic | undefined {
		const startOffset = lspPositionToOffset(region.cssText, lspDiag.range.start, '');
		const endOffset = lspPositionToOffset(region.cssText, lspDiag.range.end, '');

		// Suppress diagnostics that overlap with interpolation placeholders
		if (isDiagnosticInPlaceholder(region, startOffset, endOffset))
			return undefined;

		const range = virtualRangeToSourceRange(document, region, startOffset, endOffset);
		if (!range)
			return undefined;

		const severity = this.convertSeverity(lspDiag.severity);
		const diag = new vscode.Diagnostic(range, lspDiag.message, severity);
		diag.source = 'css-literal';
		diag.code = lspDiag.code;

		return diag;
	}

	private convertSeverity(severity?: number): vscode.DiagnosticSeverity {
		switch (severity) {
		case 1: return vscode.DiagnosticSeverity.Error;
		case 2: return vscode.DiagnosticSeverity.Warning;
		case 3: return vscode.DiagnosticSeverity.Information;
		case 4: return vscode.DiagnosticSeverity.Hint;
		default: return vscode.DiagnosticSeverity.Warning;
		}
	}

}
