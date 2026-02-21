import { libConfig } from '@arcmantle/vite-lib-config';
import { componentAutoImporter } from '@arcmantle/vite-plugin-ce-auto-import';
import { importCSSSheet } from '@arcmantle/vite-plugin-import-css-sheet';


export default libConfig({
	esbuild: {
		minifyIdentifiers: false,
	},
	plugins: [
		componentAutoImporter({
			directories:   [ { path: './src/components' } ],
			prefixes:      [ /mm-/ ],
			loadWhitelist: [ /./ ],
			loadBlacklist: [ /\.demo/ ],
		}),
		importCSSSheet(),
	],
});
