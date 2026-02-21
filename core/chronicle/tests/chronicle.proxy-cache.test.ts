import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle - proxy caching', () => {
	test('default is on: repeated access yields same proxy for nested objects', () => {
		const state = { a: { x: 1 }, arr: [ { y: 2 } ] };
		const chronicled = chronicle(state);

		const p1 = chronicled.a;
		const p2 = chronicled.a;
		expect(p1).toBe(p2);

		const q1 = chronicled.arr[0];
		const q2 = chronicled.arr[0];
		expect(q1).toBe(q2);
	});

	test('can disable cacheProxies to get new proxies on each access', () => {
		const state = { a: { x: 1 }, b: { x: 2 }, arr: [ { y: 2 } ] };
		const chronicled = chronicle(state);
		chronicle.configure(chronicled, { cacheProxies: false });

		const a1 = chronicled.a;
		const a2 = chronicled.a;
		expect(a1).not.toBe(a2);

		const arr0_1 = chronicled.arr[0];
		const arr0_2 = chronicled.arr[0];
		expect(arr0_1).not.toBe(arr0_2);
	});

	test('invalidation on set/delete keeps future proxies fresh', () => {
		const state = { a: { x: 1 }, arr: [ { y: 2 }, { y: 3 } ] };
		const chronicled = chronicle(state);

		const a = chronicled.a;
		expect(a.x).toBe(1);
		// Replace nested object
		chronicled.a = { x: 10 } as any;
		const aAfter = chronicled.a;
		expect(aAfter).not.toBe(a); // cache invalidated
		expect(aAfter.x).toBe(10);

		// Delete array index via splice semantics in delete trap
		const first = chronicled.arr[0];
		delete (chronicled.arr as any)[0];
		const newFirst = chronicled.arr[0];
		expect(newFirst).not.toBe(first);

		// Shrink array length should invalidate children
		const second = chronicled.arr[1];
		chronicled.arr.length = 0; // remove remaining items
		expect(chronicled.arr.length).toBe(0);
		expect(chronicled.arr[1]).toBeUndefined();
		// adding again yields fresh proxy
		chronicled.arr.push({ y: 99 } as any);
		const nf = chronicled.arr[0]!;
		expect(nf).not.toBe(first);
		expect(nf).not.toBe(second);
		expect(nf.y).toBe(99);
	});
});
