import { describe, expect, it } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('array delete trap smoothing', () => {
	it('delete index uses splice (no holes) and undo restores', () => {
		const state = { arr: [ 'a', 'b', 'c', 'd' ] };
		const o = chronicle(state);

		// delete middle index
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (o.arr as any)[1];

		expect(o.arr).toEqual([ 'a', 'c', 'd' ]);
		expect(o.arr.length).toBe(3);
		// no hole at index 1
		expect(1 in o.arr).toBe(true);

		// undo should bring back original
		chronicle.undo(o, 1);
		expect(o.arr).toEqual([ 'a', 'b', 'c', 'd' ]);
	});
});
