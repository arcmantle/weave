import { join } from 'node:path';

import { importCSSSheet } from '@arcmantle/vite-plugin-import-css-sheet';
import { defineConfig } from 'vite';


export default defineConfig({
	root:    join(process.cwd(), 'demo'),
	plugins: [ importCSSSheet() ],

}) as ReturnType<typeof defineConfig>;
