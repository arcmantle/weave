import { pivotPlugin } from '@arcmantle/pivot-vite-plugin';
import { defineConfig } from 'vite';


export default defineConfig({
	plugins: [
		pivotPlugin({
			name:           'WeatherPlugin',
			entry:          'src/index.ts',
			clientManifest: {
				entryModule: 'index.js',
				routes:      [
					{
						path:          '/weather',
						name:          'weather',
						label:         'Weather',
						icon:          '🌤️',
						lazyComponent: 'WeatherPage',
					},
				],
			},
		}),
	],
}) as ReturnType<typeof defineConfig>;
