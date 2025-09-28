import { describe, expect, test } from 'vitest';

import { observe } from './observe.ts';

describe('observe.transaction - nested coalescing', () => {
	test('sync nested transactions coalesce under one group', () => {
		const state = { a: 0, b: 0 };
		const observed = observe(state);

		const outer = observe.transaction(observed, o => {
			o.a = 1;
			const inner = observe.transaction(o, i => {
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
		const observed = observe(state);

		const outer = observe.transaction(observed, o => {
			o.a = 1;

			return o;
		});

		await observe.transactionAsync(outer.result, async i => {
			i.b = 2;
		});

		expect(state).toEqual({ a: 1, b: 2 });
		outer.undo();
		expect(state).toEqual({ a: 0, b: 0 });
	});
});
