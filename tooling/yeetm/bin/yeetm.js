#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { arch, platform } from 'node:process';
import { fileURLToPath } from 'node:url';

const ARCH_MAP = { 'x64': 'x64', 'arm64': 'arm64' };
const OS_MAP   = { 'darwin': 'darwin', 'linux': 'linux', 'win32': 'win32' };

const npmOs  = OS_MAP[platform];
const npmCpu = ARCH_MAP[arch];

if (!npmOs || !npmCpu) {
	console.error('yeetm: unsupported platform ' + platform + '/' + arch);
	process.exit(1);
}

const ext = platform === 'win32' ? '.exe' : '';
const pkgName = '@arcmantle/yeetm-' + npmOs + '-' + npmCpu;

let bin;
try {
	// Resolve the binary from the platform-specific optional dependency.
	const pkgPath = import.meta.resolve(pkgName + '/package.json');
	const pkgDir = dirname(pkgPath.startsWith('file:') ? fileURLToPath(pkgPath) : pkgPath);
	bin = join(pkgDir, 'yeetm' + ext);
}
catch {
	console.error(
		'yeetm: could not find platform package ' + pkgName + '\n' +
		'       Make sure optional dependencies are installed.',
	);
	process.exit(1);
}

const result = spawnSync(bin, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
	console.error('yeetm: failed to run binary at ' + bin);
	console.error(String(result.error.message || result.error));
	process.exit(1);
}

process.exit(result.status ?? 1);
