import { type ChildProcess, spawn } from 'node:child_process';
import { resolve } from 'node:path';

import { defineConfig, type Plugin } from 'vite';

function forgeDocsServer(): Plugin {
	let proc: ChildProcess | undefined;

	return {
		name:  'forge-docs-server',
		apply: 'serve',
		configureServer() {
			const playgroundDir = resolve(__dirname, '../../forge-playground');

			proc = spawn('go', ['run', './cmd/forge/main.go', '--cwd', playgroundDir, '--docs-serve'], {
				cwd:   resolve(__dirname, '..'),
				stdio: 'inherit',
			});

			proc.on('error', (err) => console.error('[forge-docs-server]', err.message));
		},
		closeBundle() {
			proc?.kill();
		},
	};
}

export default defineConfig({
	root:    './src',
	plugins: [forgeDocsServer()],
	server:  {
		proxy: {
			'/api': 'http://127.0.0.1:4000',
		},
	},
	build: {
		outDir:         resolve(__dirname, '../internal/docs/dist'),
		emptyOutDir:    true,
		minify:         false,
		sourcemap:      false,
		rollupOptions: {
			output: {
				entryFileNames: 'app-shell.js',
				inlineDynamicImports: true,
			},
		},
	},
});
