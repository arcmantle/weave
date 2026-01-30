import { defineConfig, type UserConfig } from 'vite';

export default defineConfig({
	esbuild: {
		supported: {
			'top-level-await': true,
		},
	},
	build: {
		target: 'es2022',
		outDir: 'dist',
	},
	server: {
		port:  3000,
		proxy: {
			'/api': {
				target:       'http://localhost:5100',
				changeOrigin: true,
			},
		},
	},
}) as UserConfig;
