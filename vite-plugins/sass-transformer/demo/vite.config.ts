import { defineConfig, type UserConfig } from 'vite';

import { sassTransformer } from '../src/index.ts';


export default defineConfig({
	root:    './demo',
	plugins: [
		sassTransformer({
			rootDir:    './styles',
			debugLevel: 'error',
		}),
	],
}) as UserConfig;
