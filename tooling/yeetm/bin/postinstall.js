#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { arch, exit, platform, stderr } from 'node:process';
import { fileURLToPath } from 'node:url';

if (platform !== 'darwin')
	exit(0);

const ARCH_MAP = { x64: 'x64', arm64: 'arm64' };
const npmCpu = ARCH_MAP[arch];
if (!npmCpu)
	exit(0);

const pkgName = '@arcmantle/yeetm-darwin-' + npmCpu;

let binaryPath;
try {
	const pkgPath = import.meta.resolve(pkgName + '/package.json');
	const pkgDir = dirname(pkgPath.startsWith('file:') ? fileURLToPath(pkgPath) : pkgPath);
	binaryPath = join(pkgDir, 'yeetm');
}
catch {
	exit(0);
}

const chmodResult = spawnSync('chmod', [ '+x', binaryPath ], {
	encoding: 'utf8',
});
if (chmodResult.error || chmodResult.status !== 0) {
	const detail = chmodResult.error?.message || chmodResult.stderr || `exit code ${ String(chmodResult.status) }`;
	stderr.write('yeetm postinstall: chmod +x failed: ' + String(detail).trim() + '\n');
}

const xattrResult = spawnSync('xattr', [ '-dr', 'com.apple.quarantine', binaryPath ], {
	encoding: 'utf8',
});
if (xattrResult.error || xattrResult.status !== 0) {
	const detail = xattrResult.error?.message || xattrResult.stderr || `exit code ${ String(xattrResult.status) }`;
	stderr.write('yeetm postinstall: xattr cleanup failed: ' + String(detail).trim() + '\n');
}

exit(0);
