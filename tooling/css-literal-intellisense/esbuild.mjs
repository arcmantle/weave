import * as esbuild from 'esbuild';

await esbuild.build({
	entryPoints: [ 'src/extension.ts' ],
	bundle:      true,
	outdir:      'dist',
	platform:    'node',
	target:      'node18',
	format:      'cjs',
	sourcemap:   true,
	external:    [ 'vscode' ],
	minify:      false,
	mainFields:  [ 'module', 'main' ],
});
