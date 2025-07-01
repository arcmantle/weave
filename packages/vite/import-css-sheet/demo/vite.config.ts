import { defineConfig, type UserConfig } from 'vite';

import { importCSSSheet } from '../src/index.ts';


export default defineConfig({
	root:    './demo',
	plugins: [ importCSSSheet() ],
}) as UserConfig;
