import { builtinModules } from 'node:module';

import { defineConfig } from 'vite';


export default defineConfig({
	build: {
		lib: {
			entry:    'src/ts-plugin.ts',
			formats:  [ 'cjs' ],
			fileName: () => 'ts-plugin.js',
		},
		outDir:          'dist',
		sourcemap:       true,
		minify:          false,
		emptyOutDir:     false,
		rolldownOptions: {
			external: [
				'vscode',
				'typescript',
				'typescript/lib/tsserverlibrary',
				/^typescript\//,
				...builtinModules,
				...builtinModules.map(m => `node:${ m }`),
			],
			output: {
				exports:        'default',
				entryFileNames: 'ts-plugin.js',
			},
		},
		target: 'node18',
	},
	resolve: {
		mainFields: [ 'module', 'main' ],
		conditions: [ 'node' ],
	},
});
