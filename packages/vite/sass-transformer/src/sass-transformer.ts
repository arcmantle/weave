import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { transform } from 'lightningcss';
import MagicString, { SourceMap } from 'magic-string';
import { parseAndWalk } from 'oxc-walker';
import  * as sass from 'sass';


export interface SASSTransformerOptions {
	minify:     boolean;
	rootDir:    string;
	debugLevel: 'error' | 'silent';
}


export class SASSTransformer {

	constructor(
		projectRoot: string,
		options?: Partial<SASSTransformerOptions>,
	) {
		this.projectRoot = projectRoot;
		this.options = {
			minify:     true,
			rootDir:    '',
			debugLevel: 'silent',
			...options,
		};
	}

	projectRoot:      string;
	options:          Readonly<SASSTransformerOptions>;
	decoder:          TextDecoder = new TextDecoder();
	identifierNames:  string[] = [ 'sass`', 'scss`' ];
	sourceTypes:      Set<string> = new Set([ '.scss', '.sass' ]);
	filetypes:        Set<string> = new Set([ '.ts', '.mts', '.js', '.mjs' ]);
	transformers:     ((code: string, id: string) => string)[] = [];
	additionalCode:   string[] = [];
	virtualModules:   Map<string, string> = new Map();
	charReplacements: Map<string, string> = new Map([
		[ '\\', '\\\\' ],
		[ '`', '\\`' ],
		[ '$', '\\$' ],
	]);

	convert(str: string): string {
		let res = '';
		for (const c of str)
			res += this.charReplacements.get(c) || c;

		return `\`${ res }\``;
	}

	cssImportAssertRegex(str: string): RegExp {
		return new RegExp(str + `['"] *(?:with|assert) *{ *type: *['"](?:css|scss|sass)['"]`);
	}

	fromSASSToCSS(text: string): string | undefined {
		try {
			return sass.compileString(text, {
				importers: [
					{
						findFileUrl: (url) => {
							const path = pathToFileURL(join(
								this.projectRoot,
								this.options.rootDir,
							));

							return new URL(url, path + '/');
						},
					},
				],
			}).css;
		}
		catch (err) {
			if (this.options.debugLevel !== 'silent') {
				console.error('Failed to compile sass literal');
				console.error(err);
			}
		}
	}

	minifyCSS(text: string, id: string = 'unknown'): string | undefined {
		try {
			const { code: output } = transform({
				code:     Buffer.from(text),
				filename: id,
				minify:   true,
			});

			return this.decoder.decode(output);
		}
		catch (err) {
			if (this.options.debugLevel !== 'silent') {
				console.error('Failed to minify css literal');
				console.error(err);
			}
		}
	}

	async load(id: string): Promise<{ code: string; realId: string; } | undefined> {
		if (!this.virtualModules.has(id))
			return;

		const realId = this.virtualModules.get(id)!;

		let fileContent = await readFile(realId, { encoding: 'utf8' });

		for (const transform of this.transformers)
			fileContent = transform(fileContent, realId);

		let compiled = this.fromSASSToCSS(fileContent);
		if (!compiled)
			return;

		if (this.options.minify) {
			compiled = this.minifyCSS(compiled, realId);
			if (!compiled)
				return;
		}

		const createCode =
		`const styles = ${ this.convert(compiled) }`
		+ `\n${ this.additionalCode.join('\n') }`
		+ '\nconst sheet = new CSSStyleSheet();'
		+ '\nsheet.replaceSync(styles);'
		+ '\nexport default sheet;';

		return {
			code: createCode,
			realId,
		};
	}

	transform(id: string, code: string): { code: string; map: SourceMap; } | undefined {
		const ext = extname(id);
		if (!this.filetypes.has(ext))
			return;
		if (!this.identifierNames.some(name => code.includes(name)))
			return;

		const replacements: { from: string; to: string; }[] = [];

		parseAndWalk(code, id, (node, parent, ctx) => {
			if (node.type !== 'TaggedTemplateExpression')
				return;
			if (node.tag.type !== 'Identifier')
				return;

			const identifier = node.tag.name + '`';
			if (!this.identifierNames.includes(identifier))
				return;


			const start = node.quasi.start! + 1;
			const end = node.quasi.end! - 1;

			const text = code.slice(start, end);
			if (!text)
				return;

			let compiled = this.fromSASSToCSS(text);
			if (!compiled)
				return;

			if (this.options.minify) {
				compiled = this.minifyCSS(compiled, id);
				if (!compiled)
					return;
			}

			// we cannot mutate the code string while traversing.
			// so we gather the text changes that need to be done.
			// we push the latest changes to the beginning of the array
			// so that as we apply the changes, the indexes are still valid.
			replacements.unshift({ from: text, to: compiled });
		});

		if (!replacements.length)
			return;

		try {
			const str = new MagicString(code);
			for (const { from, to } of replacements)
				str.replace(from, to);

			return {
				code: str.toString(),
				map:  str.generateMap({ file: id }),
			};
		}
		catch (err) {
			if (this.options.debugLevel !== 'silent') {
				console.error('\nFailed to apply sass transformation and minification: ' + id);
				console.error(err);
			}
		}
	}

}
