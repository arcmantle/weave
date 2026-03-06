import { builtinModules } from 'node:module';

import { defineConfig } from 'vite';


export default defineConfig({
	build: {
		lib: {
			entry:    'src/extension.ts',
			formats:  [ 'es' ],
			fileName: () => 'extension.mjs',
		},
		outDir:          'dist',
		sourcemap:       true,
		minify:          false,
		rolldownOptions: {
			external: [
				'vscode',
				...builtinModules,
				...builtinModules.map(m => `node:${ m }`),
			],
			output: {
				entryFileNames: 'extension.mjs',
			},
		},
		target: 'node18',
	},
	resolve: {
		mainFields: [ 'module', 'main' ],
		conditions: [ 'node' ],
	},
});
