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
	/** Absolute path to the forge.yaml (or synthetic for auto-discovered scripts). */
	manifestPath: string;
	/** Merged command map — closest wins. */
	commands: Map<string, ForgeCommand>;
}

// ── Manifest Service ───────────────────────────────────────────────

/**
 * Discovers, parses, and merges forge.yaml manifests and auto-discovered
 * scripts for all workspace folders. Mirrors the Go CLI's discovery logic.
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
		this.walkForManifests(rootDir, rootDir, results);

		return results;
	}

	protected walkForManifests(dir: string, rootDir: string, results: string[]): void {
		const hasYaml = fs.existsSync(path.join(dir, 'forge.yaml'));
		const hasScripts = fs.existsSync(path.join(dir, '.forge', 'scripts'));

		if (hasYaml || hasScripts)
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

				this.walkForManifests(path.join(dir, entry.name), rootDir, results);
			}
		}
		catch {
			// skip unreadable directories
		}
	}

	/**
	 * Load a manifest at a specific directory — reads forge.yaml and
	 * auto-discovers .forge/scripts/ in that directory only.
	 */
	protected loadManifestAt(dir: string): ResolvedManifest | null {
		const commands = new Map<string, ForgeCommand>();

		// Auto-discovered scripts (lower priority).
		const scriptsDir = path.join(dir, '.forge', 'scripts');
		if (fs.existsSync(scriptsDir) && fs.statSync(scriptsDir).isDirectory()) {
			const scriptManifest = this.discoverScriptsInDir(scriptsDir, dir);
			if (scriptManifest) {
				for (const [name, cmd] of scriptManifest.commands) {
					commands.set(name, cmd);
				}
			}
		}

		// Explicit YAML commands (higher priority — overwrites auto-discovered).
		const yamlPath = path.join(dir, 'forge.yaml');
		if (fs.existsSync(yamlPath)) {
			const yamlManifest = this.loadYaml(yamlPath);
			if (yamlManifest) {
				for (const [name, cmd] of yamlManifest.commands) {
					commands.set(name, cmd);
				}
			}
		}

		if (commands.size === 0)
			return null;

		return {
			manifestPath: yamlPath,
			commands,
		};
	}

	// ── Parsing ──────────────────────────────────────────────────

	protected loadYaml(filePath: string): ResolvedManifest | null {
		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			const parsed = parseYaml(content) as { commands?: Record<string, YamlCommand> } | null;
			if (!parsed?.commands)
				return null;

			const dir = path.dirname(filePath);
			const commands = new Map<string, ForgeCommand>();

			for (const [name, def] of Object.entries(parsed.commands)) {
				commands.set(name, {
					description: def.description,
					script:      def.script,
					run:         def.run ? this.parseRunSteps(def.run) : undefined,
					manifestDir: dir,
				});
			}

			return { manifestPath: filePath, commands };
		}
		catch {
			return null;
		}
	}

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

	protected discoverScriptsInDir(scriptsDir: string, manifestDir: string): ResolvedManifest | null {
		const scriptExtensions = ['.go', '.ts', '.cs'];

		try {
			const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
			const commands = new Map<string, ForgeCommand>();

			for (const entry of entries) {
				if (!entry.isDirectory())
					continue;

				const name = entry.name;
				const scriptSubDir = path.join(scriptsDir, name);

				for (const ext of scriptExtensions) {
					const scriptFile = path.join(scriptSubDir, name + ext);
					if (fs.existsSync(scriptFile)) {
						const relPath = path.join('.forge', 'scripts', name, name + ext);
						commands.set(name, {
							script:      relPath,
							manifestDir: manifestDir,
						});
						break; // first matching extension wins
					}
				}
			}

			return { manifestPath: scriptsDir, commands };
		}
		catch {
			return null;
		}
	}
}

// ── YAML shape ─────────────────────────────────────────────────────

interface YamlCommand {
	description?: string;
	script?: string;
	run?: unknown[];
}
