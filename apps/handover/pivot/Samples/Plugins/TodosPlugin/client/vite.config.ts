import { pivotPlugin } from '@arcmantle/pivot-vite-plugin';
import { defineConfig } from 'vite';


export default defineConfig({
	plugins: [
		pivotPlugin({
			name:           'TodosPlugin',
			entry:          'src/index.ts',
			clientManifest: {
				entryModule: 'index.js',
				routes:      [
					{
						path:          '/todos',
						name:          'todos',
						label:         'Todos',
						icon:          '✅',
						lazyComponent: 'TodosPage',
					},
				],
			},
		}),
	],
}) as ReturnType<typeof defineConfig>;
