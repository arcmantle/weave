import { builtinModules } from 'node:module';

import { defineConfig } from 'vite';


export default defineConfig({
	build: {
		lib: {
			entry:    'src/extension.ts',
			formats:  [ 'cjs' ],
			fileName: () => 'extension.js',
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
				entryFileNames: 'extension.js',
			},
		},
		target: 'node18',
	},
	resolve: {
		mainFields: [ 'module', 'main' ],
		conditions: [ 'node' ],
	},
});
