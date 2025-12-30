import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle - observability surface', () => {
	test('onAny: receives notifications for any change on the root', () => {
		const state = { a: 0, b: { c: 1 } };
		const chronicled = chronicle(state);

		const seen: { path: string[]; newV: any; oldV: any; }[] = [];
		const off = chronicle.onAny(chronicled, (path, newV, oldV) => {
			seen.push({ path: path.slice(), newV, oldV });
		});

		chronicled.a = 1;
		chronicled.b.c = 2;

		expect(seen.length).toBe(2);
		expect(seen[0]!.path.join('.')).toBe('a');
		expect(seen[0]!.newV).toBe(1);
		expect(seen[1]!.path.join('.')).toBe('b.c');
		expect(seen[1]!.newV).toBe(2);

		off();
	});

	test('pause/resume: queues notifications while paused, delivers FIFO on resume', () => {
		const state = { a: 0 };
		const chronicled = chronicle(state);

		const values: number[] = [];
		chronicle.listen(chronicled, s => s.a, (_p, nv) => { values.push(nv); }, 'exact');

		chronicle.pause(chronicled);
		chronicled.a = 1;
		chronicled.a = 2;
		expect(values).toEqual([]); // nothing delivered while paused

		chronicle.resume(chronicled);
		expect(values).toEqual([ 1, 2 ]); // delivered in order
	});

	test('flush: delivers queued notifications without resuming', () => {
		const state = { a: 0 };
		const chronicled = chronicle(state);

		const values: number[] = [];
		chronicle.listen(chronicled, s => s.a, (_p, nv) => { values.push(nv); }, 'exact');

		chronicle.pause(chronicled);
		chronicled.a = 1;
		chronicled.a = 2;
		expect(values).toEqual([]);

		chronicle.flush(chronicled);
		expect(values).toEqual([ 1, 2 ]);

		chronicled.a = 3; // still paused, so should queue
		expect(values).toEqual([ 1, 2 ]);

		chronicle.resume(chronicled);
		expect(values).toEqual([ 1, 2, 3 ]);
	});
});
