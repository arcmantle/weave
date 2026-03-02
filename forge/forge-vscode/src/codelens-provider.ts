import * as path from 'path';

import * as vscode from 'vscode';
import { parse as parseYaml } from 'yaml';

import { ForgeManifestService } from './manifest-service';

/**
 * Provides CodeLens annotations above each command template.yaml file under .forge/scripts.
 * Shows "Run" for every command template and "Open Script" for script-backed templates.
 */
export class ForgeCodeLensProvider implements vscode.CodeLensProvider {

	protected _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
	readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

	constructor(protected readonly service: ForgeManifestService) {
		// Refresh CodeLens when workspace files change.
		vscode.workspace.onDidChangeTextDocument(e => {
			if (isTemplateYamlFile(e.document.uri.fsPath))
				this._onDidChangeCodeLenses.fire();
		});
	}

	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		if (!isTemplateYamlFile(document.uri.fsPath))
			return [];

		const context = resolveTemplateContext(document.uri.fsPath);
		if (!context)
			return [];

		const parsed = parseTemplateDocument(document.getText());
		const firstLine = document.lineAt(0);
		const range = new vscode.Range(0, 0, 0, firstLine.text.length);
		const lenses: vscode.CodeLens[] = [];

		lenses.push(new vscode.CodeLens(range, {
			title:     '$(file-code) Open Command Template',
			command:   'forge.openTemplate',
			arguments: [document.uri.fsPath],
			tooltip:   'Open this template.yaml file',
		}));

		lenses.push(new vscode.CodeLens(range, {
			title:     '$(play) Run',
			command:   'forge.run',
			arguments: [context.commandName, context.manifestDir],
			tooltip:   `Run "forge ${context.commandName.replace(/:/g, ' ')}"`,
		}));

		if (parsed?.script) {
			const absolutePath = path.isAbsolute(parsed.script)
				? parsed.script
				: path.resolve(path.dirname(document.uri.fsPath), parsed.script);

			lenses.push(new vscode.CodeLens(range, {
				title:     '$(go-to-file) Open Script',
				command:   'forge.openScript',
				arguments: [absolutePath],
				tooltip:   parsed.script,
			}));
		}

		return lenses;
	}

}

function isTemplateYamlFile(filePath: string): boolean {
	const normalized = filePath.replace(/\\/g, '/').toLowerCase();

	return /\/\.forge\/scripts\/.+\/template\.yaml$/.test(normalized);
}

function resolveTemplateContext(filePath: string): { commandName: string; manifestDir: string } | null {
	const normalized = filePath.replace(/\\/g, '/');
	const marker = '/.forge/scripts/';
	const idx = normalized.lastIndexOf(marker);
	if (idx === -1)
		return null;

	const manifestDir = normalized.slice(0, idx);
	const suffix = normalized.slice(idx + marker.length);
	if (!suffix.endsWith('/template.yaml'))
		return null;

	const commandPath = suffix.slice(0, -'/template.yaml'.length);
	if (!commandPath)
		return null;

	const commandName = commandPath.split('/').join(':');

	return {
		commandName,
		manifestDir: path.normalize(manifestDir),
	};
}

function parseTemplateDocument(content: string): { script?: string } | null {
	try {
		const parsed = parseYaml(content) as { script?: unknown } | null;
		if (!parsed || typeof parsed !== 'object')
			return null;

		return {
			script: typeof parsed.script === 'string' ? parsed.script : undefined,
		};
	}
	catch {
		return null;
	}
}
