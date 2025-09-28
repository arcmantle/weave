import { describe, expect, test } from 'vitest';

import { observe } from '../observe.ts';

describe('observe - history, undo, diff, pristine', () => {
	test('history records set and delete, and undo reverts to original', () => {
		const original = { a: 1, b: { c: 2 } };
		const observed = observe(original);

		observed.a = 5;
		observed.b.c = 7;
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (observed as any).b.c;

		const history = observe.getHistory(observed);
		expect(history.length).toBe(3);
		expect(history[0]).toMatchObject({ path: [ 'a' ], type: 'set', oldValue: 1, newValue: 5 });
		expect(history[1]).toMatchObject({ path: [ 'b', 'c' ], type: 'set', oldValue: 2, newValue: 7 });
		expect(history[2]).toMatchObject({ path: [ 'b', 'c' ], type: 'delete', oldValue: 7 });

		observe.undo(observed);
		expect(original).toEqual({ a: 1, b: { c: 2 } });
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('undo reconstructs missing parents (deep delete then undo)', () => {
		const state = { user: { profile: { name: 'Anna' } } };
		const observed = observe(state);

		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (observed as any).user.profile;
		expect(state.user.profile).toBeUndefined();

		observe.undo(observed);
		expect(state.user.profile).toEqual({ name: 'Anna' });
	});

	test('diff and isPristine reflect changes and markPristine resets baseline', () => {
		const state = { a: 1, b: { c: 2 } };
		const observed = observe(state);

		expect(observe.isPristine!(observed)).toBe(true);

		observed.a = 3;
		let d = observe.diff!(observed);
		expect(d).toEqual([ { path: [ 'a' ], kind: 'changed', oldValue: 1, newValue: 3 } ]);
		expect(observe.isPristine!(observed)).toBe(false);

		(observed as any).b.d = 4;
		d = observe.diff!(observed);
		expect(d.some(x => x.kind === 'added' && x.path.join('.') === 'b.d')).toBe(true);

		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (observed as any).b.c;
		d = observe.diff!(observed);
		expect(d.some(x => x.kind === 'removed' && x.path.join('.') === 'b.c')).toBe(true);

		observe.markPristine!(observed);
		expect(observe.isPristine!(observed)).toBe(true);
		expect(observe.getHistory(observed)).toEqual([]);

		observed.a = 42;
		expect(observe.isPristine!(observed)).toBe(false);
	});
});
