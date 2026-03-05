import { defineConfig } from 'vite';


export default defineConfig({
	root:   './src',
	server: {
		proxy: {
			'/api': {
				target:       'http://127.0.0.1:8787',
				changeOrigin: true,
			},
		},
	},
}) as ReturnType<typeof defineConfig>;
