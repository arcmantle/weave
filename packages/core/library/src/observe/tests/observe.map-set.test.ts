import { describe, expect, test } from 'vitest';

import { observe } from '../observe.ts';

describe('observe - Map/Set adapters', () => {
	test('Map set/delete/clear are recorded, notify listeners, and undoable', () => {
		const state = { m: new Map<string, number>() };
		const observed = observe(state);

		const calls: { path: string; newV: any; oldV: any; }[] = [];
		const off = observe.listen(observed, s => s.m, (path, nv, ov) => {
			calls.push({ path: path.join('.'), newV: nv, oldV: ov });
		}, 'exact');

		// Batch two sets to ensure single undo group
		observe.batch(observed, o => {
			o.m.set('a', 1).set('b', 2);
		});
		expect(state.m.get('a')).toBe(1);
		expect(state.m.get('b')).toBe(2);
		expect(calls.slice(-2).every(c => c.path === 'm')).toBe(true);

		// Delete one key
		observed.m.delete('a');
		expect(state.m.has('a')).toBe(false);

		// Clear remaining
		observe.batch(observed, o => {
			o.m.clear();
		});
		expect(state.m.size).toBe(0);

		// Undo clear
		observe.undoGroups(observed, 1);
		expect(state.m.size).toBe(1);
		expect(state.m.has('b')).toBe(true);

		// Undo delete of 'a'
		observe.undo(observed, 1);
		expect(state.m.has('a')).toBe(true);

		// Undo batch of two sets
		observe.undoGroups(observed, 1);
		expect(state.m.size).toBe(0);

		off();
	});

	test('Set add/delete/clear are recorded, notify listeners, and undoable', () => {
		const state = { s: new Set<number>() };
		const observed = observe(state);

		const paths: string[] = [];
		const off = observe.listen(observed, s => s.s, (path) => paths.push(path.join('.')), 'exact');

		// Add in a batch
		observe.batch(observed, o => {
			o.s.add(1).add(2);
		});
		expect(state.s.has(1)).toBe(true);
		expect(state.s.has(2)).toBe(true);

		// Delete one
		observed.s.delete(1);
		expect(state.s.has(1)).toBe(false);

		// Clear remaining in a batch
		observe.batch(observed, o => {
			o.s.clear();
		});
		expect(state.s.size).toBe(0);

		// Undo clear
		observe.undoGroups(observed, 1);
		expect(state.s.size).toBe(1);
		expect(state.s.has(2)).toBe(true);

		// Undo delete of 1
		observe.undo(observed, 1);
		expect(state.s.has(1)).toBe(true);

		// Undo initial adds
		observe.undoGroups(observed, 1);
		expect(state.s.size).toBe(0);

		off();
		expect(paths.length).toBeGreaterThan(0);
		expect(paths.every(p => p === 's')).toBe(true);
	});
});
