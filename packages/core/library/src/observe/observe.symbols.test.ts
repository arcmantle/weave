import { describe, expect, test } from 'vitest';

import { observe } from './observe.ts';

describe('observe - symbol identity', () => {
	test('two symbols with same description do not collide in paths', () => {
		const s1 = Symbol('dup');
		const s2 = Symbol('dup');
		const state: any = { obj: { [s1]: 1, [s2]: 2 } };
		const o = observe(state);

		// Change s2, ensure listener on s1 path is not called
		let hit = 0;
		const stop = observe.listen(o, m => (m as any).obj[s1], () => { hit++; });
		(o as any).obj[s2] = 22;
		expect(hit).toBe(0);

		(o as any).obj[s1] = 11;
		expect(hit).toBe(1);
		stop();
	});
});
