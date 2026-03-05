import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

interface Entry {
	input:  string;
	output: string;
}

const entries: Entry[] = [ { input: join('src', 'app-shell.ts'), output: 'app-shell.js' } ];

const distDir = join('..', 'internal', 'docs', 'dist');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await copyFile(join('src', 'index.html'), join(distDir, 'index.html'));
await copyFile(join('src', 'styles.css'), join(distDir, 'styles.css'));
await copyFile(join('src', 'favicon.svg'), join(distDir, 'favicon.svg'));

const result = await Bun.build({
	entrypoints: entries.map(entry => entry.input),
	outdir:      distDir,
	target:      'browser',
	format:      'esm',
	bundle:      true,
	minify:      false,
	sourcemap:   'none',
	naming:      '[name].js',
} as any);

if (!result.success) {
	console.error('Failed building docs bundles:');
	for (const log of result.logs)
		console.error(log);

	process.exit(1);
}

for (const entry of entries) {
	const exists = await Bun.file(join(distDir, entry.output)).exists();
	if (!exists) {
		console.error(`Missing expected output: ${ join(distDir, entry.output) }`);
		process.exit(1);
	}
}

console.log('Built docs client assets in dist/: index.html, styles.css, favicon.svg, app-shell.js');
