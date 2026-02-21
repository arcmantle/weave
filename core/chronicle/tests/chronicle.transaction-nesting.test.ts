import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle.transaction - nested coalescing', () => {
	test('sync nested transactions coalesce under one group', () => {
		const state = { a: 0, b: 0 };
		const chronicled = chronicle(state);

		const outer = chronicle.transaction(chronicled, o => {
			o.a = 1;
			const inner = chronicle.transaction(o, i => {
				i.b = 2;

				return 'inner';
			});

			return inner.result;
		});

		expect(state).toEqual({ a: 1, b: 2 });
		// Single undo should revert both
		outer.undo();
		expect(state).toEqual({ a: 0, b: 0 });
	});

	test('async inner coalesces into outer group', async () => {
		const state = { a: 0, b: 0 };
		const chronicled = chronicle(state);

		const outer = await chronicle.transaction(chronicled, o => {
			o.a = 1;

			return o;
		});

		await chronicle.transaction(outer.result, async i => {
			i.b = 2;
		});

		expect(state).toEqual({ a: 1, b: 2 });
		outer.undo();
		expect(state).toEqual({ a: 0, b: 0 });
	});
});
