import { describe, expect, test, vi } from 'vitest';

import { observe } from '../observe.ts';

describe('observe - batching and configuration', () => {
	test('batch groups multiple changes into one undoGroups step', () => {
		const state = { a: 1, arr: [ 1, 2 ] as number[] };
		const observed = observe(state);
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		observed.arr;

		const before = observe.getHistory(observed).length;
		const result = observe.batch(observed, obs => {
			obs.arr.push(3);
			obs.a = 2;
			obs.arr.unshift(0);

			return obs.a + obs.arr.length;
		});

		expect(result).toBe(2 + 4);
		expect(state).toEqual({ a: 2, arr: [ 0, 1, 2, 3 ] });
		const after = observe.getHistory(observed).length;
		expect(after).toBeGreaterThan(before);

		observe.undoGroups(observed, 1);
		expect(state).toEqual({ a: 1, arr: [ 1, 2 ] });
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('begin/commit preserves, rollback reverts and clears history to marker', () => {
		const state = { x: 1, list: [ 1 ] as number[] };
		const observed = observe(state);
		const m = observe.getHistory(observed).length;

		observe.beginBatch(observed);
		observed.x = 10;
		observed.list.push(2);
		observe.commitBatch(observed);

		expect(state).toEqual({ x: 10, list: [ 1, 2 ] });
		expect(observe.getHistory(observed).length).toBeGreaterThan(m);

		observe.beginBatch(observed);
		observed.x = 99;
		observed.list.unshift(0);
		observe.rollbackBatch(observed);

		expect(state).toEqual({ x: 10, list: [ 1, 2 ] });
		expect(observe.getHistory(observed).length).toBeGreaterThan(m);

		observe.undoGroups(observed, 1);
		expect(state).toEqual({ x: 1, list: [ 1 ] });
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('configure: mergeUngrouped coalesces consecutive non-batched changes into a single group', () => {
		const state = { a: 1, arr: [] as number[] };
		const observed = observe(state);

		observe.configure(observed, { mergeUngrouped: true });

		observed.a = 2;
		observed.arr.push(1);

		observe.undoGroups(observed, 1);
		expect(state).toEqual({ a: 1, arr: [] });
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('configure: mergeUngrouped respects mergeWindowMs (separates groups when window elapses)', () => {
		vi.useFakeTimers();
		try {
			const state = { a: 1, arr: [] as number[] };
			const observed = observe(state);

			observe.configure(observed, { mergeUngrouped: true, mergeWindowMs: 50 });

			vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
			observed.a = 2;

			vi.setSystemTime(new Date('2020-01-01T00:00:00.100Z'));
			observed.arr.push(1);

			observe.undoGroups(observed, 1);
			expect(state).toEqual({ a: 2, arr: [] });
			observe.undoGroups(observed, 1);
			expect(state).toEqual({ a: 1, arr: [] });
			expect(observe.getHistory(observed)).toEqual([]);
		}
		finally {
			vi.useRealTimers();
		}
	});

	test('configure: compactConsecutiveSamePath compacts repeated sets to same path within one group', () => {
		const state = { a: 1, b: { c: 1 } };
		const observed = observe(state);
		observe.configure(observed, { compactConsecutiveSamePath: true });

		observe.batch(observed, obs => {
			obs.a = 2;
			obs.a = 3;
			obs.b.c = 2;
			obs.b.c = 5;
		});

		const history = observe.getHistory(observed);
		expect(history.length).toBe(2);
		expect(history[0]).toMatchObject({ path: [ 'a' ], type: 'set', oldValue: 1, newValue: 3 });
		expect(history[1]).toMatchObject({ path: [ 'b', 'c' ], type: 'set', oldValue: 1, newValue: 5 });
	});

	test('configure: compactConsecutiveSamePath does not compact array index updates', () => {
		const state = { arr: [ 0 ] as number[] };
		const observed = observe(state);
		observe.configure(observed, { compactConsecutiveSamePath: true });

		observe.batch(observed, obs => {
			obs.arr[0] = 1;
			obs.arr[0] = 2;
		});

		const history = observe.getHistory(observed);
		expect(history.length).toBeGreaterThanOrEqual(2);
		const idxRecords = history.filter(h => h.path.join('.') === 'arr.0');
		expect(idxRecords.length).toBe(2);
		expect(idxRecords[0]).toMatchObject({ type: 'set', oldValue: 0, newValue: 1 });
		expect(idxRecords[1]).toMatchObject({ type: 'set', oldValue: 1, newValue: 2 });
	});
});
