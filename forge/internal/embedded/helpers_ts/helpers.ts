import { spawn, execSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative, resolve } from 'node:path';
import { stdout, stderr } from 'node:process';

// --- Colors ---

export const ColorReset     = '\x1b[0m';
export const ColorRed       = '\x1b[31m';
export const ColorGreen     = '\x1b[32m';
export const ColorYellow    = '\x1b[33m';
export const ColorBlue      = '\x1b[34m';
export const ColorMagenta   = '\x1b[35m';
export const ColorCyan      = '\x1b[36m';
export const ColorGray      = '\x1b[90m';
export const ColorBrightRed = '\x1b[91m';

export const Colors = [
	ColorCyan,
	ColorYellow,
	ColorMagenta,
	ColorGreen,
	ColorBlue,
	ColorBrightRed,
	'\x1b[96m', // bright cyan
	'\x1b[93m', // bright yellow
	'\x1b[95m', // bright magenta
	'\x1b[92m', // bright green
];

// --- Logging ---

export function info(format: string, ...args: unknown[]): void {
	console.log(`\x1b[36minfo:\x1b[0m ${format}`, ...args);
}

export function warn(format: string, ...args: unknown[]): void {
	console.log(`\x1b[33mwarn:\x1b[0m ${format}`, ...args);
}

export function error(format: string, ...args: unknown[]): void {
	console.log(`\x1b[31merror:\x1b[0m ${format}`, ...args);
}

export function success(format: string, ...args: unknown[]): void {
	console.log(`\x1b[32m✓\x1b[0m ${format}`, ...args);
}

// --- Exec ---

export interface RunOpts {
	/** Working directory. If empty, uses the current directory. */
	dir?: string;
	/** Prefix label for output lines (e.g. workspace name). */
	tag?: string;
	/** ANSI color code for the tag. */
	color?: string;
	/** Additional environment variables. */
	env?: Record<string, string>;
	/** Suppress all output. */
	silent?: boolean;
}

/** Run a command with streaming prefixed output. */
export function exec(name: string, args: string[], opts: RunOpts = {}): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(name, args, {
			cwd:   opts.dir || process.cwd(),
			env:   { ...process.env, ...opts.env },
			stdio: opts.silent ? 'ignore' : (opts.tag ? ['ignore', 'pipe', 'pipe'] : 'inherit'),
			shell: process.platform === 'win32',
		});

		if (opts.tag && !opts.silent) {
			const tag = formatTag(opts.tag, opts.color);

			child.stdout?.on('data', (data: Buffer) => {
				for (const line of data.toString().split('\n')) {
					if (line) stdout.write(`${tag} ${line}\n`);
				}
			});

			child.stderr?.on('data', (data: Buffer) => {
				for (const line of data.toString().split('\n')) {
					if (line) stderr.write(`${tag} ${line}\n`);
				}
			});
		}

		child.on('close', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${name} exited with code ${code}`));
		});

		child.on('error', reject);
	});
}

/** Run a command and return its combined output as a string. */
export function execSimple(name: string, args: string[], dir?: string): string {
	return execSync([name, ...args].join(' '), {
		cwd:      dir || process.cwd(),
		encoding: 'utf-8',
	}).trim();
}

function formatTag(tag: string, color?: string): string {
	if (!color) return `[${tag}]`;
	return `${color}[${tag}]${ColorReset}`;
}

// --- Filesystem ---

/** Check if a file or directory exists. */
export function fileExists(path: string): boolean {
	return existsSync(path);
}

/** Find child directories of root that contain a specific file. */
export function findDirsContaining(root: string, filename: string): string[] {
	const dirs: string[] = [];

	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const candidate = join(root, entry.name, filename);
		if (existsSync(candidate)) {
			dirs.push(join(root, entry.name));
		}
	}

	return dirs;
}

/** Find directories matching a glob-like pattern under root. */
export function findDirs(root: string, pattern: string): string[] {
	const entries = readdirSync(root, { withFileTypes: true });
	return entries
		.filter(e => e.isDirectory() && matchSimple(e.name, pattern))
		.map(e => join(root, e.name));
}

/** Find files matching a glob-like pattern under root. */
export function findFiles(root: string, pattern: string): string[] {
	const entries = readdirSync(root, { withFileTypes: true });
	return entries
		.filter(e => e.isFile() && matchSimple(e.name, pattern))
		.map(e => join(root, e.name));
}

function matchSimple(name: string, pattern: string): boolean {
	const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
	return regex.test(name);
}
