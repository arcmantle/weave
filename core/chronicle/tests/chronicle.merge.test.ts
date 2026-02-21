import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle.merge - three-way merge', () => {
	test('no conflicts - apply all changes successfully', () => {
		const original = { a: 1, b: 2, c: 3 };
		const chronicled = chronicle(original);

		// Make local changes
		chronicled.a = 10;

		// Incoming object has different properties changed
		const incoming = { a: 1, b: 20, c: 30 };

		const result = chronicle.merge(chronicled, incoming);

		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect(result.applied).toBe(2);
		expect(original.a).toBe(10);
		expect(original.b).toBe(20);
		expect(original.c).toBe(30);
	});

	test('simple conflict - same property modified locally and incoming', () => {
		const original = { a: 1, b: 2 };
		const chronicled = chronicle(original);

		// Make local change
		chronicled.a = 10;

		// Incoming object also has 'a' modified
		const incoming = { a: 100, b: 20 };

		const result = chronicle.merge(chronicled, incoming);

		expect(result.success).toBe(false);
		expect(result.conflicts).toHaveLength(1);
		expect(result.applied).toBe(1); // Only 'b' was applied
		expect(result.conflicts[0]).toEqual({
			path:   [ 'a' ],
			base:   1,    // original value
			ours:   10,   // our change
			theirs: 100,  // their change
		});
		expect(original.a).toBe(10); // Unchanged (conflict not resolved)
		expect(original.b).toBe(20); // Applied successfully
	});

	test('conflict resolution - strategy: ours', () => {
		const original = { a: 1 };
		const chronicled = chronicle(original);

		chronicled.a = 10;

		const incoming = { a: 100 };

		const result = chronicle.merge(chronicled, incoming, {
			'a': { strategy: 'ours' },
		});

		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect(result.applied).toBe(1);
		expect(original.a).toBe(10); // Kept our value
	});

	test('conflict resolution - strategy: theirs', () => {
		const original = { a: 1 };
		const chronicled = chronicle(original);

		chronicled.a = 10;

		const incoming = { a: 100 };

		const result = chronicle.merge(chronicled, incoming, {
			'a': { strategy: 'theirs' },
		});

		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect(result.applied).toBe(1);
		expect(original.a).toBe(100); // Took their value
	});

	test('conflict resolution - strategy: custom', () => {
		const original = { a: 1 };
		const chronicled = chronicle(original);

		chronicled.a = 10;

		const incoming = { a: 100 };

		const result = chronicle.merge(chronicled, incoming, {
			'a': { strategy: 'custom', value: 999 },
		});

		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect(result.applied).toBe(1);
		expect(original.a).toBe(999); // Used custom value
	});

	test('nested property conflicts', () => {
		const original = { user: { name: 'Alice', age: 30 } };
		const chronicled = chronicle(original);

		// Local change
		chronicled.user.age = 31;

		// Incoming object
		const incoming = { user: { name: 'Alicia', age: 32 } };

		const result = chronicle.merge(chronicled, incoming);

		expect(result.success).toBe(false);
		expect(result.conflicts).toHaveLength(1);
		expect(result.conflicts[0]!.path).toEqual([ 'user', 'age' ]);
		expect(result.conflicts[0]!.base).toBe(30);
		expect(result.conflicts[0]!.ours).toBe(31);
		expect(result.conflicts[0]!.theirs).toBe(32);
		expect(original.user.name).toBe('Alicia'); // Applied
		expect(original.user.age).toBe(31); // Conflict, unchanged
	});

	test('two-stage merge workflow', () => {
		const original = { a: 1, b: 2, c: 3 };
		const chronicled = chronicle(original);

		// Local changes
		chronicled.a = 10;
		chronicled.b = 20;

		// Incoming object
		const incoming = { a: 100, b: 200, c: 300 };

		// Stage 1: Attempt merge without resolutions
		const firstResult = chronicle.merge(chronicled, incoming);

		expect(firstResult.success).toBe(false);
		expect(firstResult.conflicts).toHaveLength(2);
		expect(firstResult.applied).toBe(1); // Only 'c' applied
		expect(original.c).toBe(300);

		// Stage 2: User examines conflicts and provides resolutions
		const resolutions = {
			'a': { strategy: 'theirs' as const },
			'b': { strategy: 'custom' as const, value: 50 },
		};

		const secondResult = chronicle.merge(chronicled, incoming, resolutions);

		expect(secondResult.success).toBe(true);
		expect(secondResult.conflicts).toHaveLength(0);
		expect(secondResult.applied).toBe(3); // a, b, and c (c is same value, no-op)
		expect(original.a).toBe(100); // Took theirs
		expect(original.b).toBe(50);  // Used custom
		expect(original.c).toBe(300); // Already applied in first merge (reapplied with same value)
	});

	test('added property - no conflict', () => {
		const original = { a: 1 };
		const chronicled = chronicle(original);

		const incoming = { a: 1, b: 2 };

		const result = chronicle.merge(chronicled, incoming);

		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect((original as any).b).toBe(2);
	});

	test('removed property - no conflict', () => {
		const original = { a: 1, b: 2 };
		const chronicled = chronicle(original);

		const incoming = { a: 1 };

		const result = chronicle.merge(chronicled, incoming);

		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect((original as any).b).toBeUndefined();
	});

	test('removed property conflict', () => {
		const original = { a: 1 };
		const chronicled = chronicle(original);

		// Local change
		chronicled.a = 10;

		// Incoming has property removed
		const incoming = {};

		const result = chronicle.merge(chronicled, incoming);

		expect(result.success).toBe(false);
		expect(result.conflicts).toHaveLength(1);
		expect(result.conflicts[0]).toEqual({
			path:   [ 'a' ],
			base:   1,
			ours:   10,
			theirs: undefined,
		});
		expect(original.a).toBe(10); // Kept our value
	});

	test('resolve removed property conflict with theirs (delete)', () => {
		const original = { a: 1 };
		const chronicled = chronicle(original);

		chronicled.a = 10;

		const incoming = {};

		const result = chronicle.merge(chronicled, incoming, {
			'a': { strategy: 'theirs' },
		});

		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect((original as any).a).toBeUndefined(); // Deleted
	});

	test('multiple conflicts with mixed resolutions', () => {
		const original = { a: 1, b: 2, c: 3, d: 4 };
		const chronicled = chronicle(original);

		chronicled.a = 10;
		chronicled.b = 20;
		chronicled.c = 30;

		const incoming = { a: 100, b: 200, c: 300, d: 400 };

		const result = chronicle.merge(chronicled, incoming, {
			'a': { strategy: 'ours' },
			'b': { strategy: 'theirs' },
			'c': { strategy: 'custom', value: 999 },
		});

		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect(result.applied).toBe(4);
		expect(original.a).toBe(10);   // ours
		expect(original.b).toBe(200);  // theirs
		expect(original.c).toBe(999);  // custom
		expect(original.d).toBe(400);  // no conflict
	});

	test('no changes to merge', () => {
		const original = { a: 1 };
		const chronicled = chronicle(original);

		// Incoming is identical to original
		const incoming = { a: 1 };

		const result = chronicle.merge(chronicled, incoming);

		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect(result.applied).toBe(0);
	});

	test('merge tracks changes in history', () => {
		const original = { a: 1, b: 2 };
		const chronicled = chronicle(original);

		const incoming = { a: 100, b: 200 };

		chronicle.merge(chronicled, incoming);

		// Merge should trigger change tracking
		const history = chronicle.getHistory(chronicled);
		expect(history.length).toBeGreaterThan(0);

		// Can undo merge
		chronicle.undo(chronicled, history.length);
		expect(original.a).toBe(1);
		expect(original.b).toBe(2);
	});

	test('deep equality - no conflict when both made same change to nested object', () => {
		const original = { user: { profile: { name: 'Alice', age: 30 } } };
		const chronicled = chronicle(original);

		// Both local and incoming change age to 31
		chronicled.user.profile.age = 31;

		// Incoming has same change (different object reference but same value)
		const incoming = { user: { profile: { name: 'Alice', age: 31 } } };

		const result = chronicle.merge(chronicled, incoming);

		// Should NOT conflict - both made the same change
		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect(original.user.profile.age).toBe(31);
	});

	test('deep equality - conflict when nested objects differ by value', () => {
		const original = { user: { profile: { name: 'Alice', age: 30 } } };
		const chronicled = chronicle(original);

		// Local change
		chronicled.user.profile.age = 31;

		// Incoming has different change
		const incoming = { user: { profile: { name: 'Alice', age: 32 } } };

		const result = chronicle.merge(chronicled, incoming);

		// Should conflict - different values
		expect(result.success).toBe(false);
		expect(result.conflicts).toHaveLength(1);
		expect(result.conflicts[0]!.path).toEqual([ 'user', 'profile', 'age' ]);
		expect(result.conflicts[0]!.ours).toBe(31);
		expect(result.conflicts[0]!.theirs).toBe(32);
	});

	test('deep equality - arrays with same values, different references', () => {
		const original = { items: [ 1, 2, 3 ] };
		const chronicled = chronicle(original);

		// Both add item 4
		chronicled.items.push(4);

		// Incoming also has [1, 2, 3, 4] but different array reference
		const incoming = { items: [ 1, 2, 3, 4 ] };

		const result = chronicle.merge(chronicled, incoming);

		// Should NOT conflict - same values
		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect(original.items).toEqual([ 1, 2, 3, 4 ]);
	});

	test('deep equality - nested objects with same structure and values', () => {
		const original = { config: { theme: 'light', settings: { fontSize: 12 } } };
		const chronicled = chronicle(original);

		// Local changes entire config object
		chronicled.config = { theme: 'dark', settings: { fontSize: 14 } };

		// Incoming has same final state (different object references)
		const incoming = { config: { theme: 'dark', settings: { fontSize: 14 } } };

		const result = chronicle.merge(chronicled, incoming);

		// Should NOT conflict - values are deeply equal
		expect(result.success).toBe(true);
		expect(result.conflicts).toHaveLength(0);
		expect(original.config.theme).toBe('dark');
		expect(original.config.settings.fontSize).toBe(14);
	});
});
