import { litJsx } from '@arcmantle/lit-jsx/vite';
import { libConfig } from '@arcmantle/vite-lib-config';


export default libConfig({
	plugins: [ litJsx() ],
	build:   {
		outDir: './dist',
	},
	worker: {
		format: 'es',
	},
}) as ReturnType<typeof libConfig>;
