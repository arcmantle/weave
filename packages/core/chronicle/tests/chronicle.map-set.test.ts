import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle - Map/Set adapters', () => {
	test('Map set/delete/clear are recorded, notify listeners, and undoable', () => {
		const state = { m: new Map<string, number>() };
		const chronicled = chronicle(state);

		const calls: { path: string; newV: any; oldV: any; }[] = [];
		const off = chronicle.listen(chronicled, s => s.m, (path, nv, ov) => {
			calls.push({ path: path.join('.'), newV: nv, oldV: ov });
		}, 'exact');

		// Batch two sets to ensure single undo group
		chronicle.batch(chronicled, o => {
			o.m.set('a', 1).set('b', 2);
		});
		expect(state.m.get('a')).toBe(1);
		expect(state.m.get('b')).toBe(2);
		expect(calls.slice(-2).every(c => c.path === 'm')).toBe(true);

		// Delete one key
		chronicled.m.delete('a');
		expect(state.m.has('a')).toBe(false);

		// Clear remaining
		chronicle.batch(chronicled, o => {
			o.m.clear();
		});
		expect(state.m.size).toBe(0);

		// Undo clear
		chronicle.undoGroups(chronicled, 1);
		expect(state.m.size).toBe(1);
		expect(state.m.has('b')).toBe(true);

		// Undo delete of 'a'
		chronicle.undo(chronicled, 1);
		expect(state.m.has('a')).toBe(true);

		// Undo batch of two sets
		chronicle.undoGroups(chronicled, 1);
		expect(state.m.size).toBe(0);

		off();
	});

	test('Set add/delete/clear are recorded, notify listeners, and undoable', () => {
		const state = { s: new Set<number>() };
		const chronicled = chronicle(state);

		const paths: string[] = [];
		const off = chronicle.listen(chronicled, s => s.s, (path) => paths.push(path.join('.')), 'exact');

		// Add in a batch
		chronicle.batch(chronicled, o => {
			o.s.add(1).add(2);
		});
		expect(state.s.has(1)).toBe(true);
		expect(state.s.has(2)).toBe(true);

		// Delete one
		chronicled.s.delete(1);
		expect(state.s.has(1)).toBe(false);

		// Clear remaining in a batch
		chronicle.batch(chronicled, o => {
			o.s.clear();
		});
		expect(state.s.size).toBe(0);

		// Undo clear
		chronicle.undoGroups(chronicled, 1);
		expect(state.s.size).toBe(1);
		expect(state.s.has(2)).toBe(true);

		// Undo delete of 1
		chronicle.undo(chronicled, 1);
		expect(state.s.has(1)).toBe(true);

		// Undo initial adds
		chronicle.undoGroups(chronicled, 1);
		expect(state.s.size).toBe(0);

		off();
		expect(paths.length).toBeGreaterThan(0);
		expect(paths.every(p => p === 's')).toBe(true);
	});
});
