import * as path from 'path';

import * as vscode from 'vscode';

import { ForgeManifestService, ForgeCommand, ResolvedManifest } from './manifest-service';

// ── Tree Item Types ────────────────────────────────────────────────

type TreeItem = FolderItem | GroupItem | CommandItem | StepItem;

class FolderItem extends vscode.TreeItem {

	readonly children: TreeItem[] = [];

	constructor(
		public readonly folderPath: string,
		label: string,
	) {
		super(label, vscode.TreeItemCollapsibleState.Expanded);
		this.iconPath = new vscode.ThemeIcon('root-folder');
		this.contextValue = 'folder';
		this.tooltip = folderPath;
	}

}

class GroupItem extends vscode.TreeItem {

	readonly children: TreeItem[] = [];

	constructor(
		public readonly label: string,
		public readonly fullPrefix: string,
	) {
		super(label, vscode.TreeItemCollapsibleState.Expanded);
		this.iconPath = new vscode.ThemeIcon('symbol-folder');
		this.contextValue = 'group';
	}

}

export class CommandItem extends vscode.TreeItem {

	constructor(
		public readonly name: string,
		public readonly cmd: ForgeCommand,
		collapsible: vscode.TreeItemCollapsibleState,
	) {
		super(displayName(name), collapsible);
		this.tooltip = cmd.description ?? name;

		if (cmd.description)
			this.description = cmd.description;

		if (cmd.script) {
			this.iconPath = scriptIcon(cmd.script);
			this.contextValue = 'runnable|script';
			this.command = {
				title:     'Open Script',
				command:   'forge.openScript',
				arguments: [resolveScriptPath(cmd)],
			};
		}
		else if (cmd.run) {
			this.iconPath = new vscode.ThemeIcon('layers');
			this.contextValue = 'runnable|composite';
		}
	}

}

class StepItem extends vscode.TreeItem {

	constructor(
		label: string,
		description?: string,
	) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.iconPath = new vscode.ThemeIcon('arrow-right');
		this.contextValue = 'step';

		if (description)
			this.description = description;
	}

}

// ── Tree Provider ──────────────────────────────────────────────────

export class ForgeTreeProvider implements vscode.TreeDataProvider<TreeItem> {

	protected _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(protected readonly service: ForgeManifestService) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: TreeItem): TreeItem[] {
		if (!element)
			return this.buildRootTree();

		if (element instanceof FolderItem)
			return element.children;

		if (element instanceof GroupItem)
			return element.children;

		if (element instanceof CommandItem)
			return this.buildStepChildren(element.cmd);

		return [];
	}

	// ── Build tree from merged commands ──────────────────────────

	protected buildRootTree(): TreeItem[] {
		const manifests = this.service.getManifests();

		if (manifests.size === 0)
			return [new vscode.TreeItem('No forge commands found') as TreeItem];

		// Single manifest — show commands flat.
		if (manifests.size === 1) {
			const [, manifest] = [...manifests.entries()][0]!;

			return this.buildCommandTree(manifest.commands);
		}

		// Multiple manifests — group by folder.
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
		const items: TreeItem[] = [];

		for (const [dir, manifest] of manifests) {
			const relativePath = path.relative(workspaceRoot, dir) || '.';
			const folder = new FolderItem(dir, relativePath);
			folder.children.push(...this.buildCommandTree(manifest.commands));
			items.push(folder);
		}

		return items;
	}

	protected buildCommandTree(commands: Map<string, ForgeCommand>): TreeItem[] {
		if (commands.size === 0)
			return [];

		// Build a tree from colon-separated names.
		// e.g. "deploy:staging" → Group("deploy") → Command("staging")
		const root = new Map<string, GroupItem | CommandItem>();
		const groups = new Map<string, GroupItem>();

		// Sort command names for stable display order.
		const sorted = [...commands.entries()].sort(([a], [b]) => a.localeCompare(b));

		for (const [name, cmd] of sorted) {
			const parts = name.split(':');

			if (parts.length === 1) {
				// Top-level command — may also be a group prefix.
				const existing = root.get(name);
				if (existing instanceof GroupItem) {
					// A group already exists for this prefix.
					// Insert the command as the first child (the group "root" command).
					const item = new CommandItem(name, cmd, childCollapsibility(cmd));
					existing.children.unshift(item);
				}
				else {
					root.set(name, new CommandItem(name, cmd, childCollapsibility(cmd)));
				}
			}
			else {
				// Nested command — ensure group exists.
				const prefix = parts[0]!;
				let group = groups.get(prefix);
				if (!group) {
					group = new GroupItem(prefix, prefix);
					groups.set(prefix, group);

					// If a top-level command already occupies this slot, move it into the group.
					const existing = root.get(prefix);
					if (existing instanceof CommandItem) {
						group.children.push(existing);
					}

					root.set(prefix, group);
				}

				const childName = parts.slice(1).join(':');
				const item = new CommandItem(name, cmd, childCollapsibility(cmd));
				// Override the label to show only the child portion.
				item.label = childName;
				group.children.push(item);
			}
		}

		return [...root.values()];
	}

	protected buildStepChildren(cmd: ForgeCommand): StepItem[] {
		if (!cmd.run)
			return [];

		const items: StepItem[] = [];

		for (const step of cmd.run) {
			if (step.parallel) {
				items.push(new StepItem(
					`parallel: [${step.parallel.join(', ')}]`,
					'concurrent',
				));
			}
			else if (step.command) {
				const argsStr = step.args ? ` ${step.args.join(' ')}` : '';
				items.push(new StepItem(step.command + argsStr));
			}
		}

		return items;
	}

}

// ── Helpers ────────────────────────────────────────────────────────

/** Display the last segment of a colon-delimited name. */
function displayName(name: string): string {
	const parts = name.split(':');

	return parts[parts.length - 1]!;
}

/** Pick an icon based on script file extension. */
function scriptIcon(script: string): vscode.ThemeIcon {
	const ext = path.extname(script).toLowerCase();
	switch (ext) {
	case '.go': return new vscode.ThemeIcon('symbol-method');
	case '.ts': return new vscode.ThemeIcon('symbol-interface');
	case '.cs': return new vscode.ThemeIcon('symbol-class');
	default: return new vscode.ThemeIcon('file-code');
	}
}

/** Resolve a command's script path to an absolute path. */
function resolveScriptPath(cmd: ForgeCommand): string {
	return path.resolve(cmd.manifestDir, cmd.script!);
}

/** Determine collapsibility based on whether a command has run steps. */
function childCollapsibility(cmd: ForgeCommand): vscode.TreeItemCollapsibleState {
	return cmd.run && cmd.run.length > 0
		? vscode.TreeItemCollapsibleState.Collapsed
		: vscode.TreeItemCollapsibleState.None;
}
