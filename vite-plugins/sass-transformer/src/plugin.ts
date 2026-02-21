import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import type { Plugin } from 'vite';

import { SASSTransformer, type SASSTransformerOptions } from './sass-transformer.ts';


export const sassTransformer = (options?: Partial<SASSTransformerOptions>): Plugin => {
	options = {
		minify:     true,
		rootDir:    '',
		debugLevel: 'silent',
		...options,
	};

	let transformer: SASSTransformer;

	return {
		name:           '@arcmantle/vite-plugin-sass',
		enforce:        'pre',
		configResolved: {
			handler(cfg) {
				transformer = new SASSTransformer(cfg.root, options);
			},
		},
		resolveId: {
			async handler(source, importer, options) {
				const sourceExt = extname(source);
				if (!transformer.sourceTypes.has(sourceExt) || !importer)
					return;

				// Remove query string part of path.
				// Vite sometimes adds this to .html files.
				if (importer.includes('?'))
					importer = importer.split('?')[0]!;

				const ext = extname(importer);
				if (!transformer.filetypes.has(ext))
					return;

				const resolvedId = (await this.resolve(source, importer, options))?.id;
				if (!resolvedId)
					return;

				const importerContent = await readFile(importer, { encoding: 'utf8' });
				const regxp = transformer.cssImportAssertRegex(source);

				if (regxp.test(importerContent)) {
					const modId = '\0virtual:' + source.replace(extname(source), '.stylesheet');
					transformer.virtualModules.set(modId, resolvedId);

					return modId;
				}
			},
		},
		load: {
			async handler(id, options) {
				const result = await transformer.load(id);
				if (!result)
					return;

				this.addWatchFile(result.realId);

				return result.code;
			},
		},
		transform: {
			handler(code, id, options) {
				const result = transformer.transform(id, code);
				if (!result)
					return;

				return result;
			},
		},
	};
};
