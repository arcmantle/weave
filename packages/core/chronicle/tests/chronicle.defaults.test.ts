import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle - default options', () => {
	test('mergeUngrouped defaults to true with 300ms window', () => {
		const state = { count: 0 };
		const o = chronicle(state);

		// Make changes without explicit batching
		o.count = 1;
		o.count = 2;
		o.count = 3;

		const h = chronicle.getHistory(o);
		// All changes should be in the same group due to mergeUngrouped=true
		const groupIds = new Set(h.map(r => r.groupId));
		expect(groupIds.size).toBe(1);

		// Single undoGroups should revert all
		chronicle.undoGroups(o, 1);
		expect(state.count).toBe(0);
		expect(chronicle.getHistory(o).length).toBe(0);
	});

	test('compactConsecutiveSamePath defaults to true', () => {
		const state = { value: 0 };
		const o = chronicle(state);

		// Make multiple sets to same path in same group
		chronicle.batch(o, (s) => {
			s.value = 1;
			s.value = 2;
			s.value = 3;
		});

		const h = chronicle.getHistory(o);
		// Should be compacted to single record
		expect(h.length).toBe(1);
		expect(h[0]).toMatchObject({ path: [ 'value' ], oldValue: 0, newValue: 3 });

		chronicle.undo(o);
		expect(state.value).toBe(0);
	});

	test('maxHistory defaults to 1000', () => {
		const state = { n: 0 };
		const o = chronicle(state);

		// Make many changes (each in own group due to disabling mergeUngrouped)
		// Also disable compaction so we get predictable counts
		chronicle.configure(o, {
			mergeUngrouped:             false,
			compactSamePath: false,
		});

		for (let i = 1; i <= 1100; i++)
			o.n = i;

		const h = chronicle.getHistory(o);
		// Should be trimmed to 1000
		expect(h.length).toBe(1000);
		// Should contain the most recent 1000
		expect(h[h.length - 1]!.newValue).toBe(1100);
	});

	test('can override defaults explicitly', () => {
		const state = { count: 0 };
		const o = chronicle(state);

		// Override defaults
		chronicle.configure(o, {
			mergeUngrouped:             false,
			compactSamePath: false,
			maxHistory:                 5,
		});

		o.count = 1;
		o.count = 2;
		o.count = 3;

		const h = chronicle.getHistory(o);
		// Each change should be in its own group
		const groupIds = new Set(h.map(r => r.groupId));
		expect(groupIds.size).toBe(3);
	});

	test('mergeWindowMs defaults to 300ms', async () => {
		const state = { value: 0 };
		const o = chronicle(state);

		o.value = 1;
		// Wait beyond merge window
		await new Promise(resolve => setTimeout(resolve, 350));
		o.value = 2;

		const h = chronicle.getHistory(o);
		// Should be in different groups due to time window
		const groupIds = new Set(h.map(r => r.groupId));
		expect(groupIds.size).toBe(2);
	});
});
