import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const filePath = fileURLToPath(import.meta.url);
const scriptsDir = dirname(filePath);
const appRoot = resolve(scriptsDir, '..');
const npmExecPath = process.env.npm_execpath;

const childProcesses = [];

function spawnDevCommand(command, args, cwd) {
	const child = spawn(command, args, {
		cwd,
		stdio: 'inherit',
		env:   process.env,
	});

	childProcesses.push(child);

	child.on('exit', (code) => {
		if (code !== 0) {
			console.error(`[food-guru] process exited with code ${ code }; shutting down dev mode.`);
			void shutdown(code || 1);
		}
	});

	return child;
}

async function shutdown(code = 0) {
	for (const child of childProcesses) {
		if (!child.killed)
			child.kill();
	}

	process.exit(code);
}

process.on('SIGINT', () => {
	void shutdown(0);
});

process.on('SIGTERM', () => {
	void shutdown(0);
});

spawnDevCommand(process.execPath, [ './scripts/dev-backend.mjs' ], appRoot);

if (!npmExecPath) {
	console.error('[food-guru] npm_execpath is not available; run this script through pnpm.');
	process.exit(1);
}

spawnDevCommand(process.execPath, [ npmExecPath, '--dir', './client', 'dev' ], appRoot);
