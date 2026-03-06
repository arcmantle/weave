/**
 * HTML Literal IntelliSense — VS Code Extension Entry Point
 *
 * Activates on TypeScript/JavaScript files and provides HTML IntelliSense
 * (completion, hover, syntax highlighting) inside:
 * - Tagged template literals with configured tag names (default: `html`)
 * - Template literals preceded by a `\/*html*\/` comment marker
 */
import * as vscode from 'vscode';

import { HTMLCompletionProvider } from './completion-provider';
import { clearAll, invalidate } from './document-cache';
import { initEventTypeResolver } from './event-type-resolver';
import { HTMLHoverProvider } from './hover-provider';
import type { DetectorOptions } from './html-region-detector';
import { initLogger, log } from './logger';


console.log('[HTML-Literal] Module loaded');

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

// HTML trigger characters for completions
const TRIGGER_CHARACTERS = [ '<', '/', '>', ' ', '=', '"', '\'', '.', ':', '-', '?', '@' ];


function getDetectorOptions(): Partial<DetectorOptions> {
	const config = vscode.workspace.getConfiguration('htmlLiteralIntellisense');

	return {
		tagNames:          config.get<string[]>('tagNames', [ 'html' ]),
		commentMarkers:    config.get<string[]>('commentMarkers', [ 'html' ]),
		cssTagNames:       config.get<string[]>('cssTagNames', [ 'css' ]),
		cssCommentMarkers: config.get<string[]>('cssCommentMarkers', [ 'css' ]),
	};
}


function isSupportedDocument(document: vscode.TextDocument): boolean {
	return SUPPORTED_LANGUAGES.includes(document.languageId)
		&& document.uri.scheme === 'file';
}


export function activate(context: vscode.ExtensionContext): void {
	console.log('[HTML-Literal] activate() called');

	try {
		const outputChannel = initLogger();
		log('Extension activating...');

		// Initialize event type resolver from workspace TypeScript lib typings
		const workspaceRoots = (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
		initEventTypeResolver(workspaceRoots);

		const options: { current: Partial<DetectorOptions>; } = {
			current: getDetectorOptions(),
		};

		// --- Completion Provider ---
		const completionProvider = new HTMLCompletionProvider(options);
		const completionRegistration = vscode.languages.registerCompletionItemProvider(
			DOCUMENT_SELECTOR,
			completionProvider,
			...TRIGGER_CHARACTERS,
		);

		// --- Hover Provider ---
		const hoverProvider = new HTMLHoverProvider(options);
		const hoverRegistration = vscode.languages.registerHoverProvider(
			DOCUMENT_SELECTOR,
			hoverProvider,
		);

		// --- Document Change Listeners ---
		const onDidChange = vscode.workspace.onDidChangeTextDocument(event => {
			if (!isSupportedDocument(event.document))
				return;

			invalidate(event.document.uri.toString());
		});

		const onDidClose = vscode.workspace.onDidCloseTextDocument(document => {
			invalidate(document.uri.toString());
		});

		// --- Configuration Change Listener ---
		const onDidChangeConfig = vscode.workspace.onDidChangeConfiguration(event => {
			if (!event.affectsConfiguration('htmlLiteralIntellisense'))
				return;

			options.current = getDetectorOptions();

			// Clear cache so re-detection uses new options
			clearAll();
		});

		// --- Register all disposables ---
		context.subscriptions.push(
			outputChannel,
			completionRegistration,
			hoverRegistration,
			onDidChange,
			onDidClose,
			onDidChangeConfig,
		);

		log('Extension activated successfully.');
		console.log('[HTML-Literal] activate() completed successfully');
	}
	catch (err) {
		console.error('[HTML-Literal] ACTIVATION FAILED:', err);
	}
}
