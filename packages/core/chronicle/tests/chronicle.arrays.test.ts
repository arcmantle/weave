import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle - array operations', () => {
	test('array push: index listener, history, and diff reflect new element', () => {
		const state = { items: [ { name: 'a' } ] };
		const chronicled = chronicle(state);

		const calls: any[] = [];
		const stop = chronicle.listen(chronicled, s => s.items[1], (p, nv, ov) => calls.push([ p.join('.'), nv, ov ]));

		chronicled.items.push({ name: 'b' });

		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual([ 'items.1', { name: 'b' }, undefined ]);

		const history = chronicle.getHistory(chronicled);
		expect(history.some(h => h.type === 'set' && h.path.join('.') === 'items.1')).toBe(true);

		const diffs = chronicle.diff!(chronicled);
		expect(diffs.some(d => d.kind === 'added' && d.path.join('.') === 'items.1')).toBe(true);

		stop();
	});

	test('repeated object reassignments and array mutations, then undo restores original', () => {
		const shared = { n: 1 };
		const state: { a: { child: { n: number; }; }; b: { slot: any; }; arr: { id: number; }[]; } = {
			a:   { child: shared },
			b:   { slot: null },
			arr: [ { id: 1 }, { id: 2 } ],
		};

		const chronicled = chronicle(state);

		chronicled.arr.push({ id: 3 });
		chronicled.arr.unshift({ id: 0 });
		chronicled.arr.splice(1, 1, { id: 99 });
		chronicled.arr.pop();
		chronicled.arr.shift();

		chronicle.undo(chronicled);

		expect(state).toEqual({ a: { child: shared }, b: { slot: null }, arr: [ { id: 1 }, { id: 2 } ] });
		expect(chronicle.isPristine(chronicled)).toBe(true);
		expect(chronicle.getHistory(chronicled)).toEqual([]);
	});

	test('undo of push/unshift/splice removes inserted indices without holes and correct length', () => {
		const original = [ { id: 1 }, { id: 2 } ];
		const state = { arr: original.slice() };
		const chronicled = chronicle(state);

		let marker = chronicle.getHistory(chronicled).length;
		chronicled.arr.push({ id: 3 });
		expect(state.arr.length).toBe(3);
		chronicle.undoSince(chronicled, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);

		marker = chronicle.getHistory(chronicled).length;
		chronicled.arr.unshift({ id: 0 });
		expect(state.arr.length).toBe(3);
		chronicle.undoSince(chronicled, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);

		marker = chronicle.getHistory(chronicled).length;
		chronicled.arr.splice(1, 0, { id: 99 });
		expect(state.arr.length).toBe(3);
		chronicle.undoSince(chronicled, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);
	});

	test('undo steps: counts history records, not high-level ops (push/assign/length)', () => {
		const state = { a: 1, arr: [ 1, 2 ] };
		const chronicled = chronicle(state);

		let before = chronicle.getHistory(chronicled).length;
		chronicled.a = 2;
		let after = chronicle.getHistory(chronicled).length;
		expect(after - before).toBe(1);

		before = after;
		chronicled.arr.push(3);
		after = chronicle.getHistory(chronicled).length;
		const pushRecords = after - before;
		expect(pushRecords).toBeGreaterThanOrEqual(1);
		chronicle.undo(chronicled, pushRecords);
		expect(state.arr).toEqual([ 1, 2 ]);

		before = chronicle.getHistory(chronicled).length;
		chronicled.arr[1] = 22;
		after = chronicle.getHistory(chronicled).length;
		expect(after - before).toBe(1);
		chronicle.undo(chronicled, 1);
		expect(state.arr).toEqual([ 1, 2 ]);

		before = chronicle.getHistory(chronicled).length;
		chronicled.arr.push(3);
		(chronicled as any).arr.length = 1;
		after = chronicle.getHistory(chronicled).length;
		const truncateRecords = after - before;
		expect(truncateRecords).toBeGreaterThanOrEqual(2);
		chronicle.undo(chronicled, truncateRecords);
		expect(state.arr).toEqual([ 1, 2 ]);
		expect(state.a).toBe(2);
	});
});
