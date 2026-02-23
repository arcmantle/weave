import { spawn, execSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, relative, resolve } from 'node:path';
import { argv, stdout, stderr } from 'node:process';

// --- Args ---

/** Returns the command arguments passed to this script. */
export function args(): string[] {
	return argv.slice(2);
}

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

// --- Command Builder ---

interface ArgDef {
	name: string;
	description: string;
	type: 'string' | 'bool';
	positional: boolean;
	required: boolean;
	defaultVal: string;
	value: StringValue | BoolValue;
}

/** Holds a parsed string argument value. */
export class StringValue {
	constructor(public value: string = '') {}
}

/** Holds a parsed boolean flag value. */
export class BoolValue {
	constructor(public value: boolean = false) {}
}

/**
 * Creates a command argument builder.
 *
 * ```ts
 * const cmd = command('greet', 'Greet someone');
 * const name = cmd.arg('name', 'Name to greet');
 * const shout = cmd.flag('shout', 'Uppercase the greeting');
 * cmd.parse();
 * ```
 */
export function command(name: string, description: string): CmdBuilder {
	return new CmdBuilder(name, description);
}

class CmdBuilder {
	protected defs: ArgDef[] = [];

	constructor(
		protected readonly cmdName: string,
		protected readonly cmdDescription: string,
	) {}

	/** Define a required positional argument. */
	arg(name: string, description: string): StringValue {
		const v = new StringValue();
		this.defs.push({
			name, description,
			type: 'string',
			positional: true,
			required: true,
			defaultVal: '',
			value: v,
		});

		return v;
	}

	/** Define a named string option (--name value). */
	option(name: string, description: string, defaultVal?: string): StringValue {
		const v = new StringValue(defaultVal ?? '');
		this.defs.push({
			name, description,
			type: 'string',
			positional: false,
			required: false,
			defaultVal: defaultVal ?? '',
			value: v,
		});

		return v;
	}

	/** Define a boolean flag (--name). Presence sets it to true. */
	flag(name: string, description: string): BoolValue {
		const v = new BoolValue();
		this.defs.push({
			name, description,
			type: 'bool',
			positional: false,
			required: false,
			defaultVal: '',
			value: v,
		});

		return v;
	}

	/**
	 * Parse command-line arguments.
	 * If --forge-meta is present, prints JSON metadata and exits.
	 * If --help or -h is present, prints a help screen and exits.
	 */
	parse(): void {
		const rawArgs = argv.slice(2);

		if (rawArgs.includes('--forge-meta')) {
			this.printMeta();
			process.exit(0);
		}

		if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
			this.printHelp();
			process.exit(0);
		}

		const positionals = this.defs.filter(d => d.positional);
		let posIdx = 0;

		for (let i = 0; i < rawArgs.length; i++) {
			const a = rawArgs[i]!;

			if (a.startsWith('--')) {
				const name = a.slice(2);
				const def = this.defs.find(d => !d.positional && d.name === name);
				if (!def) {
					error(`unknown flag: --${name}`);
					this.printHelp();
					process.exit(1);
				}

				if (def.type === 'bool') {
					(def.value as BoolValue).value = true;
				} else {
					if (i + 1 >= rawArgs.length) {
						error(`flag --${name} requires a value`);
						process.exit(1);
					}
					i++;
					(def.value as StringValue).value = rawArgs[i]!;
				}
			} else {
				if (posIdx >= positionals.length) {
					error(`unexpected argument: ${a}`);
					this.printHelp();
					process.exit(1);
				}
				(positionals[posIdx]!.value as StringValue).value = a;
				posIdx++;
			}
		}

		for (const p of positionals) {
			if (p.required && (p.value as StringValue).value === '') {
				error(`missing required argument: <${p.name}>`);
				this.printHelp();
				process.exit(1);
			}
		}
	}

	protected printHelp(): void {
		const positionals = this.defs.filter(d => d.positional);
		const flags = this.defs.filter(d => !d.positional);

		let usage = `forge ${this.cmdName}`;
		for (const p of positionals) usage += ` <${p.name}>`;
		if (flags.length > 0) usage += ' [flags]';

		console.log(`${this.cmdName} — ${this.cmdDescription}\n`);
		console.log(`Usage:\n  ${usage}`);

		if (positionals.length > 0) {
			console.log('\nArgs:');
			const maxLen = Math.max(...positionals.map(p => p.name.length));
			for (const p of positionals) {
				console.log(`  ${p.name.padEnd(maxLen)}    ${p.description}`);
			}
		}

		if (flags.length > 0) {
			console.log('\nFlags:');
			const flagNames = flags.map(f => f.type === 'string' ? `--${f.name} <value>` : `--${f.name}`);
			const maxLen = Math.max(...flagNames.map(n => n.length));
			for (let i = 0; i < flags.length; i++) {
				let desc = flags[i]!.description;
				if (flags[i]!.defaultVal) desc += ` (default: ${flags[i]!.defaultVal})`;
				console.log(`  ${flagNames[i]!.padEnd(maxLen)}    ${desc}`);
			}
		}
	}

	protected printMeta(): void {
		const meta = {
			name: this.cmdName,
			description: this.cmdDescription,
			args: this.defs.map(d => ({
				name: d.name,
				type: d.type,
				description: d.description,
				...(d.positional ? { positional: true } : {}),
				...(d.required ? { required: true } : {}),
				...(d.defaultVal ? { default: d.defaultVal } : {}),
			})),
		};

		console.log(JSON.stringify(meta, null, 2));
	}
}
