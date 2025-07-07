import { litJsx } from '@arcmantle/lit-jsx/vite';
import { libConfig } from '@arcmantle/vite-lib-config';
import { importCSSSheet } from '@arcmantle/vite-plugin-import-css-sheet';
import type { UserConfig } from 'vite';


export default libConfig({
	plugins: [ litJsx(), importCSSSheet() ],
}) as UserConfig;
