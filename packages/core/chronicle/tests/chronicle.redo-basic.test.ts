import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle.redo - basic object/array', () => {
	test('redoGroups restores a batch of object sets', () => {
		const state = { a: 0, b: 0 };
		const chronicled = chronicle(state);

		chronicle.batch(chronicled, o => {
			o.a = 1;
			o.b = 2;
		});
		expect(state).toEqual({ a: 1, b: 2 });

		chronicle.undoGroups(chronicled, 1);
		expect(state).toEqual({ a: 0, b: 0 });
		expect(chronicle.canRedo(chronicled)).toBe(true);

		chronicle.redoGroups(chronicled, 1);
		expect(state).toEqual({ a: 1, b: 2 });
		expect(chronicle.canRedo(chronicled)).toBe(false);
	});

	test('array push + delete in a batch undo/redo cleanly (no holes)', () => {
		const state = { arr: [ 1, 2, 3 ] as number[] };
		const chronicled = chronicle(state);

		chronicle.batch(chronicled, o => {
			o.arr.push(4);
			// Use delete to exercise array delete trap (splice under the hood)
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete (o.arr as any)[1];
		});
		expect(state.arr).toEqual([ 1, 3, 4 ]);

		chronicle.undoGroups(chronicled, 1);
		expect(state.arr).toEqual([ 1, 2, 3 ]);

		chronicle.redoGroups(chronicled, 1);
		expect(state.arr).toEqual([ 1, 3, 4 ]);
	});
});
