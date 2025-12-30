import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


// Smoke tests that cover end-to-end basics; detailed cases live in split files.
describe('chronicle (smoke)', () => {
	test('basic listen and set', () => {
		const obj = { a: { b: 1 } };
		const chronicled = chronicle(obj);
		let called = 0;
		const stop = chronicle.listen(chronicled, o => o.a.b, () => { called++; }, 'exact');
		chronicled.a.b = 2;
		expect(called).toBe(1);
		stop();
	});

	test('basic undo restores original state', () => {
		const state = { a: 1 };
		const chronicled = chronicle(state);
		chronicled.a = 2;
		expect(state.a).toBe(2);
		chronicle.undo(chronicled, 1);
		expect(state.a).toBe(1);
	});
});
