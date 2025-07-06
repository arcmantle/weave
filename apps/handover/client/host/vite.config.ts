import { litJsx } from '@arcmantle/lit-jsx/vite';
import { importCSSSheet } from '@arcmantle/vite-plugin-import-css-sheet';
import { defineConfig, type UserConfig } from 'vite';


export default defineConfig({
	plugins: [ litJsx(), importCSSSheet() ],
}) as UserConfig;
