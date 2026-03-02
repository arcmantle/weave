import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';
import { parse as parseYaml } from 'yaml';

// ── Types ──────────────────────────────────────────────────────────

export interface RunStep {
	command?: string;
	args?: string[];
	parallel?: string[];
}

export interface ForgeCommand {
	description?: string;
	script?: string;
	run?: RunStep[];
	/** Resolved absolute directory of the manifest that defined this command. */
	manifestDir: string;
}

export interface ResolvedManifest {
	/** Absolute path to the scripts root for this project. */
	manifestPath: string;
	/** Merged command map — closest wins. */
	commands: Map<string, ForgeCommand>;
}

// ── Manifest Service ───────────────────────────────────────────────

/**
 * Discovers and parses template.yaml command definitions under .forge/scripts.
 * for all workspace folders.
 */
export class ForgeManifestService {

	protected manifests: Map<string, ResolvedManifest> = new Map();

	/** Flat map of all commands across all workspace folders. */
	getAllCommands(): Map<string, ForgeCommand> {
		const result = new Map<string, ForgeCommand>();
		for (const m of this.manifests.values()) {
			for (const [name, cmd] of m.commands) {
				result.set(name, cmd);
			}
		}

		return result;
	}

	/** Get resolved manifest for a specific workspace folder. */
	getManifest(folderUri: string): ResolvedManifest | undefined {
		return this.manifests.get(folderUri);
	}

	/** Get all resolved manifests. */
	getManifests(): Map<string, ResolvedManifest> {
		return this.manifests;
	}

	/** Re-scan all workspace folders. */
	refresh(): void {
		this.manifests.clear();

		const folders = vscode.workspace.workspaceFolders;
		if (!folders)
			return;

		for (const folder of folders) {
			const folderPath = folder.uri.fsPath;
			const found = this.findAllManifests(folderPath);

			for (const manifestDir of found) {
				const resolved = this.loadManifestAt(manifestDir);
				if (resolved)
					this.manifests.set(manifestDir, resolved);
			}
		}
	}

	// ── Discovery ────────────────────────────────────────────────

	/**
	 * Recursively find all directories that contain a forge.yaml or
	 * .forge/scripts/ directory within the workspace. Returns absolute paths.
	 */
	protected findAllManifests(rootDir: string): string[] {
		const results: string[] = [];
		this.walkForManifests(rootDir, results);

		return results;
	}

	protected walkForManifests(dir: string, results: string[]): void {
		const hasScripts = fs.existsSync(path.join(dir, '.forge', 'scripts'));

		if (hasScripts)
			results.push(dir);

		try {
			const entries = fs.readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isDirectory())
					continue;

				// Skip common non-project directories.
				if (entry.name === 'node_modules' || entry.name === '.git' ||
					entry.name === '.forge' || entry.name === 'bin' ||
					entry.name === 'obj' || entry.name === 'dist' ||
					entry.name === 'out' || entry.name === 'vendor')
					continue;

				this.walkForManifests(path.join(dir, entry.name), results);
			}
		}
		catch {
			// skip unreadable directories
		}
	}

	/**
	 * Load a scripts manifest at a specific directory by parsing
	 * .forge/scripts recursive template.yaml files in that directory.
	 */
	protected loadManifestAt(dir: string): ResolvedManifest | null {
		const scriptsDir = path.join(dir, '.forge', 'scripts');
		if (!fs.existsSync(scriptsDir) || !fs.statSync(scriptsDir).isDirectory())
			return null;

		const commands = this.discoverScriptsInDir(scriptsDir, dir);

		if (commands.size === 0)
			return null;

		return {
			manifestPath: scriptsDir,
			commands,
		};
	}

	// ── Parsing ──────────────────────────────────────────────────

	protected parseRunSteps(raw: unknown[]): RunStep[] {
		const steps: RunStep[] = [];

		for (const item of raw) {
			if (typeof item === 'string') {
				const parts = item.split(/\s+/);
				steps.push({
					command:  parts[0],
					args:     parts.length > 1 ? parts.slice(1) : undefined,
				});
			}
			else if (typeof item === 'object' && item !== null) {
				const obj = item as Record<string, unknown>;
				if ('parallel' in obj && Array.isArray(obj.parallel)) {
					steps.push({ parallel: obj.parallel as string[] });
				}
				else if ('command' in obj) {
					steps.push({
						command: obj.command as string,
						args:    Array.isArray(obj.args) ? obj.args as string[] : undefined,
					});
				}
			}
		}

		return steps;
	}

	protected discoverScriptsInDir(scriptsDir: string, manifestDir: string): Map<string, ForgeCommand> {
		const scriptExtensions = ['.go', '.ts', '.cs'];
		const commands = new Map<string, ForgeCommand>();

		try {
			const walk = (dir: string): void => {
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = path.join(dir, entry.name);

					if (entry.isDirectory()) {
						if (entry.name === 'node_modules' || entry.name === '.git' ||
							entry.name === 'bin' || entry.name === 'obj' ||
							entry.name === 'dist' || entry.name === 'out' || entry.name === 'vendor') {
							continue;
						}
						walk(fullPath);
						continue;
					}

					if (!entry.isFile() || entry.name !== 'template.yaml')
						continue;

					const commandDir = path.dirname(fullPath);
					const relativeCommandDir = path.relative(scriptsDir, commandDir);
					if (!relativeCommandDir || relativeCommandDir.startsWith('..'))
						continue;

					const commandName = relativeCommandDir.split(path.sep).join(':');
					const parsed = this.loadCommandTemplate(fullPath);
					if (!parsed)
						continue;

					let script = parsed.script;
					if (!script && !parsed.run) {
						const leaf = path.basename(commandDir);
						for (const ext of scriptExtensions) {
							const candidate = path.join(commandDir, leaf + ext);
							if (fs.existsSync(candidate)) {
								script = leaf + ext;
								break;
							}
						}
					}

					let resolvedScript: string | undefined;
					if (script) {
						const absoluteScript = path.isAbsolute(script)
							? script
							: path.resolve(commandDir, script);
						resolvedScript = path.relative(manifestDir, absoluteScript);
					}

					commands.set(commandName, {
						description: parsed.description,
						script: resolvedScript,
						run: parsed.run,
						manifestDir,
					});
				}
			};

			walk(scriptsDir);
		}
		catch {
			return commands;
		}

		return commands;
	}

	protected loadCommandTemplate(filePath: string): TemplateCommand | null {
		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			const parsed = parseYaml(content) as TemplateYaml | null;
			if (!parsed || typeof parsed !== 'object')
				return null;

			const run = Array.isArray(parsed.run) ? this.parseRunSteps(parsed.run) : undefined;

			return {
				description: typeof parsed.description === 'string' ? parsed.description : undefined,
				script: typeof parsed.script === 'string' ? parsed.script : undefined,
				run,
			};
		}
		catch {
			return null;
		}
	}
}

// ── YAML shape ─────────────────────────────────────────────────────

interface TemplateYaml {
	description?: string;
	script?: string;
	run?: unknown[];
}

interface TemplateCommand {
	description?: string;
	script?: string;
	run?: RunStep[];
}
