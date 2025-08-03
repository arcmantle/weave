import MagicString from 'magic-string';
import { parseAndWalk } from 'oxc-walker';
import { defineConfig, type Options, type UserConfig } from 'tsdown';


/** Strips out dev mode only related code. */
const devModeStripper = () => {
	return {
		name:      'dev mode stripper',
		transform: {
			order:  'pre',
			filter: {
				code: {
					include: [
						/DEV_MODE/,
						/debugLogEvent/,
					],
				},
			},
			handler(code: string, id) {
				const str = new MagicString(code, { filename: id });
				const rangesToRemove: [start: number, end: number][] = [];

				parseAndWalk(code, id, (node) => {
					if (node.type === 'IfStatement') {
						const text = str.slice(node.test.start, node.test.end);

						if (text.includes('DEV_MODE'))
							rangesToRemove.push([ node.start, node.end ]);
					}
					if (node.type === 'CallExpression') {
						if (node.callee.type === 'Identifier') {
							if (node.callee.name === 'debugLogEvent')
								rangesToRemove.push([ node.start, node.end ]);
						}
					}
				});

				rangesToRemove.sort((a, b) => a[0] - b[0]);
				rangesToRemove.forEach(([ start, end ]) => str.overwrite(start, end, ''));

				return {
					code: str.toString(),
					map:  str.generateMap(),
				};
			},
		},
	} as Options['plugins'];
};


export default defineConfig({
	entry:   [ './src/index.ts' ],
	dts:     true,
	minify:  true,
	plugins: [ devModeStripper() ],
}) as UserConfig;
