import { litJsx } from '@arcmantle/lit-jsx/vite';
import { defineConfig } from 'vite';


export default defineConfig({
	plugins: [ litJsx() ],
	root:    './demo',
	build:   {
		outDir: '../dist/demo',
	},
}) as ReturnType<typeof defineConfig>;
