import { expect, test } from 'vitest';

import { extractExports } from '../src/resolve-pkg-deps.js';


test('Wierd nested exports', () => {
	const packageName = 'tslib';
	const exports = {
		'.': {
			'module': {
				'types':   './modules/index.d.ts',
				'default': './tslib.es6.mjs',
			},
			'import': {
				'node':    './modules/index.js',
				'default': {
					'types':   './modules/index.d.ts',
					'default': './tslib.es6.mjs',
				},
			},
			'default': './tslib.js',
		},
		'./*': './*',
		'./':  './',
	};

	const parsed = extractExports(packageName, exports);

	expect([ ...parsed ]).to.be.deep.equal([
		[ 'tslib', 'tslib/tslib.es6.mjs' ],
		[ 'tslib/', 'tslib/' ],
	]);
});


test('Single level nested with correct default', () => {
	const packageName = '@arcmantle/core';
	const exports = {
		'.': {
			'types':   './dist/lib/index.d.ts',
			'default': './dist/lib/index.js',
		},
		'./animation': {
			'types':   './dist/lib/animation/index.d.ts',
			'default': './dist/lib/animation/index.js',
		},
		'./localize': {
			'types':   './dist/lib/localize/index.d.ts',
			'default': './dist/lib/localize/index.js',
		},
		'./node-tree': {
			'types':   './dist/lib/node-tree/index.d.ts',
			'default': './dist/lib/node-tree/index.js',
		},
	};

	const parsed = extractExports(packageName, exports);

	expect([ ...parsed ]).to.be.deep.equal([
		[ '@arcmantle/core',           '@arcmantle/core/dist/lib/index.js' ],
		[ '@arcmantle/core/animation', '@arcmantle/core/dist/lib/animation/index.js' ],
		[ '@arcmantle/core/localize',  '@arcmantle/core/dist/lib/localize/index.js' ],
		[ '@arcmantle/core/node-tree', '@arcmantle/core/dist/lib/node-tree/index.js' ],
	]);
});
