import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const filePath = fileURLToPath(import.meta.url);
const scriptsDir = dirname(filePath);
const appRoot = resolve(scriptsDir, '..');

const clientDistCandidates = [
	resolve(appRoot, 'client', 'src', 'dist'),
	resolve(appRoot, 'client', 'dist'),
];
const serverEmbeddedDist = resolve(appRoot, 'server', 'internal', 'web', 'dist');

let clientDist = '';


for (const candidate of clientDistCandidates) {
	try {
		const candidateStats = await stat(candidate);
		if (!candidateStats.isDirectory())
			continue;

		clientDist = candidate;
		break;
	}
	catch {
		continue;
	}
}

if (!clientDist) {
	throw new Error(
		'Client build output was not found. Run "pnpm --dir ./client build" before syncing embedded assets. Checked client/src/dist and client/dist.',
	);
}

await rm(serverEmbeddedDist, { recursive: true, force: true });
await mkdir(serverEmbeddedDist, { recursive: true });
await cp(clientDist, serverEmbeddedDist, { recursive: true });

console.log('Synced embedded assets from client/dist to server/internal/web/dist');
