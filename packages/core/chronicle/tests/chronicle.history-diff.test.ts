import { describe, expect, test } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle - history, undo, diff, pristine', () => {
	test('history records set and delete, and undo reverts to original', () => {
		const original = { a: 1, b: { c: 2 } };
		const chronicled = chronicle(original);

		chronicled.a = 5;
		chronicled.b.c = 7;
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (chronicled as any).b.c;

		const history = chronicle.getHistory(chronicled);
		expect(history.length).toBe(3);
		expect(history[0]).toMatchObject({ path: [ 'a' ], type: 'set', oldValue: 1, newValue: 5 });
		expect(history[1]).toMatchObject({ path: [ 'b', 'c' ], type: 'set', oldValue: 2, newValue: 7 });
		expect(history[2]).toMatchObject({ path: [ 'b', 'c' ], type: 'delete', oldValue: 7 });

		chronicle.undo(chronicled);
		expect(original).toEqual({ a: 1, b: { c: 2 } });
		expect(chronicle.getHistory(chronicled)).toEqual([]);
	});

	test('undo reconstructs missing parents (deep delete then undo)', () => {
		const state = { user: { profile: { name: 'Anna' } } };
		const chronicled = chronicle(state);

		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (chronicled as any).user.profile;
		expect(state.user.profile).toBeUndefined();

		chronicle.undo(chronicled);
		expect(state.user.profile).toEqual({ name: 'Anna' });
	});

	test('diff and isPristine reflect changes and markPristine resets baseline', () => {
		const state = { a: 1, b: { c: 2 } };
		const chronicled = chronicle(state);

		expect(chronicle.isPristine!(chronicled)).toBe(true);

		chronicled.a = 3;
		let d = chronicle.diff!(chronicled);
		expect(d).toEqual([ { path: [ 'a' ], kind: 'changed', oldValue: 1, newValue: 3 } ]);
		expect(chronicle.isPristine!(chronicled)).toBe(false);

		(chronicled as any).b.d = 4;
		d = chronicle.diff!(chronicled);
		expect(d.some(x => x.kind === 'added' && x.path.join('.') === 'b.d')).toBe(true);

		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (chronicled as any).b.c;
		d = chronicle.diff!(chronicled);
		expect(d.some(x => x.kind === 'removed' && x.path.join('.') === 'b.c')).toBe(true);

		chronicle.markPristine!(chronicled);
		expect(chronicle.isPristine!(chronicled)).toBe(true);
		expect(chronicle.getHistory(chronicled)).toEqual([]);

		chronicled.a = 42;
		expect(chronicle.isPristine!(chronicled)).toBe(false);
	});
});
