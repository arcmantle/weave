import { describe, expect, test, vi } from 'vitest';

import { observe } from './observe.ts';

describe('observe', () => {
	test('path listener fires with correct path and values', () => {
		const obj = { a: { b: 1 } };
		const observed = observe(obj);

		const calls: { path: string; newV: any; oldV: any; }[] = [];
		const dispose = observe.listen(obj, o => o.a.b, (path, newValue, oldValue) => {
			calls.push({ path: path.join('.'), newV: newValue, oldV: oldValue });
		});

		observed.a.b = 2;

		expect(calls).toEqual([ { path: 'a.b', newV: 2, oldV: 1 } ]);

		dispose();
	});

	test('listeners are per-path and do not cross-fire for same object at different locations', () => {
		const shared = { v: 1 };
		const root = { x1: shared, x2: shared };
		const observed = observe(root);

		const onX1 = vi.fn();
		const onX2 = vi.fn();
		const stop1 = observe.listen(root, o => o.x1.v, (p, nv, ov) => onX1(p.join('.'), nv, ov));
		const stop2 = observe.listen(root, o => o.x2.v, (p, nv, ov) => onX2(p.join('.'), nv, ov));

		observed.x2.v = 10;
		expect(onX1).not.toHaveBeenCalled();
		expect(onX2).toHaveBeenCalledTimes(1);
		expect(onX2).toHaveBeenLastCalledWith('x2.v', 10, 1);

		observed.x1.v = 11;
		expect(onX2).toHaveBeenCalledTimes(1);
		expect(onX1).toHaveBeenCalledTimes(1);
		expect(onX1).toHaveBeenLastCalledWith('x1.v', 11, 10);

		stop1();
		stop2();
	});

	test('parent path listener triggers on descendant changes', () => {
		const state = { users: [ { name: 'a' } ] };
		const observed = observe(state);

		const onUser0 = vi.fn();
		const stop = observe.listen(state, s => s.users[0], (p, nv, ov) => onUser0(p.join('.'), nv, ov));

		observed.users[0].name = 'b';
		expect(onUser0).toHaveBeenCalled();
		expect(onUser0.mock.calls[0][0]).toBe('users.0.name');

		stop();
	});

	test('delete triggers listener with undefined new value and correct old value', () => {
		const obj = ({ a: { b: 3 } } as const) as { a: { b?: number; }; };
		const observed = observe(obj);

		const onAB = vi.fn();
		const stop = observe.listen(obj, o => o.a.b, (p, nv, ov) => onAB(p.join('.'), nv, ov));

		// delete via proxy
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (observed as any).a.b;

		expect(onAB).toHaveBeenCalledTimes(1);
		expect(onAB).toHaveBeenLastCalledWith('a.b', undefined, 3);

		stop();
	});

	test('history records set and delete, and undo reverts to original', () => {
		const original = { a: 1, b: { c: 2 } };
		const observed = observe(original);

		observed.a = 5;
		observed.b.c = 7;
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (observed as any).b.c;

		const history = observe.getHistory(original);
		expect(history.length).toBe(3);
		expect(history[0]).toMatchObject({ path: [ 'a' ], type: 'set', oldValue: 1, newValue: 5 });
		expect(history[1]).toMatchObject({ path: [ 'b', 'c' ], type: 'set', oldValue: 2, newValue: 7 });
		expect(history[2]).toMatchObject({ path: [ 'b', 'c' ], type: 'delete', oldValue: 7 });

		observe.undo(original); // undo all
		expect(original).toEqual({ a: 1, b: { c: 2 } });
		// undo should not add to history
		expect(observe.getHistory(original)).toEqual([]);
	});

	test('undo reconstructs missing parents (deep delete then undo)', () => {
		const state = { user: { profile: { name: 'Anna' } } };
		const observed = observe(state);

		// delete the whole profile, then undo
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (observed as any).user.profile;
		expect(state.user.profile).toBeUndefined();

		observe.undo(state);
		expect(state.user.profile).toEqual({ name: 'Anna' });
	});

	test('diff and isPristine reflect changes and markPristine resets baseline', () => {
		const state = { a: 1, b: { c: 2 } };
		const observed = observe(state);

		// initial pristine
		expect(observe.isPristine!(state)).toBe(true);

		// change existing -> changed
		observed.a = 3;
		let d = observe.diff!(state);
		expect(d).toEqual([ { path: [ 'a' ], kind: 'changed', oldValue: 1, newValue: 3 } ]);
		expect(observe.isPristine!(state)).toBe(false);

		// add new -> added
		(observed as any).b.d = 4;
		d = observe.diff!(state);
		expect(d.some(x => x.kind === 'added' && x.path.join('.') === 'b.d')).toBe(true);

		// delete -> removed
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (observed as any).b.c;
		d = observe.diff!(state);
		expect(d.some(x => x.kind === 'removed' && x.path.join('.') === 'b.c')).toBe(true);

		// mark pristine -> considered same
		observe.markPristine!(state);
		expect(observe.isPristine!(state)).toBe(true);
		expect(observe.getHistory(state)).toEqual([]);

		// further change marks it non-pristine again
		observed.a = 42;
		expect(observe.isPristine!(state)).toBe(false);
	});

	test('array push: index listener, history, and diff reflect new element', () => {
		const state = { items: [ { name: 'a' } ] };
		const observed = observe(state);

		const onIndex1 = vi.fn();
		const stop = observe.listen(state, s => s.items[1], (p, nv, ov) => onIndex1(p.join('.'), nv, ov));

		observed.items.push({ name: 'b' });

		// listener for newly created index should fire once
		expect(onIndex1).toHaveBeenCalledTimes(1);
		expect(onIndex1).toHaveBeenLastCalledWith('items.1', { name: 'b' }, undefined);

		// history should contain a set for items.1 (ignore length record if present)
		const history = observe.getHistory(state);
		expect(history.some(h => h.type === 'set' && h.path.join('.') === 'items.1')).toBe(true);

		// diff should report the added index
		const diffs = observe.diff!(state);
		expect(diffs.some(d => d.kind === 'added' && d.path.join('.') === 'items.1')).toBe(true);

		stop();
	});

	test('repeated object reassignments and array mutations, then undo restores original', () => {
		const shared = { n: 1 };
		const state: { a: { child: { n: number; }; }; b: { slot: any; }; arr: { id: number; }[]; } = {
			a:   { child: shared },
			b:   { slot: null },
			arr: [ { id: 1 }, { id: 2 } ],
		};

		const observed = observe(state);

		// Object reassignments
		observed.b.slot = observed.a.child;     // slot -> shared
		observed.a.child = { n: 2 };            // new child object
		observed.b.slot = observed.a.child;     // slot -> new child
		observed.a.child = { n: 3 };            // new child again

		// Array mutations
		observed.arr.push({ id: 3 });           // [1,2,3]
		observed.arr.unshift({ id: 0 });        // [0,1,2,3]
		observed.arr.splice(1, 1, { id: 99 });  // [0,99,2,3]
		observed.arr.pop();                      // [0,99,2]
		observed.arr.shift();                    // [99,2]

		// Undo all
		observe.undo(state);

		// Back to original shape and values
		expect(state).toEqual({ a: { child: shared }, b: { slot: null }, arr: [ { id: 1 }, { id: 2 } ] });
		expect(observe.isPristine(state)).toBe(true);
		expect(observe.getHistory(state)).toEqual([]);
	});

	test('undo of push/unshift/splice removes inserted indices without holes and correct length', () => {
		const original = [ { id: 1 }, { id: 2 } ];
		const state = { arr: original.slice() };
		const observed = observe(state);

		// push then undoSince -> back to original, no holes
		let marker = observe.getHistory(state).length;
		observed.arr.push({ id: 3 });
		expect(state.arr.length).toBe(3);
		observe.undoSince(state, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);

		// unshift then undoSince -> back to original, no holes
		marker = observe.getHistory(state).length;
		observed.arr.unshift({ id: 0 });
		expect(state.arr.length).toBe(3);
		observe.undoSince(state, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);

		// splice insert then undoSince -> back to original, no holes
		marker = observe.getHistory(state).length;
		observed.arr.splice(1, 0, { id: 99 });
		expect(state.arr.length).toBe(3);
		observe.undoSince(state, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);
	});

	test('undo steps: counts history records, not high-level ops (push/assign/length)', () => {
		const state = { a: 1, arr: [ 1, 2 ] };
		const observed = observe(state);

		// 1) primitive set -> 1 record
		let before = observe.getHistory(state).length;
		observed.a = 2;
		let after = observe.getHistory(state).length;
		expect(after - before).toBe(1);

		// 2) push -> typically 2 records (index set + length set)
		before = after;
		observed.arr.push(3);
		after = observe.getHistory(state).length;
		const pushRecords = after - before;
		expect(pushRecords).toBeGreaterThanOrEqual(1); // at least one
		observe.undo(state, pushRecords);
		expect(state.arr).toEqual([ 1, 2 ]);

		// 3) assign existing index -> 1 record
		before = observe.getHistory(state).length;
		observed.arr[1] = 22;
		after = observe.getHistory(state).length;
		expect(after - before).toBe(1);
		observe.undo(state, 1);
		expect(state.arr).toEqual([ 1, 2 ]);

		// 4) length truncate -> 1 length-set + N deletes
		before = observe.getHistory(state).length;
		observed.arr.push(3); // prepare three items again
		(observed as any).arr.length = 1;
		after = observe.getHistory(state).length;
		const truncateRecords = after - before; // should be >= 2
		expect(truncateRecords).toBeGreaterThanOrEqual(2);
		observe.undo(state, truncateRecords);
		expect(state.arr).toEqual([ 1, 2 ]);
		// a is still 2 from the primitive set above
		expect(state.a).toBe(2);
	});

	test('undoSince: revert to a saved history marker', () => {
		const state = { a: { n: 1 }, arr: [ { id: 1 } ] };
		const observed = observe(state);

		const marker = observe.getHistory(state).length;
		observed.a.n = 2;               // 1
		observed.arr.push({ id: 2 });   // 2
		observed.a.n = 3;               // 3

		observe.undoSince(state, marker);
		expect(state).toEqual({ a: { n: 1 }, arr: [ { id: 1 } ] });
		expect(observe.getHistory(state)).toEqual([]);
	});
});
