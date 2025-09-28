import { describe, expect, test } from 'vitest';

import { observe } from '../observe.ts';

describe('observe.redo - Map/Set collections', () => {
	test('Map: batch set + delete + clear undo/redo', () => {
		const state = { m: new Map<string, number>() };
		const observed = observe(state);

		observe.batch(observed, o => {
			o.m.set('a', 1).set('b', 2);
		});
		expect(state.m.size).toBe(2);
		expect(state.m.get('a')).toBe(1);
		expect(state.m.get('b')).toBe(2);

		observed.m.delete('a');
		expect(state.m.has('a')).toBe(false);

		observe.batch(observed, o => o.m.clear());
		expect(state.m.size).toBe(0);

		// Undo clear
		observe.undoGroups(observed, 1);
		expect(state.m.size).toBe(1);
		expect(state.m.has('b')).toBe(true);

		// Undo delete of 'a'
		observe.undo(observed, 1);
		expect(state.m.has('a')).toBe(true);

		// Undo initial batch
		observe.undoGroups(observed, 1);
		expect(state.m.size).toBe(0);
		expect(observe.canRedo(observed)).toBe(true);

		// Redo initial batch
		observe.redoGroups(observed, 1);
		expect(state.m.size).toBe(2);
		expect(state.m.get('a')).toBe(1);
		expect(state.m.get('b')).toBe(2);

		// Redo delete of 'a'
		observe.redo(observed, 1);
		expect(state.m.has('a')).toBe(false);

		// Redo clear
		observe.redoGroups(observed, 1);
		expect(state.m.size).toBe(0);
	});

	test('Set: add/delete/clear undo then redo; new forward change clears redo', () => {
		const state = { s: new Set<number>() };
		const observed = observe(state);

		observe.batch(observed, o => {
			o.s.add(1).add(2);
		});
		expect(state.s.has(1)).toBe(true);
		expect(state.s.has(2)).toBe(true);

		observed.s.delete(1);
		expect(state.s.has(1)).toBe(false);

		observe.batch(observed, o => o.s.clear());
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
		expect(observe.canRedo(observed)).toBe(true);

		// Redo initial adds
		observe.redoGroups(observed, 1);
		expect(state.s.size).toBe(2);

		// Make a forward change — should clear redo
		observed.s.delete(2);
		expect(observe.canRedo(observed)).toBe(false);
	});
});
