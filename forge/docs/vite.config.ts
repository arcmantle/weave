import { resolve } from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
	root:  './src',
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
