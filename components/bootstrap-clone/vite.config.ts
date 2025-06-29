import { /*componentAutoImporter,*/ libConfig } from '@arcmantle/vite-lib-config';
import { transformSass } from '@arcmantle/vite-plugin-sass';
import { defineConfig } from 'vite';

export default defineConfig(libConfig({
	plugins: [
		//componentAutoImporter({
		//	directories:   [ { path: './src/components' } ],
		//	prefixes:      [ /bs-/ ],
		//	loadWhitelist: [ /./ ],
		//	loadBlacklist: [ /\.demo/ ],
		//}),
		transformSass({ debugLevel: 'error' }),
	],
}));
