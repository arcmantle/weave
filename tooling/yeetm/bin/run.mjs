#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(fileURLToPath(import.meta.url), '..');

const platform = process.platform;
const arch = process.arch;

const binaries = {
	'win32-x64':    'yeetm-win-x64.exe',
	'win32-arm64':  'yeetm-win-arm64.exe',
	'linux-x64':    'yeetm-linux-x64',
	'linux-arm64':  'yeetm-linux-arm64',
	'darwin-x64':   'yeetm-darwin-x64',
	'darwin-arm64': 'yeetm-darwin-arm64',
};

const key = `${ platform }-${ arch }`;
const name = binaries[key];

if (!name) {
	console.error(`Unsupported platform: ${ platform } ${ arch }`);
	process.exit(1);
}

const bin = join(dir, name);

if (!existsSync(bin)) {
	console.error(`Binary not found: ${ bin }`);
	process.exit(1);
}

try {
	execFileSync(bin, process.argv.slice(2), { stdio: 'inherit' });
}
catch (err) {
	process.exit(err.status ?? 1);
}
