import { pivotPlugin } from '@arcmantle/pivot-vite-plugin';
import { defineConfig } from 'vite';


export default defineConfig({
	plugins: [
		pivotPlugin({
			name:           'UsersPlugin',
			entry:          'src/index.ts',
			clientManifest: {
				entryModule: 'index.js',
				routes:      [
					{
						path:          '/users',
						name:          'users',
						label:         'Users',
						icon:          '👥',
						lazyComponent: 'UsersPage',
					},
				],
			},
		}),
	],
}) as ReturnType<typeof defineConfig>;
