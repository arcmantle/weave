import type { PluginOption } from 'vite';

import { ImportCSSSheet } from './import-css-sheet.js';


export const importCSSSheet = (options?: Partial<{
	transformers:   ((code: string, id: string) => string)[];
	additionalCode: string[];
	minify:         boolean;
	/** Enables auto import and assignment of stylesheet. */
	autoImport:     {
		/**
		 * Configuration for identifying classes and style properties to use when
		 * augmenting the class with the imported CSSStyleSheet.
		 */
		identifier: {
			/** Class where the auto imported CSSStyleSheet will be automatically added */
			className: string;
			/** Identifier to use for the imported CSSStyleSheet */
			styleName: string;
			/** Position to add the stylesheet in the array: 'prepend' (default) or 'append' */
			position?: 'prepend' | 'append';
		}[];
	};
}>): PluginOption => {
	const {
		transformers = [],
		additionalCode = [],
		minify = true,
	} = options ?? {};

	let importSheet: ImportCSSSheet;

	return {
		enforce: 'pre',
		name:    '@arcmantle/vite-plugin-import-css-sheet',
		configResolved(config) {
			importSheet = new ImportCSSSheet(
				config,
				transformers,
				additionalCode,
				minify,
				options?.autoImport,
			);
		},
		resolveId: {
			filter: {
				id: [ /\.css$/ ],
			},
			handler(source, importer, options) {
				return importSheet.resolveId(this, source, importer, options);
			},
		},
		load(id, options) {
			return importSheet.load(this, id, options);
		},
		transform: {
			filter: {
				id: [ /\.ts$|\.mts$|\.tsx$|\.js$|\.mjs$|\.jsx$/ ],
			},
			handler(code, id, options) {
				return importSheet.transform(code, id, options);
			},
		},
		buildEnd() {
			if (importSheet.config.mode !== 'development') {
				const { totalBeforeMinify, totalAfterMinify } = importSheet;
				console.log('\n@arcmantle/vite-plugin-import-css-sheet');
				console.log('Minified css sheet by', totalBeforeMinify - totalAfterMinify, 'characters.');
				console.log('Before minify:', totalBeforeMinify, '. After minify:', totalAfterMinify);
			}
		},
	};
};
