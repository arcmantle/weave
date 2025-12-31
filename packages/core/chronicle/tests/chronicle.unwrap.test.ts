import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle.unwrap', () => {
	test('unwrap returns the root object', () => {
		const original = { a: 1, b: { c: 2 } };
		const chronicled = chronicle(original);

		const unwrapped = chronicle.unwrap(chronicled);

		// The unwrapped object should be the original object
		expect(unwrapped).toBe(original);
		expect(unwrapped.a).toBe(1);
		expect(unwrapped.b.c).toBe(2);
	});

	test('unwrap with nested proxy access', () => {
		const original = { a: { b: { c: 1 } } };
		const chronicled = chronicle(original);

		// Access nested property through proxy
		const nested = chronicled.a.b;

		// Unwrap should return the root, not the nested object
		const unwrapped = chronicle.unwrap(nested);

		expect(unwrapped).toBe(original);
	});

	test('mutations on unwrapped object are NOT tracked (no proxy)', () => {
		const original = { a: 1 };
		const chronicled = chronicle(original);
		const unwrapped = chronicle.unwrap(chronicled);

		// Mutate through the unwrapped object (bypasses proxy)
		unwrapped.a = 2;

		// Chronicle does NOT track the change because we bypassed the proxy
		expect(chronicle.getHistory(chronicled).length).toBe(0);
		expect(unwrapped.a).toBe(2);
		expect(chronicled.a).toBe(2); // Both see the same value (same object)

		// But mutations through the chronicle proxy ARE tracked
		chronicled.a = 3;
		expect(chronicle.getHistory(chronicled).length).toBe(1);
		expect(unwrapped.a).toBe(3);
		expect(chronicled.a).toBe(3);
	});

	test('unwrap vs snapshot difference', () => {
		const original = { a: 1 };
		const chronicled = chronicle(original);

		const unwrapped = chronicle.unwrap(chronicled);
		const snapshotted = chronicle.snapshot(chronicled);

		// Unwrap returns the original object
		expect(unwrapped).toBe(original);

		// Snapshot returns a new clone
		expect(snapshotted).not.toBe(original);
		expect(snapshotted).not.toBe(unwrapped);

		// But values are the same
		expect(snapshotted.a).toBe(unwrapped.a);
	});

	test('unwrap with arrays', () => {
		const original = { items: [ 1, 2, 3 ] };
		const chronicled = chronicle(original);

		const unwrapped = chronicle.unwrap(chronicled);

		expect(unwrapped).toBe(original);
		expect(unwrapped.items).toEqual([ 1, 2, 3 ]);
	});

	test('unwrap returns same reference when called multiple times', () => {
		const original = { a: 1 };
		const chronicled = chronicle(original);

		const unwrapped1 = chronicle.unwrap(chronicled);
		const unwrapped2 = chronicle.unwrap(chronicled);

		expect(unwrapped1).toBe(unwrapped2);
		expect(unwrapped1).toBe(original);
	});

	test('unwrap on non-chronicled object returns itself', () => {
		const obj = { a: 1 };

		// If the object is not chronicled, unwrap should return it as-is
		const unwrapped = chronicle.unwrap(obj);

		expect(unwrapped).toBe(obj);
	});
});
