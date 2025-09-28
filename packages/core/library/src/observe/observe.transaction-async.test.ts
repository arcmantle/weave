import { describe, expect, test } from 'vitest';

import { observe } from './observe.ts';

describe('observe.transactionAsync', () => {
	test('resolves: commits as one group and undo reverts', async () => {
		const state = { a: 0, b: 0 };
		const observed = observe(state);

		const { result, undo } = await observe.transactionAsync(observed, async (o) => {
			o.a = 1;
			await Promise.resolve();
			o.b = 2;

			return 'ok';
		});

		expect(result).toBe('ok');
		expect(state).toEqual({ a: 1, b: 2 });

		// One undo group should revert all
		undo();
		expect(state).toEqual({ a: 0, b: 0 });
	});

	test('rejects: rolls back to pre-transaction state', async () => {
		const state = { a: 0 };
		const observed = observe(state);

		await expect(observe.transactionAsync(observed, async (o) => {
			o.a = 1;
			await Promise.resolve();
			throw new Error('boom');
		})).rejects.toThrow('boom');

		expect(state).toEqual({ a: 0 });
	});
});
