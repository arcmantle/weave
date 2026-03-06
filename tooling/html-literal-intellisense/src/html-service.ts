/**
 * HTML Language Service Bridge
 *
 * Wraps `vscode-html-languageservice` to provide completion and hover
 * on virtual HTML documents extracted from template literals.
 */
import {
	getLanguageService as getHTMLLanguageService,
	TextDocument as HTMLTextDocument,
} from 'vscode-html-languageservice';
import type {
	CompletionList,
	Hover,
	Position as LSPPosition,
} from 'vscode-languageserver-types';


const htmlLanguageService = getHTMLLanguageService();


/** Creates an HTML language service TextDocument for a virtual HTML region. */
export function createHTMLDocument(htmlText: string, uri: string): HTMLTextDocument {
	return HTMLTextDocument.create(
		uri,
		'html',
		1,
		htmlText,
	);
}


/** Get HTML completions at the given offset in the virtual HTML text. */
export function getHTMLCompletions(htmlText: string, offset: number, uri: string): CompletionList {
	const document = createHTMLDocument(htmlText, uri);
	const htmlDoc = htmlLanguageService.parseHTMLDocument(document);
	const position = document.positionAt(offset);

	return htmlLanguageService.doComplete(document, position, htmlDoc);
}


/** Get HTML hover info at the given offset in the virtual HTML text. */
export function getHTMLHover(htmlText: string, offset: number, uri: string): Hover | null {
	const document = createHTMLDocument(htmlText, uri);
	const htmlDoc = htmlLanguageService.parseHTMLDocument(document);
	const position = document.positionAt(offset);

	return htmlLanguageService.doHover(document, position, htmlDoc) ?? null;
}


/** Get auto-closing tag text at the given offset. Returns the closing tag text or null. */
export function getHTMLAutoClosingTag(htmlText: string, offset: number, uri: string): string | null {
	const document = createHTMLDocument(htmlText, uri);
	const position = document.positionAt(offset);
	const result = htmlLanguageService.doTagComplete(document, position, htmlLanguageService.parseHTMLDocument(document));

	return result ?? null;
}


/** Convert an offset in HTML text to an LSP Position. */
export function offsetToLSPPosition(htmlText: string, offset: number, uri: string): LSPPosition {
	const document = createHTMLDocument(htmlText, uri);

	return document.positionAt(offset);
}


/** Convert an LSP Position to an offset in the HTML text. */
export function lspPositionToOffset(htmlText: string, position: LSPPosition, uri: string): number {
	const document = createHTMLDocument(htmlText, uri);

	return document.offsetAt(position);
}
