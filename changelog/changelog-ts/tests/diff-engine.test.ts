import { describe, expect, test } from 'vitest';

import { applyDiff, diff } from '../src/diff-engine.js';

describe('diff-engine', () => {
	describe('diff', () => {
		test('detects no changes for identical primitives', () => {
			expect(diff(42, 42)).toEqual([]);
			expect(diff('hello', 'hello')).toEqual([]);
			expect(diff(true, true)).toEqual([]);
			expect(diff(null, null)).toEqual([]);
		});

		test('detects changes in primitives', () => {
			const result = diff(42, 43);
			expect(result).toEqual([
				{
					path:     [],
					kind:     'changed',
					oldValue: 42,
					newValue: 43,
				},
			]);
		});

		test('detects added properties', () => {
			const result = diff({}, { name: 'Alice' });
			expect(result).toEqual([
				{
					path:     [ 'name' ],
					kind:     'added',
					newValue: 'Alice',
				},
			]);
		});

		test('detects removed properties', () => {
			const result = diff({ name: 'Alice' }, {});
			expect(result).toEqual([
				{
					path:     [ 'name' ],
					kind:     'removed',
					oldValue: 'Alice',
				},
			]);
		});

		test('detects changed properties', () => {
			const result = diff({ name: 'Alice' }, { name: 'Bob' });
			expect(result).toEqual([
				{
					path:     [ 'name' ],
					kind:     'changed',
					oldValue: 'Alice',
					newValue: 'Bob',
				},
			]);
		});

		test('detects deep nested changes', () => {
			const oldValue = {
				user: {
					profile: {
						name: 'Alice',
						age:  30,
					},
				},
			};
			const newValue = {
				user: {
					profile: {
						name: 'Alice',
						age:  31,
					},
				},
			};
			const result = diff(oldValue, newValue);
			expect(result).toEqual([
				{
					path:     [ 'user', 'profile', 'age' ],
					kind:     'changed',
					oldValue: 30,
					newValue: 31,
				},
			]);
		});

		test('detects multiple changes at different depths', () => {
			const oldValue = {
				a: 1,
				b: {
					c: 2,
					d: {
						e: 3,
					},
				},
			};
			const newValue = {
				a: 10,
				b: {
					c: 2,
					d: {
						e: 30,
						f: 40,
					},
				},
			};
			const result = diff(oldValue, newValue);
			expect(result).toContainEqual({
				path:     [ 'a' ],
				kind:     'changed',
				oldValue: 1,
				newValue: 10,
			});
			expect(result).toContainEqual({
				path:     [ 'b', 'd', 'e' ],
				kind:     'changed',
				oldValue: 3,
				newValue: 30,
			});
			expect(result).toContainEqual({
				path:     [ 'b', 'd', 'f' ],
				kind:     'added',
				newValue: 40,
			});
		});

		test('handles arrays with added elements', () => {
			const result = diff([ 1, 2 ], [ 1, 2, 3 ]);
			expect(result).toEqual([
				{
					path:     [ '2' ],
					kind:     'added',
					newValue: 3,
				},
			]);
		});

		test('handles arrays with removed elements', () => {
			const result = diff([ 1, 2, 3 ], [ 1, 2 ]);
			expect(result).toEqual([
				{
					path:     [ '2' ],
					kind:     'removed',
					oldValue: 3,
				},
			]);
		});

		test('handles arrays with changed elements', () => {
			const result = diff([ 1, 2, 3 ], [ 1, 20, 3 ]);
			expect(result).toEqual([
				{
					path:     [ '1' ],
					kind:     'changed',
					oldValue: 2,
					newValue: 20,
				},
			]);
		});

		test('handles nested objects in arrays', () => {
			const oldValue = [ { id: 1, name: 'Alice' } ];
			const newValue = [ { id: 1, name: 'Bob' } ];
			const result = diff(oldValue, newValue);
			expect(result).toEqual([
				{
					path:     [ '0', 'name' ],
					kind:     'changed',
					oldValue: 'Alice',
					newValue: 'Bob',
				},
			]);
		});

		test('handles circular references', () => {
			const a: any = { value: 1 };
			a.self = a;

			const b: any = { value: 1 };
			b.self = b;

			// Should not throw and should handle circular refs
			const result = diff(a, b);
			expect(result).toEqual([]);
		});

		test('detects type changes', () => {
			const result = diff({ value: 42 }, { value: 'string' });
			expect(result).toEqual([
				{
					path:     [ 'value' ],
					kind:     'changed',
					oldValue: 42,
					newValue: 'string',
				},
			]);
		});

		test('uses custom equality function', () => {
			const customEqual = (a: any, b: any) => {
				// Case-insensitive string comparison
				if (typeof a === 'string' && typeof b === 'string')
					return a.toLowerCase() === b.toLowerCase();

				return Object.is(a, b);
			};

			const result = diff(
				{ name: 'Alice' },
				{ name: 'ALICE' },
				{ compare: customEqual },
			);
			expect(result).toEqual([]);
		});
	});

	describe('applyDiff', () => {
		test('applies simple property change', () => {
			const value = { name: 'Alice', age: 30 };
			const diffs = [
				{
					path:     [ 'age' ],
					kind:     'changed' as const,
					oldValue: 30,
					newValue: 31,
				},
			];
			const result = applyDiff(value, diffs);
			expect(result).toEqual({ name: 'Alice', age: 31 });
		});

		test('applies added property', () => {
			const value = { name: 'Alice' };
			const diffs = [
				{
					path:     [ 'age' ],
					kind:     'added' as const,
					newValue: 30,
				},
			];
			const result = applyDiff(value, diffs);
			expect(result).toEqual({ name: 'Alice', age: 30 });
		});

		test('applies removed property', () => {
			const value = { name: 'Alice', age: 30 };
			const diffs = [
				{
					path:     [ 'age' ],
					kind:     'removed' as const,
					oldValue: 30,
				},
			];
			const result = applyDiff(value, diffs);
			expect(result).toEqual({ name: 'Alice' });
		});

		test('applies deep nested changes', () => {
			const value = {
				user: {
					profile: {
						name: 'Alice',
						age:  30,
					},
				},
			};
			const diffs = [
				{
					path:     [ 'user', 'profile', 'age' ],
					kind:     'changed' as const,
					oldValue: 30,
					newValue: 31,
				},
			];
			const result = applyDiff(value, diffs);
			expect(result.user.profile.age).toBe(31);
			expect(result.user.profile.name).toBe('Alice');
		});

		test('creates intermediate objects when needed', () => {
			const value = {};
			const diffs = [
				{
					path:     [ 'a', 'b', 'c' ],
					kind:     'added' as const,
					newValue: 42,
				},
			];
			const result = applyDiff(value, diffs);
			expect(result).toEqual({ a: { b: { c: 42 } } });
		});

		test('applies multiple diffs', () => {
			const value = { a: 1, b: 2 };
			const diffs = [
				{
					path:     [ 'a' ],
					kind:     'changed' as const,
					oldValue: 1,
					newValue: 10,
				},
				{
					path:     [ 'c' ],
					kind:     'added' as const,
					newValue: 3,
				},
			];
			const result = applyDiff(value, diffs);
			expect(result).toEqual({ a: 10, b: 2, c: 3 });
		});

		test('does not mutate original value', () => {
			const value = { name: 'Alice', age: 30 };
			const diffs = [
				{
					path:     [ 'age' ],
					kind:     'changed' as const,
					oldValue: 30,
					newValue: 31,
				},
			];
			const result = applyDiff(value, diffs);
			expect(value.age).toBe(30); // Original unchanged
			expect(result.age).toBe(31); // New value changed
		});
	});
});
