import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		target: 'esnext',
	},
}) as ReturnType<typeof defineConfig>;
