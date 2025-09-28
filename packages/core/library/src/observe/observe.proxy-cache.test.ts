import { describe, expect, test } from 'vitest';

import { observe } from './observe.ts';

describe('observe - proxy caching (opt-in)', () => {
	test('default is off: repeated access yields distinct proxies for nested objects', () => {
		const state = { a: { x: 1 }, arr: [ { y: 2 } ] };
		const observed = observe(state);

		const p1 = observed.a;
		const p2 = observed.a;
		expect(p1).not.toBe(p2);

		const q1 = observed.arr[0];
		const q2 = observed.arr[0];
		expect(q1).not.toBe(q2);
	});

	test('cacheProxies: true yields stable proxy identity for a given path', () => {
		const state = { a: { x: 1 }, b: { x: 2 }, arr: [ { y: 2 } ] };
		const observed = observe(state);
		observe.configure(observed, { cacheProxies: true });

		const a1 = observed.a;
		const a2 = observed.a;
		expect(a1).toBe(a2);

		const arr0_1 = observed.arr[0];
		const arr0_2 = observed.arr[0];
		expect(arr0_1).toBe(arr0_2);

		// Different paths yield different proxies
		const b1 = observed.b;
		expect(b1).not.toBe(a1);
	});

	test('invalidation on set/delete keeps future proxies fresh', () => {
		const state = { a: { x: 1 }, arr: [ { y: 2 }, { y: 3 } ] };
		const observed = observe(state);
		observe.configure(observed, { cacheProxies: true });

		const a = observed.a;
		expect(a.x).toBe(1);
		// Replace nested object
		observed.a = { x: 10 } as any;
		const aAfter = observed.a;
		expect(aAfter).not.toBe(a); // cache invalidated
		expect(aAfter.x).toBe(10);

		// Delete array index via splice semantics in delete trap
		const first = observed.arr[0];
		delete (observed.arr as any)[0];
		const newFirst = observed.arr[0];
		expect(newFirst).not.toBe(first);

		// Shrink array length should invalidate children
		const second = observed.arr[1];
		observed.arr.length = 0; // remove remaining items
		expect(observed.arr.length).toBe(0);
		expect(observed.arr[1]).toBeUndefined();
		// adding again yields fresh proxy
		observed.arr.push({ y: 99 } as any);
		const nf = observed.arr[0];
		expect(nf).not.toBe(first);
		expect(nf).not.toBe(second);
		expect(nf.y).toBe(99);
	});
});
