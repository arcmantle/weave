import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle - group-aware history trimming', () => {
	test('maxHistory trims by whole groups from the front', () => {
		const state = { a: 0, b: 0, arr: [] as number[] };
		const o = chronicle(state);
		chronicle.configure(o, { maxHistory: 3 });

		// Group 1 (2 records expected): a=1, b=1
		chronicle.batch(o, obs => {
			obs.a = 1;
			obs.b = 1;
		});

		// Group 2 (>=2 records typical): arr.push(1)
		chronicle.batch(o, obs => {
			obs.arr.push(1);
		});

		// Group 3 (1 record): a=2
		chronicle.batch(o, obs => {
			obs.a = 2;
		});

		// With maxHistory=3, the first group should be trimmed entirely.
		const h = chronicle.getHistory(o);
		expect(h.length).toBeLessThanOrEqual(3);
		// Undo last group (a=2)
		chronicle.undoGroups(o, 1);
		expect(state.a).toBe(1);
		// Undo previous group (arr.push(1))
		chronicle.undoGroups(o, 1);
		expect(state.arr).toEqual([]);
		// Group 1 was trimmed, so no more undos should affect state
		chronicle.undoGroups(o, 1);
		expect(state).toMatchObject({ a: 1, b: 1 });
	});
});
