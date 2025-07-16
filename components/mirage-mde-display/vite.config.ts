import { libConfig } from '@arcmantle/vite-lib-config';
import { importCSSSheet } from '@arcmantle/vite-plugin-import-css-sheet';


export default libConfig({
	plugins: [ importCSSSheet() ],
}) as ReturnType<typeof libConfig>;
