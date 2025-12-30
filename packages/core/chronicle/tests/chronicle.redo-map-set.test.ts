import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle.redo - Map/Set collections', () => {
	test('Map: batch set + delete + clear undo/redo', () => {
		const state = { m: new Map<string, number>() };
		const chronicled = chronicle(state);

		chronicle.batch(chronicled, o => {
			o.m.set('a', 1).set('b', 2);
		});
		expect(state.m.size).toBe(2);
		expect(state.m.get('a')).toBe(1);
		expect(state.m.get('b')).toBe(2);

		chronicled.m.delete('a');
		expect(state.m.has('a')).toBe(false);

		chronicle.batch(chronicled, o => o.m.clear());
		expect(state.m.size).toBe(0);

		// Undo clear
		chronicle.undoGroups(chronicled, 1);
		expect(state.m.size).toBe(1);
		expect(state.m.has('b')).toBe(true);

		// Undo delete of 'a'
		chronicle.undo(chronicled, 1);
		expect(state.m.has('a')).toBe(true);

		// Undo initial batch
		chronicle.undoGroups(chronicled, 1);
		expect(state.m.size).toBe(0);
		expect(chronicle.canRedo(chronicled)).toBe(true);

		// Redo initial batch
		chronicle.redoGroups(chronicled, 1);
		expect(state.m.size).toBe(2);
		expect(state.m.get('a')).toBe(1);
		expect(state.m.get('b')).toBe(2);

		// Redo delete of 'a'
		chronicle.redo(chronicled, 1);
		expect(state.m.has('a')).toBe(false);

		// Redo clear
		chronicle.redoGroups(chronicled, 1);
		expect(state.m.size).toBe(0);
	});

	test('Set: add/delete/clear undo then redo; new forward change clears redo', () => {
		const state = { s: new Set<number>() };
		const chronicled = chronicle(state);

		chronicle.batch(chronicled, o => {
			o.s.add(1).add(2);
		});
		expect(state.s.has(1)).toBe(true);
		expect(state.s.has(2)).toBe(true);

		chronicled.s.delete(1);
		expect(state.s.has(1)).toBe(false);

		chronicle.batch(chronicled, o => o.s.clear());
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
		expect(chronicle.canRedo(chronicled)).toBe(true);

		// Redo initial adds
		chronicle.redoGroups(chronicled, 1);
		expect(state.s.size).toBe(2);

		// Make a forward change — should clear redo
		chronicled.s.delete(2);
		expect(chronicle.canRedo(chronicled)).toBe(false);
	});
});
