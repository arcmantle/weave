import { describe, expect, test } from 'vitest';

import { observe } from './observe.ts';

describe('observe - observability surface', () => {
	test('onAny: receives notifications for any change on the root', () => {
		const state = { a: 0, b: { c: 1 } };
		const observed = observe(state);

		const seen: { path: string[]; newV: any; oldV: any; }[] = [];
		const off = observe.onAny(observed, (path, newV, oldV) => {
			seen.push({ path: path.slice(), newV, oldV });
		});

		observed.a = 1;
		observed.b.c = 2;

		expect(seen.length).toBe(2);
		expect(seen[0]!.path.join('.')).toBe('a');
		expect(seen[0]!.newV).toBe(1);
		expect(seen[1]!.path.join('.')).toBe('b.c');
		expect(seen[1]!.newV).toBe(2);

		off();
	});

	test('pause/resume: queues notifications while paused, delivers FIFO on resume', () => {
		const state = { a: 0 };
		const observed = observe(state);

		const values: number[] = [];
		observe.listen(observed, s => s.a, (_p, nv) => { values.push(nv); }, 'exact');

		observe.pause(observed);
		observed.a = 1;
		observed.a = 2;
		expect(values).toEqual([]); // nothing delivered while paused

		observe.resume(observed);
		expect(values).toEqual([ 1, 2 ]); // delivered in order
	});

	test('flush: delivers queued notifications without resuming', () => {
		const state = { a: 0 };
		const observed = observe(state);

		const values: number[] = [];
		observe.listen(observed, s => s.a, (_p, nv) => { values.push(nv); }, 'exact');

		observe.pause(observed);
		observed.a = 1;
		observed.a = 2;
		expect(values).toEqual([]);

		observe.flush(observed);
		expect(values).toEqual([ 1, 2 ]);

		observed.a = 3; // still paused, so should queue
		expect(values).toEqual([ 1, 2 ]);

		observe.resume(observed);
		expect(values).toEqual([ 1, 2, 3 ]);
	});
});
