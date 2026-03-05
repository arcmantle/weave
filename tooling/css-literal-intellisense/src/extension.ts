/**
 * CSS Literal IntelliSense — VS Code Extension Entry Point
 *
 * Activates on TypeScript/JavaScript files and provides CSS IntelliSense
 * (completion, hover, diagnostics, syntax highlighting) inside:
 * - Tagged template literals with configured tag names (default: `css`)
 * - Template literals preceded by a `\/*css*\/` comment marker
 */
import * as vscode from 'vscode';

import { CSSCompletionProvider } from './completion-provider';
import type { DetectorOptions } from './css-region-detector';
import { CSSDiagnosticsManager } from './diagnostics-manager';
import { clearAll, invalidate } from './document-cache';
import { CSSHoverProvider } from './hover-provider';
import { initLogger, log } from './logger';

console.log('[CSS-Literal] Module loaded');

const SUPPORTED_LANGUAGES = [
	'typescript',
	'javascript',
	'typescriptreact',
	'javascriptreact',
];

const DOCUMENT_SELECTOR: vscode.DocumentSelector = SUPPORTED_LANGUAGES.map(language => ({
	language,
	scheme: 'file',
}));

// CSS trigger characters for completions
const TRIGGER_CHARACTERS = [ ':', ';', '{', '}', '.', '#', '@', '-', '/', '*', '!', '(', ',', ' ' ];


function getDetectorOptions(): Partial<DetectorOptions> {
	const config = vscode.workspace.getConfiguration('cssLiteralIntellisense');

	return {
		tagNames:       config.get<string[]>('tagNames', [ 'css' ]),
		commentMarkers: config.get<string[]>('commentMarkers', [ 'css' ]),
	};
}


export function activate(context: vscode.ExtensionContext): void {
	console.log('[CSS-Literal] activate() called');

	try {
	const outputChannel = initLogger();
	log('Extension activating...');

	const options: { current: Partial<DetectorOptions> } = {
		current: getDetectorOptions(),
	};
	let validateEnabled = vscode.workspace
		.getConfiguration('cssLiteralIntellisense')
		.get<boolean>('validate', true);

	// --- Completion Provider ---
	const completionProvider = new CSSCompletionProvider(options);
	const completionRegistration = vscode.languages.registerCompletionItemProvider(
		DOCUMENT_SELECTOR,
		completionProvider,
		...TRIGGER_CHARACTERS,
	);

	// --- Hover Provider ---
	const hoverProvider = new CSSHoverProvider(options);
	const hoverRegistration = vscode.languages.registerHoverProvider(
		DOCUMENT_SELECTOR,
		hoverProvider,
	);

	// --- Diagnostics ---
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('css-literal');
	const diagnosticsManager = new CSSDiagnosticsManager(
		diagnosticCollection,
		options,
		validateEnabled,
	);

	// --- Document Change Listeners ---
	const onDidChange = vscode.workspace.onDidChangeTextDocument(event => {
		if (!isSupportedDocument(event.document))
			return;

		// Invalidate cache, then refresh diagnostics
		invalidate(event.document.uri.toString());
		diagnosticsManager.update(event.document);
	});

	const onDidOpen = vscode.workspace.onDidOpenTextDocument(document => {
		if (!isSupportedDocument(document))
			return;

		diagnosticsManager.update(document);
	});

	const onDidClose = vscode.workspace.onDidCloseTextDocument(document => {
		invalidate(document.uri.toString());
		diagnosticsManager.clear(document.uri);
	});

	// --- Configuration Change Listener ---
	const onDidChangeConfig = vscode.workspace.onDidChangeConfiguration(event => {
		if (!event.affectsConfiguration('cssLiteralIntellisense'))
			return;

		options.current = getDetectorOptions();
		validateEnabled = vscode.workspace
			.getConfiguration('cssLiteralIntellisense')
			.get<boolean>('validate', true);

		diagnosticsManager.setEnabled(validateEnabled);

		// Clear cache and re-validate all open documents
		clearAll();
		for (const editor of vscode.window.visibleTextEditors) {
			if (isSupportedDocument(editor.document))
				diagnosticsManager.update(editor.document);
		}
	});

	// --- Initial diagnostics for already open editors ---
	for (const editor of vscode.window.visibleTextEditors) {
		if (isSupportedDocument(editor.document))
			diagnosticsManager.update(editor.document);
	}

	// --- Register all disposables ---
	context.subscriptions.push(
		outputChannel,
		completionRegistration,
		hoverRegistration,
		diagnosticCollection,
		onDidChange,
		onDidOpen,
		onDidClose,
		onDidChangeConfig,
	);

	log('Extension activated successfully.');
	console.log('[CSS-Literal] activate() completed successfully');

	}
	catch (err) {
		console.error('[CSS-Literal] ACTIVATION FAILED:', err);
	}
}


export function deactivate(): void {
	clearAll();
}


function isSupportedDocument(document: vscode.TextDocument): boolean {
	return SUPPORTED_LANGUAGES.includes(document.languageId);
}
