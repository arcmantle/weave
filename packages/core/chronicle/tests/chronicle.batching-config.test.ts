import { describe, expect, test, vi } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle - batching and configuration', () => {
	test('batch groups multiple changes into one undoGroups step', () => {
		const state = { a: 1, arr: [ 1, 2 ] as number[] };
		const chronicled = chronicle(state);
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		chronicled.arr;

		const before = chronicle.getHistory(chronicled).length;
		const result = chronicle.batch(chronicled, obs => {
			obs.arr.push(3);
			obs.a = 2;
			obs.arr.unshift(0);

			return obs.a + obs.arr.length;
		});

		expect(result).toBe(2 + 4);
		expect(state).toEqual({ a: 2, arr: [ 0, 1, 2, 3 ] });
		const after = chronicle.getHistory(chronicled).length;
		expect(after).toBeGreaterThan(before);

		chronicle.undoGroups(chronicled, 1);
		expect(state).toEqual({ a: 1, arr: [ 1, 2 ] });
		expect(chronicle.getHistory(chronicled)).toEqual([]);
	});

	test('begin/commit preserves, rollback reverts and clears history to marker', () => {
		const state = { x: 1, list: [ 1 ] as number[] };
		const chronicled = chronicle(state);
		const m = chronicle.getHistory(chronicled).length;

		chronicle.beginBatch(chronicled);
		chronicled.x = 10;
		chronicled.list.push(2);
		chronicle.commitBatch(chronicled);

		expect(state).toEqual({ x: 10, list: [ 1, 2 ] });
		expect(chronicle.getHistory(chronicled).length).toBeGreaterThan(m);

		chronicle.beginBatch(chronicled);
		chronicled.x = 99;
		chronicled.list.unshift(0);
		chronicle.rollbackBatch(chronicled);

		expect(state).toEqual({ x: 10, list: [ 1, 2 ] });
		expect(chronicle.getHistory(chronicled).length).toBeGreaterThan(m);

		chronicle.undoGroups(chronicled, 1);
		expect(state).toEqual({ x: 1, list: [ 1 ] });
		expect(chronicle.getHistory(chronicled)).toEqual([]);
	});

	test('configure: mergeUngrouped coalesces consecutive non-batched changes into a single group', () => {
		const state = { a: 1, arr: [] as number[] };
		const chronicled = chronicle(state);

		chronicle.configure(chronicled, { mergeUngrouped: true });

		chronicled.a = 2;
		chronicled.arr.push(1);

		chronicle.undoGroups(chronicled, 1);
		expect(state).toEqual({ a: 1, arr: [] });
		expect(chronicle.getHistory(chronicled)).toEqual([]);
	});

	test('configure: mergeUngrouped respects mergeWindowMs (separates groups when window elapses)', () => {
		vi.useFakeTimers();
		try {
			const state = { a: 1, arr: [] as number[] };
			const chronicled = chronicle(state);

			chronicle.configure(chronicled, { mergeUngrouped: true, mergeWindowMs: 50 });

			vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
			chronicled.a = 2;

			vi.setSystemTime(new Date('2020-01-01T00:00:00.100Z'));
			chronicled.arr.push(1);

			chronicle.undoGroups(chronicled, 1);
			expect(state).toEqual({ a: 2, arr: [] });
			chronicle.undoGroups(chronicled, 1);
			expect(state).toEqual({ a: 1, arr: [] });
			expect(chronicle.getHistory(chronicled)).toEqual([]);
		}
		finally {
			vi.useRealTimers();
		}
	});

	test('configure: compactConsecutiveSamePath compacts repeated sets to same path within one group', () => {
		const state = { a: 1, b: { c: 1 } };
		const chronicled = chronicle(state);
		chronicle.configure(chronicled, { compactSamePath: true });

		chronicle.batch(chronicled, obs => {
			obs.a = 2;
			obs.a = 3;
			obs.b.c = 2;
			obs.b.c = 5;
		});

		const history = chronicle.getHistory(chronicled);
		expect(history.length).toBe(2);
		expect(history[0]).toMatchObject({ path: [ 'a' ], type: 'set', oldValue: 1, newValue: 3 });
		expect(history[1]).toMatchObject({ path: [ 'b', 'c' ], type: 'set', oldValue: 1, newValue: 5 });
	});

	test('configure: compactConsecutiveSamePath does not compact array index updates', () => {
		const state = { arr: [ 0 ] as number[] };
		const chronicled = chronicle(state);
		chronicle.configure(chronicled, { compactSamePath: true });

		chronicle.batch(chronicled, obs => {
			obs.arr[0] = 1;
			obs.arr[0] = 2;
		});

		const history = chronicle.getHistory(chronicled);
		expect(history.length).toBeGreaterThanOrEqual(2);
		const idxRecords = history.filter(h => h.path.join('.') === 'arr.0');
		expect(idxRecords.length).toBe(2);
		expect(idxRecords[0]).toMatchObject({ type: 'set', oldValue: 0, newValue: 1 });
		expect(idxRecords[1]).toMatchObject({ type: 'set', oldValue: 1, newValue: 2 });
	});
});
