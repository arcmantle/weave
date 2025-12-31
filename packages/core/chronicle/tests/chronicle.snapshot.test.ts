import { describe, expect, it } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle.snapshot()', () => {
	it('should create a deep copy of the current state', () => {
		const state = chronicle({
			count: 0,
			user:  { name: 'Alice', age: 30 },
		});

		const snapshot = chronicle.snapshot(state);

		expect(snapshot).toEqual({
			count: 0,
			user:  { name: 'Alice', age: 30 },
		});

		// Snapshot should be a different object
		expect(snapshot).not.toBe(state);
	});

	it('should not be affected by subsequent state changes', () => {
		const state = chronicle({
			count: 0,
			user:  { name: 'Alice' },
		});

		const snapshot = chronicle.snapshot(state);

		// Modify state
		state.count = 10;
		state.user.name = 'Bob';

		// Snapshot should remain unchanged
		expect(snapshot.count).toBe(0);
		expect(snapshot.user.name).toBe('Alice');

		// State should have new values
		expect(state.count).toBe(10);
		expect(state.user.name).toBe('Bob');
	});

	it('should create a plain object without proxy', () => {
		const state = chronicle({
			nested: { value: 42 },
		});

		const snapshot = chronicle.snapshot(state);

		// Modifying snapshot should not trigger any Chronicle tracking
		snapshot.nested.value = 100;

		// State should be unchanged
		expect(state.nested.value).toBe(42);
	});

	it('should handle nested objects', () => {
		const state = chronicle({
			level1: {
				level2: {
					level3: {
						value: 'deep',
					},
				},
			},
		});

		const snapshot = chronicle.snapshot(state);

		state.level1.level2.level3.value = 'changed';

		expect(snapshot.level1.level2.level3.value).toBe('deep');
		expect(state.level1.level2.level3.value).toBe('changed');
	});

	it('should handle arrays', () => {
		const state = chronicle({
			items:  [ 1, 2, 3 ],
			nested: [ { id: 1 }, { id: 2 } ],
		});

		const snapshot = chronicle.snapshot(state);

		state.items.push(4);
		state.nested[0]!.id = 999;

		expect(snapshot.items).toEqual([ 1, 2, 3 ]);
		expect(snapshot.nested).toEqual([ { id: 1 }, { id: 2 } ]);

		expect(state.items).toEqual([ 1, 2, 3, 4 ]);
		expect(state.nested[0]!.id).toBe(999);
	});

	it('should work with the diff API', () => {
		const state = chronicle({
			name: 'Alice',
			age:  30,
		});

		const snapshot = chronicle.snapshot(state);

		state.name = 'Bob';
		state.age = 31;

		const diff = chronicle.diff(state);

		// Diff should show changes from original
		expect(diff).toHaveLength(2);

		// Snapshot should match original
		expect(snapshot.name).toBe('Alice');
		expect(snapshot.age).toBe(30);
	});

	it('should be usable for manual state restoration', () => {
		const state = chronicle({
			value: 100,
			data:  { x: 1, y: 2 },
		});

		const checkpoint = chronicle.snapshot(state);

		state.value = 200;
		state.data.x = 10;
		state.data.y = 20;

		// Manually restore from snapshot
		Object.assign(state, checkpoint);

		expect(state.value).toBe(100);
		expect(state.data.x).toBe(1);
		expect(state.data.y).toBe(2);
	});
});
