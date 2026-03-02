import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const filePath = fileURLToPath(import.meta.url);
const scriptsDir = dirname(filePath);
const appRoot = resolve(scriptsDir, '..');
const serverDir = resolve(appRoot, 'server');

const watchExtensions = new Set([ '.go' ]);
const watchFiles = new Set([ 'go.mod', 'go.sum' ]);
const ignoredDirNames = new Set([ '.git', 'node_modules' ]);

let backendProcess = null;
let restarting = false;
let lastSnapshotKey = '';

function startBackend() {
	backendProcess = spawn('go', [ 'run', './cmd/food-guru', '--open-browser=false' ], {
		cwd:   serverDir,
		stdio: 'inherit',
		env:   process.env,
	});

	backendProcess.on('exit', () => {
		backendProcess = null;
	});
}

async function stopBackend() {
	if (!backendProcess)
		return;

	await new Promise((resolveStop) => {
		const proc = backendProcess;
		if (!proc)
			return resolveStop();

		proc.once('exit', () => resolveStop());
		proc.kill();
	});

	backendProcess = null;
}

async function restartBackend() {
	if (restarting)
		return;

	restarting = true;
	console.log('[food-guru] backend changed; restarting...');
	await stopBackend();
	startBackend();
	restarting = false;
}

async function collectSnapshot(rootPath) {
	const entries = await readdir(rootPath, { withFileTypes: true });
	const parts = [];

	for (const entry of entries) {
		if (ignoredDirNames.has(entry.name))
			continue;

		const absolutePath = join(rootPath, entry.name);
		if (entry.isDirectory()) {
			parts.push(await collectSnapshot(absolutePath));
			continue;
		}

		const extension = extname(entry.name);
		const shouldWatch = watchFiles.has(entry.name) || watchExtensions.has(extension);
		if (!shouldWatch)
			continue;

		const fileStats = await stat(absolutePath);
		parts.push(`${ absolutePath }:${ fileStats.mtimeMs }`);
	}

	return parts.sort().join('|');
}

async function pollLoop() {
	while (true) {
		const nextSnapshotKey = await collectSnapshot(serverDir);
		if (lastSnapshotKey && nextSnapshotKey !== lastSnapshotKey)
			await restartBackend();

		lastSnapshotKey = nextSnapshotKey;
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 700));
	}
}

function setupSignalHandlers() {
	const cleanupAndExit = async () => {
		await stopBackend();
		process.exit(0);
	};

	process.on('SIGINT', () => {
		void cleanupAndExit();
	});

	process.on('SIGTERM', () => {
		void cleanupAndExit();
	});
}

setupSignalHandlers();
startBackend();
await pollLoop();
