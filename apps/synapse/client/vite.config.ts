import { importCSSSheet } from '@arcmantle/vite-plugin-import-css-sheet';
import { defineConfig } from 'vite';


export default defineConfig({
	plugins: [ importCSSSheet() ],
});
