import { exec } from 'child_process';

import * as vscode from 'vscode';

// ── Types matching forge's --forge-meta JSON output ────────────────

export interface ArgMeta {
	name: string;
	type: string;        // "string" | "bool"
	description: string;
	positional?: boolean;
	required?: boolean;
	default?: string;
}

export interface CommandMeta {
	name: string;
	description: string;
	args?: ArgMeta[];
}

// ── Service ────────────────────────────────────────────────────────

/**
 * Runs `forge <command> --forge-meta` to retrieve argument metadata.
 * Returns null if the command doesn't support introspection (no Parse() call).
 */
export function fetchCommandMeta(commandName: string, cwd?: string): Promise<CommandMeta | null> {
	const resolvedCwd = cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

	return new Promise(resolve => {
		const cliArgs = commandName.replace(/:/g, ' ');
		const command = `forge ${cliArgs} --forge-meta`;

		exec(command, { cwd: resolvedCwd, timeout: 15_000 }, (err, stdout) => {
			if (err || !stdout.trim()) {
				resolve(null);

				return;
			}

			try {
				const meta = JSON.parse(stdout.trim()) as CommandMeta;
				resolve(meta);
			}
			catch {
				resolve(null);
			}
		});
	});
}

// ── Prompting ──────────────────────────────────────────────────────

/**
 * Prompts the user for argument values based on command metadata.
 * Returns the assembled argument string, or undefined if cancelled.
 */
export async function promptForArgs(meta: CommandMeta): Promise<string | undefined> {
	if (!meta.args || meta.args.length === 0)
		return '';

	const positionals = meta.args.filter(a => a.positional);
	const flags       = meta.args.filter(a => !a.positional && a.type === 'bool');
	const options     = meta.args.filter(a => !a.positional && a.type === 'string');

	const parts: string[] = [];

	// Prompt for positional args (required).
	for (const arg of positionals) {
		const value = await vscode.window.showInputBox({
			prompt:      `${arg.name} — ${arg.description}`,
			placeHolder: arg.name,
			validateInput: v => {
				if (arg.required && !v?.trim())
					return `${arg.name} is required`;

				return undefined;
			},
		});

		if (value === undefined)
			return undefined; // cancelled

		if (value.trim())
			parts.push(value.trim());
	}

	// Prompt for options (named key-value pairs).
	for (const opt of options) {
		const defaultLabel = opt.default ? ` (default: ${opt.default})` : '';
		const value = await vscode.window.showInputBox({
			prompt:      `--${opt.name} — ${opt.description}${defaultLabel}`,
			placeHolder: opt.default ?? opt.name,
			value:       opt.default ?? '',
		});

		if (value === undefined)
			return undefined; // cancelled

		// Only include if different from default (or if there's no default).
		if (value.trim() && value.trim() !== opt.default)
			parts.push(`--${opt.name}`, value.trim());
	}

	// Prompt for flags (boolean toggles) — show as quick pick with checkboxes.
	if (flags.length > 0) {
		const items = flags.map(f => ({
			label:       `--${f.name}`,
			description: f.description,
			picked:      false,
		}));

		const selected = await vscode.window.showQuickPick(items, {
			canPickMany: true,
			placeHolder: 'Select flags to enable (optional)',
		});

		if (selected === undefined)
			return undefined; // cancelled

		for (const item of selected) {
			parts.push(item.label);
		}
	}

	return parts.join(' ');
}
