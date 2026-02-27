import * as path from 'path';

import * as vscode from 'vscode';

import { ForgeManifestService } from './manifest-service';

/**
 * Provides CodeLens annotations above each command in forge.yaml files.
 * Shows "Run" for all commands and "Open Script" for script-backed commands.
 */
export class ForgeCodeLensProvider implements vscode.CodeLensProvider {

	protected _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
	readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

	constructor(protected readonly service: ForgeManifestService) {
		// Refresh CodeLens when workspace files change.
		vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.fileName.endsWith('forge.yaml'))
				this._onDidChangeCodeLenses.fire();
		});
	}

	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const lenses: vscode.CodeLens[] = [];
		const text = document.getText();
		const lines = text.split('\n');

		// We're inside a forge.yaml — find command names by matching the pattern
		// of a top-level key under `commands:`.
		// The YAML structure is:
		//   commands:
		//     <name>:
		//       description: ...
		//       script: ...
		let inCommands = false;
		let commandsIndent = -1;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]!;
			const trimmed = line.trimStart();

			// Detect `commands:` block.
			if (trimmed === 'commands:' || trimmed.startsWith('commands:')) {
				inCommands = true;
				commandsIndent = line.length - trimmed.length;
				continue;
			}

			if (!inCommands)
				continue;

			// A line at or before the commands indent level (and not blank) exits the block.
			if (trimmed.length > 0) {
				const currentIndent = line.length - trimmed.length;
				if (currentIndent <= commandsIndent && !trimmed.startsWith('#')) {
					inCommands = false;
					continue;
				}
			}

			// Detect command name: a key at exactly commandsIndent + 2 (standard YAML indent).
			const commandMatch = line.match(/^(\s+)([\w:.-]+):\s*$/);
			if (!commandMatch)
				continue;

			const indent = commandMatch[1]!.length;
			const name = commandMatch[2]!;

			// Must be a direct child of `commands:`.
			if (indent !== commandsIndent + 2)
				continue;

			const range = new vscode.Range(i, 0, i, line.length);
			const manifestDir = path.dirname(document.uri.fsPath);

			// "Run" lens for all commands.
			lenses.push(new vscode.CodeLens(range, {
				title:     '$(play) Run',
				command:   'forge.run',
				arguments: [name, manifestDir],
				tooltip:   `Run "forge ${name.replace(/:/g, ' ')}"`,
			}));

			// "Open Script" lens — look ahead for a `script:` property.
			const scriptPath = this.findScriptProperty(lines, i + 1, indent);
			if (scriptPath) {
				const absolutePath = path.resolve(manifestDir, scriptPath);

				lenses.push(new vscode.CodeLens(range, {
					title:     '$(go-to-file) Open Script',
					command:   'forge.openScript',
					arguments: [absolutePath],
					tooltip:   scriptPath,
				}));
			}
		}

		return lenses;
	}

	/**
	 * Look ahead from startLine for a `script:` property belonging to the
	 * current command block (at indent > parentIndent).
	 */
	protected findScriptProperty(lines: string[], startLine: number, parentIndent: number): string | undefined {
		for (let i = startLine; i < lines.length; i++) {
			const line = lines[i]!;
			const trimmed = line.trimStart();

			if (trimmed.length === 0 || trimmed.startsWith('#'))
				continue;

			const currentIndent = line.length - trimmed.length;

			// Exited the command block.
			if (currentIndent <= parentIndent)
				break;

			const match = trimmed.match(/^script:\s*["']?(.+?)["']?\s*$/);
			if (match)
				return match[1];
		}

		return undefined;
	}

}
