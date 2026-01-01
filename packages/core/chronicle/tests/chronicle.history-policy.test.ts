import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle - history policy controls', () => {
	test('maxHistory: keeps only the most recent N records (ring buffer)', () => {
		const state = { a: 0, b: 0 };
		const o = chronicle(state);

		chronicle.configure(o, { maxHistory: 3, mergeUngrouped: false, compactSamePath: false });

		o.a = 1; // 1
		o.b = 1; // 2
		o.a = 2; // 3
		o.b = 2; // 4 -> should evict the first record

		const h = chronicle.getHistory(o);
		expect(h.length).toBe(3);
		// Oldest three should be kept: records 2,3,4
		expect(h[0]).toMatchObject({ path: [ 'b' ], type: 'set', oldValue: 0, newValue: 1 });
		expect(h[1]).toMatchObject({ path: [ 'a' ], type: 'set', oldValue: 1, newValue: 2 });
		expect(h[2]).toMatchObject({ path: [ 'b' ], type: 'set', oldValue: 1, newValue: 2 });

		// Undo should revert only those 3 stored steps
		chronicle.undo(o, 3);
		expect(state).toEqual({ a: 1, b: 0 });
		expect(chronicle.getHistory(o)).toEqual([]);
	});

	test('filter: drops matching records from history but still performs the change', () => {
		const state = { a: 0, obj: { x: 1 }, arr: [ 1, 2, 3 ] as number[] };
		const o = chronicle(state);

		// Filter out any changes to 'a' and any synthetic deletes from length truncation
		chronicle.configure(o, {
			filter: rec => {
				if (rec.path.length === 1 && rec.path[0] === 'a')
					return false;
				if (rec.type === 'delete' && rec.path[0] === 'arr')
					return false;

				return true;
			},
		});

		o.a = 1; // should NOT be stored
		o.obj.x = 2; // should be stored
		// length shrink emits one set on arr.length and deletes for removed indices; deletes are filtered
		(o.arr as any).length = 2;

		const h = chronicle.getHistory(o);
		// Expect only the obj.x set and the length set (but not index deletes)
		expect(h.some(r => r.path.join('.') === 'a' && r.type === 'set')).toBe(false);
		expect(h.some(r => r.path.join('.') === 'obj.x' && r.type === 'set' && r.newValue === 2)).toBe(true);
		expect(h.some(r => r.path.join('.') === 'arr.length' && r.type === 'set' && r.newValue === 2)).toBe(true);
		expect(h.some(r => r.path[0] === 'arr' && r.type === 'delete')).toBe(false);

		// Undo the stored steps; 'a' remains changed because it wasn't in history,
		// arr remains length 2 because index deletes were filtered out (only length set is undone to 3)
		const steps = h.length;
		chronicle.undo(o, steps);
		expect(state.a).toBe(1); // unchanged by undo
		expect(state.obj.x).toBe(1); // reverted
		// length set reverted from 2 -> 3, but deleted elements weren't stored, so the value at index 2 is undefined
		expect(state.arr.length).toBe(3);
		expect(state.arr[2]).toBeUndefined();
	});

	test('reset: returns to pristine state even with maxHistory trimming', () => {
		const state = { a: 0, nested: { x: 1 }, arr: [ 1, 2 ] as number[] };
		const o = chronicle(state);

		// take initial pristine snapshot (done automatically on first chronicle call)
		chronicle.configure(o, { maxHistory: 2, mergeUngrouped: false, compactSamePath: false });

		// Make more than maxHistory changes
		o.a = 1; // 1
		o.nested.x = 2; // 2
		o.arr.push(3); // 3 -> history now trimmed to last 2

		// Sanity: state changed and history limited
		expect(state).toEqual({ a: 1, nested: { x: 2 }, arr: [ 1, 2, 3 ] });
		expect(chronicle.getHistory(o).length).toBe(2);

		// Reset should restore full original snapshot
		chronicle.reset(o);
		expect(state).toEqual({ a: 0, nested: { x: 1 }, arr: [ 1, 2 ] });
		expect(chronicle.getHistory(o)).toEqual([]);
		expect(chronicle.isPristine(o)).toBe(true);
	});
});
