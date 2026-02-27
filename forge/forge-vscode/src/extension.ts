import * as path from 'path';

import * as vscode from 'vscode';

import { ForgeTreeProvider, CommandItem } from './tree-provider';
import { ForgeCodeLensProvider } from './codelens-provider';
import { ForgeManifestService } from './manifest-service';
import { fetchCommandMeta, promptForArgs } from './meta-service';

let manifestService: ForgeManifestService;

export function activate(context: vscode.ExtensionContext): void {
	manifestService = new ForgeManifestService();
	const treeProvider = new ForgeTreeProvider(manifestService);

	// Tree view — sidebar
	const treeView = vscode.window.createTreeView('forgeCommands', {
		treeDataProvider: treeProvider,
		showCollapseAll:  true,
	});

	// Tree view — explorer panel
	const explorerView = vscode.window.createTreeView('forgeExplorer', {
		treeDataProvider: treeProvider,
		showCollapseAll:  true,
	});

	// CodeLens on forge.yaml files
	const codeLensProvider = new ForgeCodeLensProvider(manifestService);
	const codeLensRegistration = vscode.languages.registerCodeLensProvider(
		{ pattern: '**/forge.yaml' },
		codeLensProvider,
	);

	// Commands
	const runCmd = vscode.commands.registerCommand('forge.run', async (nameOrItem?: string | CommandItem, cwdArg?: string) => {
		if (!nameOrItem)
			return;

		let name: string;
		let cwd: string | undefined;

		if (typeof nameOrItem === 'string') {
			name = nameOrItem;
			cwd = cwdArg;
		}
		else {
			name = nameOrItem.name;
			cwd = nameOrItem.cmd.manifestDir;
		}

		const cliName = name.replace(/:/g, ' ');

		// Try to fetch argument metadata for script-backed commands.
		let extraArgs = '';
		const meta = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: `Loading metadata for ${name}...`, cancellable: false },
			() => fetchCommandMeta(name, cwd),
		);

		if (meta?.args && meta.args.length > 0) {
			const result = await promptForArgs(meta);
			if (result === undefined)
				return; // user cancelled

			extraArgs = result;
		}

		const fullCommand = extraArgs ? `forge ${cliName} ${extraArgs}` : `forge ${cliName}`;
		const terminal = vscode.window.createTerminal({ name: `forge ${name}`, cwd });
		terminal.show();
		terminal.sendText(fullCommand);
	});

	const openScriptCmd = vscode.commands.registerCommand('forge.openScript', async (pathOrItem?: string | CommandItem) => {
		if (!pathOrItem)
			return;

		let scriptPath: string;
		if (typeof pathOrItem === 'string') {
			scriptPath = pathOrItem;
		}
		else if (pathOrItem instanceof CommandItem && pathOrItem.cmd?.script) {
			scriptPath = path.resolve(pathOrItem.cmd.manifestDir, pathOrItem.cmd.script);
		}
		else {
			return;
		}
		const uri = vscode.Uri.file(scriptPath);

		try {
			const doc = await vscode.workspace.openTextDocument(uri);
			await vscode.window.showTextDocument(doc);
		}
		catch {
			vscode.window.showErrorMessage(`Could not open script: ${scriptPath}`);
		}
	});

	const refreshCmd = vscode.commands.registerCommand('forge.refresh', () => {
		manifestService.refresh();
		treeProvider.refresh();
	});

	const addScriptCmd = vscode.commands.registerCommand('forge.addScript', async () => {
		const name = await vscode.window.showInputBox({
			prompt:       'Script name (e.g. "deploy" or "deploy:staging")',
			placeHolder:  'my-script',
			validateInput: value => {
				if (!value?.trim())
					return 'Name is required';

				if (!/^[\w:.-]+$/.test(value))
					return 'Name can only contain letters, numbers, hyphens, dots, and colons';

				return undefined;
			},
		});

		if (!name)
			return;

		const lang = await vscode.window.showQuickPick(
			[
				{ label: 'Go',         description: '--go (default)', flag: '' },
				{ label: 'TypeScript', description: '--ts',           flag: '--ts' },
				{ label: 'C#',         description: '--cs',           flag: '--cs' },
			],
			{ placeHolder: 'Select script language' },
		);

		if (!lang)
			return;

		const langFlag = lang.flag ? ` ${lang.flag}` : '';
		const terminal = vscode.window.createTerminal({ name: `forge add ${name}` });
		terminal.show();
		terminal.sendText(`forge add ${name}${langFlag}`);
	});

	// File watchers
	const yamlWatcher = vscode.workspace.createFileSystemWatcher('**/forge.yaml');
	const scriptWatcher = vscode.workspace.createFileSystemWatcher('**/.forge/scripts/**/*.{go,ts,cs}');

	const onChange = () => {
		manifestService.refresh();
		treeProvider.refresh();
		vscode.commands.executeCommand('setContext', 'forge.hasManifest', manifestService.getManifests().size > 0);
	};

	yamlWatcher.onDidChange(onChange);
	yamlWatcher.onDidCreate(onChange);
	yamlWatcher.onDidDelete(onChange);
	scriptWatcher.onDidChange(onChange);
	scriptWatcher.onDidCreate(onChange);
	scriptWatcher.onDidDelete(onChange);

	context.subscriptions.push(
		treeView,
		explorerView,
		codeLensRegistration,
		runCmd,
		openScriptCmd,
		refreshCmd,
		addScriptCmd,
		yamlWatcher,
		scriptWatcher,
	);

	// Initial load
	manifestService.refresh();

	// Set context key so the explorer view is visible when forge manifests exist.
	const hasManifest = manifestService.getManifests().size > 0;
	vscode.commands.executeCommand('setContext', 'forge.hasManifest', hasManifest);
}

export function deactivate(): void {
	// Nothing to clean up
}
