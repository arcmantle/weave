/**
 * CSS Language Service Bridge
 *
 * Wraps `vscode-css-languageservice` to provide completion, hover, and
 * diagnostics on virtual CSS documents extracted from template literals.
 */
import {
	getCSSLanguageService,
	LanguageSettings,
	TextDocument as CSSTextDocument,
} from 'vscode-css-languageservice';
import type {
	CompletionList,
	Diagnostic,
	Hover,
	Position as LSPPosition,
} from 'vscode-languageserver-types';


const cssLanguageService = getCSSLanguageService();

// Enable all validation features
const languageSettings: LanguageSettings = {
	validate: true,
	lint:     {
		compatibleVendorPrefixes:        'warning',
		vendorPrefix:                    'warning',
		duplicateProperties:             'warning',
		emptyRules:                      'warning',
		importStatement:                 'ignore',
		boxModel:                        'ignore',
		universalSelector:               'ignore',
		zeroUnits:                       'ignore',
		fontFaceProperties:              'warning',
		hexColorLength:                  'ignore',
		argumentsInColorFunction:        'error',
		unknownProperties:               'warning',
		ieHack:                          'ignore',
		unknownVendorSpecificProperties: 'ignore',
		propertyIgnoredDueToDisplay:     'warning',
		important:                       'ignore',
		float:                           'ignore',
		idSelector:                      'ignore',
	},
};

cssLanguageService.configure(languageSettings);


/** Creates a CSS language service TextDocument for a virtual CSS region. */
export function createCSSDocument(cssText: string, uri: string): CSSTextDocument {
	return CSSTextDocument.create(
		uri,
		'css',
		1,
		cssText,
	);
}


/** Get CSS completions at the given offset in the virtual CSS text. */
export function getCSSCompletions(cssText: string, offset: number, uri: string): CompletionList {
	const document = createCSSDocument(cssText, uri);
	const stylesheet = cssLanguageService.parseStylesheet(document);
	const position = document.positionAt(offset);

	return cssLanguageService.doComplete(document, position, stylesheet);
}


/** Get CSS hover info at the given offset in the virtual CSS text. */
export function getCSSHover(cssText: string, offset: number, uri: string): Hover | null {
	const document = createCSSDocument(cssText, uri);
	const stylesheet = cssLanguageService.parseStylesheet(document);
	const position = document.positionAt(offset);

	return cssLanguageService.doHover(document, position, stylesheet) ?? null;
}


/** Get CSS diagnostics for the entire virtual CSS text. */
export function getCSSDiagnostics(cssText: string, uri: string): Diagnostic[] {
	const document = createCSSDocument(cssText, uri);
	const stylesheet = cssLanguageService.parseStylesheet(document);

	return cssLanguageService.doValidation(document, stylesheet, languageSettings);
}


/** Convert an offset in CSS text to an LSP Position. */
export function offsetToLSPPosition(cssText: string, offset: number, uri: string): LSPPosition {
	const document = createCSSDocument(cssText, uri);

	return document.positionAt(offset);
}


/** Convert an LSP Position to an offset in the CSS text. */
export function lspPositionToOffset(cssText: string, position: LSPPosition, uri: string): number {
	const document = createCSSDocument(cssText, uri);

	return document.offsetAt(position);
}
