import { describe, expect, test } from 'vitest';

import { observe } from './observe.ts';

describe('observe - array operations', () => {
	test('array push: index listener, history, and diff reflect new element', () => {
		const state = { items: [ { name: 'a' } ] };
		const observed = observe(state);

		const calls: any[] = [];
		const stop = observe.listen(observed, s => s.items[1], (p, nv, ov) => calls.push([ p.join('.'), nv, ov ]));

		observed.items.push({ name: 'b' });

		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual([ 'items.1', { name: 'b' }, undefined ]);

		const history = observe.getHistory(observed);
		expect(history.some(h => h.type === 'set' && h.path.join('.') === 'items.1')).toBe(true);

		const diffs = observe.diff!(observed);
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

		const observed = observe(state);

		observed.arr.push({ id: 3 });
		observed.arr.unshift({ id: 0 });
		observed.arr.splice(1, 1, { id: 99 });
		observed.arr.pop();
		observed.arr.shift();

		observe.undo(observed);

		expect(state).toEqual({ a: { child: shared }, b: { slot: null }, arr: [ { id: 1 }, { id: 2 } ] });
		expect(observe.isPristine(observed)).toBe(true);
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('undo of push/unshift/splice removes inserted indices without holes and correct length', () => {
		const original = [ { id: 1 }, { id: 2 } ];
		const state = { arr: original.slice() };
		const observed = observe(state);

		let marker = observe.getHistory(observed).length;
		observed.arr.push({ id: 3 });
		expect(state.arr.length).toBe(3);
		observe.undoSince(observed, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);

		marker = observe.getHistory(observed).length;
		observed.arr.unshift({ id: 0 });
		expect(state.arr.length).toBe(3);
		observe.undoSince(observed, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);

		marker = observe.getHistory(observed).length;
		observed.arr.splice(1, 0, { id: 99 });
		expect(state.arr.length).toBe(3);
		observe.undoSince(observed, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);
	});

	test('undo steps: counts history records, not high-level ops (push/assign/length)', () => {
		const state = { a: 1, arr: [ 1, 2 ] };
		const observed = observe(state);

		let before = observe.getHistory(observed).length;
		observed.a = 2;
		let after = observe.getHistory(observed).length;
		expect(after - before).toBe(1);

		before = after;
		observed.arr.push(3);
		after = observe.getHistory(observed).length;
		const pushRecords = after - before;
		expect(pushRecords).toBeGreaterThanOrEqual(1);
		observe.undo(observed, pushRecords);
		expect(state.arr).toEqual([ 1, 2 ]);

		before = observe.getHistory(observed).length;
		observed.arr[1] = 22;
		after = observe.getHistory(observed).length;
		expect(after - before).toBe(1);
		observe.undo(observed, 1);
		expect(state.arr).toEqual([ 1, 2 ]);

		before = observe.getHistory(observed).length;
		observed.arr.push(3);
		(observed as any).arr.length = 1;
		after = observe.getHistory(observed).length;
		const truncateRecords = after - before;
		expect(truncateRecords).toBeGreaterThanOrEqual(2);
		observe.undo(observed, truncateRecords);
		expect(state.arr).toEqual([ 1, 2 ]);
		expect(state.a).toBe(2);
	});
});
