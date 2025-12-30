import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle.transactionAsync', () => {
	test('resolves: commits as one group and undo reverts', async () => {
		const state = { a: 0, b: 0 };
		const chronicled = chronicle(state);

		const { result, undo } = await chronicle.transactionAsync(chronicled, async (o) => {
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
		const chronicled = chronicle(state);

		await expect(chronicle.transactionAsync(chronicled, async (o) => {
			o.a = 1;
			await Promise.resolve();
			throw new Error('boom');
		})).rejects.toThrow('boom');

		expect(state).toEqual({ a: 0 });
	});
});
