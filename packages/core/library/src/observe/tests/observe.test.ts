import { describe, expect, test } from 'vitest';

import { observe } from '../observe.ts';

// Smoke tests that cover end-to-end basics; detailed cases live in split files.
describe('observe (smoke)', () => {
	test('basic listen and set', () => {
		const obj = { a: { b: 1 } };
		const observed = observe(obj);
		let called = 0;
		const stop = observe.listen(observed, o => o.a.b, () => { called++; }, 'exact');
		observed.a.b = 2;
		expect(called).toBe(1);
		stop();
	});

	test('basic undo restores original state', () => {
		const state = { a: 1 };
		const observed = observe(state);
		observed.a = 2;
		expect(state.a).toBe(2);
		observe.undo(observed, 1);
		expect(state.a).toBe(1);
	});
});
