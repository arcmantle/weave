import { describe, expect, test, vi } from 'vitest';

import { observe } from './observe.ts';

describe('observe', () => {
	test('path listener fires with correct path and values', () => {
		const obj = { a: { b: 1 } };
		const observed = observe(obj);
		// exercise to avoid unused var lint false-positive
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		observed.a;

		const calls: { path: string; newV: any; oldV: any; }[] = [];
		const dispose = observe.listen(observed, o => o.a.b, (path, newValue, oldValue) => {
			calls.push({ path: path.join('.'), newV: newValue, oldV: oldValue });
		});

		observed.a.b = 2;

		expect(calls).toEqual([ { path: 'a.b', newV: 2, oldV: 1 } ]);

		dispose();
	});

	test('batch groups multiple changes into one undoGroups step', () => {
		const state = { a: 1, arr: [ 1, 2 ] as number[] };
		const observed = observe(state);
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		observed.arr;

		const before = observe.getHistory(observed).length;
		const result = observe.batch(observed, obs => {
			obs.arr.push(3);      // index set + maybe length
			obs.a = 2;            // primitive set
			obs.arr.unshift(0);   // multiple records

			return obs.a + obs.arr.length;
		});

		expect(result).toBe(2 + 4);
		expect(state).toEqual({ a: 2, arr: [ 0, 1, 2, 3 ] });
		const after = observe.getHistory(observed).length;
		expect(after).toBeGreaterThan(before);

		// single grouped undo should revert entire batch
		observe.undoGroups(observed, 1);
		expect(state).toEqual({ a: 1, arr: [ 1, 2 ] });
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('begin/commit preserves, rollback reverts and clears history to marker', () => {
		const state = { x: 1, list: [ 1 ] as number[] };
		const observed = observe(state);
		const m = observe.getHistory(observed).length;

		observe.beginBatch(observed);
		observed.x = 10;
		observed.list.push(2);
		observe.commitBatch(observed);

		expect(state).toEqual({ x: 10, list: [ 1, 2 ] });
		expect(observe.getHistory(observed).length).toBeGreaterThan(m);

		observe.beginBatch(observed);
		observed.x = 99;
		observed.list.unshift(0);
		observe.rollbackBatch(observed);

		expect(state).toEqual({ x: 10, list: [ 1, 2 ] });
		// history should be unchanged by the rolled-back batch
		expect(observe.getHistory(observed).length).toBeGreaterThan(m);

		// undoGroups(1) should remove the committed first batch
		observe.undoGroups(observed, 1);
		expect(state).toEqual({ x: 1, list: [ 1 ] });
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('configure: mergeUngrouped coalesces consecutive non-batched changes into a single group', () => {
		const state = { a: 1, arr: [] as number[] };
		const observed = observe(state);

		observe.configure(observed, { mergeUngrouped: true });

		// Two separate, non-batched changes
		observed.a = 2;
		observed.arr.push(1);

		// One grouped undo should revert both
		observe.undoGroups(observed, 1);
		expect(state).toEqual({ a: 1, arr: [] });
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('configure: mergeUngrouped respects mergeWindowMs (separates groups when window elapses)', () => {
		vi.useFakeTimers();
		try {
			const state = { a: 1, arr: [] as number[] };
			const observed = observe(state);

			observe.configure(observed, { mergeUngrouped: true, mergeWindowMs: 50 });

			// First change at T0
			vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
			observed.a = 2;

			// Advance beyond window and perform second change -> new group
			vi.setSystemTime(new Date('2020-01-01T00:00:00.100Z'));
			observed.arr.push(1);

			// Undo one group should revert only the second change
			observe.undoGroups(observed, 1);
			expect(state).toEqual({ a: 2, arr: [] });
			// Undo another group reverts the first change
			observe.undoGroups(observed, 1);
			expect(state).toEqual({ a: 1, arr: [] });
			expect(observe.getHistory(observed)).toEqual([]);
		}
		finally {
			vi.useRealTimers();
		}
	});

	test('configure: compactConsecutiveSamePath compacts repeated sets to same path within one group', () => {
		const state = { a: 1, b: { c: 1 } };
		const observed = observe(state);
		observe.configure(observed, { compactConsecutiveSamePath: true });

		// Use batch to guarantee one group
		observe.batch(observed, obs => {
			obs.a = 2;
			obs.a = 3; // should compact into one record (old 1 -> new 3)
			obs.b.c = 2;
			obs.b.c = 5; // should compact into one record (old 1 -> new 5)
		});

		const history = observe.getHistory(observed);
		// Expect 2 records (a and b.c), not 4
		expect(history.length).toBe(2);
		expect(history[0]).toMatchObject({ path: [ 'a' ], type: 'set', oldValue: 1, newValue: 3 });
		expect(history[1]).toMatchObject({ path: [ 'b', 'c' ], type: 'set', oldValue: 1, newValue: 5 });
	});

	test('configure: compactConsecutiveSamePath does not compact array index updates', () => {
		const state = { arr: [ 0 ] as number[] };
		const observed = observe(state);
		observe.configure(observed, { compactConsecutiveSamePath: true });

		observe.batch(observed, obs => {
			obs.arr[0] = 1;
			obs.arr[0] = 2; // should remain as two separate records
		});

		const history = observe.getHistory(observed);
		expect(history.length).toBeGreaterThanOrEqual(2);
		const idxRecords = history.filter(h => h.path.join('.') === 'arr.0');
		expect(idxRecords.length).toBe(2);
		expect(idxRecords[0]).toMatchObject({ type: 'set', oldValue: 0, newValue: 1 });
		expect(idxRecords[1]).toMatchObject({ type: 'set', oldValue: 1, newValue: 2 });
	});

	test('listeners are per-path and do not cross-fire for same object at different locations', () => {
		const shared = { v: 1 };
		const root = { x1: shared, x2: shared };
		const observed = observe(root);

		const onX1 = vi.fn();
		const onX2 = vi.fn();
		const stop1 = observe.listen(observed, o => o.x1.v, (p, nv, ov) => onX1(p.join('.'), nv, ov));
		const stop2 = observe.listen(observed, o => o.x2.v, (p, nv, ov) => onX2(p.join('.'), nv, ov));

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
		const stop = observe.listen(observed, s => s.users[0], (p, nv, ov) => onUser0(p.join('.'), nv, ov));

		observed.users[0].name = 'b';
		expect(onUser0).toHaveBeenCalled();
		expect(onUser0.mock.calls[0][0]).toBe('users.0.name');

		stop();
	});

	test('delete triggers listener with undefined new value and correct old value', () => {
		const obj = ({ a: { b: 3 } } as const) as { a: { b?: number; }; };
		const observed = observe(obj);

		const onAB = vi.fn();
		const stop = observe.listen(observed, o => o.a.b, (p, nv, ov) => onAB(p.join('.'), nv, ov));

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

		const history = observe.getHistory(observed);
		expect(history.length).toBe(3);
		expect(history[0]).toMatchObject({ path: [ 'a' ], type: 'set', oldValue: 1, newValue: 5 });
		expect(history[1]).toMatchObject({ path: [ 'b', 'c' ], type: 'set', oldValue: 2, newValue: 7 });
		expect(history[2]).toMatchObject({ path: [ 'b', 'c' ], type: 'delete', oldValue: 7 });

		observe.undo(observed); // undo all
		expect(original).toEqual({ a: 1, b: { c: 2 } });
		// undo should not add to history
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('undo reconstructs missing parents (deep delete then undo)', () => {
		const state = { user: { profile: { name: 'Anna' } } };
		const observed = observe(state);

		// delete the whole profile, then undo
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (observed as any).user.profile;
		expect(state.user.profile).toBeUndefined();

		observe.undo(observed);
		expect(state.user.profile).toEqual({ name: 'Anna' });
	});

	test('diff and isPristine reflect changes and markPristine resets baseline', () => {
		const state = { a: 1, b: { c: 2 } };
		const observed = observe(state);

		// initial pristine
		expect(observe.isPristine!(observed)).toBe(true);

		// change existing -> changed
		observed.a = 3;
		let d = observe.diff!(observed);
		expect(d).toEqual([ { path: [ 'a' ], kind: 'changed', oldValue: 1, newValue: 3 } ]);
		expect(observe.isPristine!(observed)).toBe(false);

		// add new -> added
		(observed as any).b.d = 4;
		d = observe.diff!(observed);
		expect(d.some(x => x.kind === 'added' && x.path.join('.') === 'b.d')).toBe(true);

		// delete -> removed
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (observed as any).b.c;
		d = observe.diff!(observed);
		expect(d.some(x => x.kind === 'removed' && x.path.join('.') === 'b.c')).toBe(true);

		// mark pristine -> considered same
		observe.markPristine!(observed);
		expect(observe.isPristine!(observed)).toBe(true);
		expect(observe.getHistory(observed)).toEqual([]);

		// further change marks it non-pristine again
		observed.a = 42;
		expect(observe.isPristine!(observed)).toBe(false);
	});

	test('array push: index listener, history, and diff reflect new element', () => {
		const state = { items: [ { name: 'a' } ] };
		const observed = observe(state);

		const onIndex1 = vi.fn();
		const stop = observe.listen(observed, s => s.items[1], (p, nv, ov) => onIndex1(p.join('.'), nv, ov));

		observed.items.push({ name: 'b' });

		// listener for newly created index should fire once
		expect(onIndex1).toHaveBeenCalledTimes(1);
		expect(onIndex1).toHaveBeenLastCalledWith('items.1', { name: 'b' }, undefined);

		// history should contain a set for items.1 (ignore length record if present)
		const history = observe.getHistory(observed);
		expect(history.some(h => h.type === 'set' && h.path.join('.') === 'items.1')).toBe(true);

		// diff should report the added index
		const diffs = observe.diff!(observed);
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
		observe.undo(observed);

		// Back to original shape and values
		expect(state).toEqual({ a: { child: shared }, b: { slot: null }, arr: [ { id: 1 }, { id: 2 } ] });
		expect(observe.isPristine(observed)).toBe(true);
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('undo of push/unshift/splice removes inserted indices without holes and correct length', () => {
		const original = [ { id: 1 }, { id: 2 } ];
		const state = { arr: original.slice() };
		const observed = observe(state);

		// push then undoSince -> back to original, no holes
		let marker = observe.getHistory(observed).length;
		observed.arr.push({ id: 3 });
		expect(state.arr.length).toBe(3);
		observe.undoSince(observed, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);

		// unshift then undoSince -> back to original, no holes
		marker = observe.getHistory(observed).length;
		observed.arr.unshift({ id: 0 });
		expect(state.arr.length).toBe(3);
		observe.undoSince(observed, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);

		// splice insert then undoSince -> back to original, no holes
		marker = observe.getHistory(observed).length;
		observed.arr.splice(1, 0, { id: 99 });
		expect(state.arr.length).toBe(3);
		observe.undoSince(observed, marker);
		expect(state.arr.length).toBe(2);
		expect(state.arr).toEqual([ { id: 1 }, { id: 2 } ]);
		expect(state.arr.every((_v, i) => i in state.arr)).toBe(true);
	});

	test('undo steps: counts history records, not high-level ops (push/assign/length)', () => {
		const state = { a: 1, arr: [ 1, 2 ] };
		const observed = observe(state);

		// 1) primitive set -> 1 record
		let before = observe.getHistory(observed).length;
		observed.a = 2;
		let after = observe.getHistory(observed).length;
		expect(after - before).toBe(1);

		// 2) push -> typically 2 records (index set + length set)
		before = after;
		observed.arr.push(3);
		after = observe.getHistory(observed).length;
		const pushRecords = after - before;
		expect(pushRecords).toBeGreaterThanOrEqual(1); // at least one
		observe.undo(observed, pushRecords);
		expect(state.arr).toEqual([ 1, 2 ]);

		// 3) assign existing index -> 1 record
		before = observe.getHistory(observed).length;
		observed.arr[1] = 22;
		after = observe.getHistory(observed).length;
		expect(after - before).toBe(1);
		observe.undo(observed, 1);
		expect(state.arr).toEqual([ 1, 2 ]);

		// 4) length truncate -> 1 length-set + N deletes
		before = observe.getHistory(observed).length;
		observed.arr.push(3); // prepare three items again
		(observed as any).arr.length = 1;
		after = observe.getHistory(observed).length;
		const truncateRecords = after - before; // should be >= 2
		expect(truncateRecords).toBeGreaterThanOrEqual(2);
		observe.undo(observed, truncateRecords);
		expect(state.arr).toEqual([ 1, 2 ]);
		// a is still 2 from the primitive set above
		expect(state.a).toBe(2);
	});

	test('undoSince: revert to a saved history marker', () => {
		const state = { a: { n: 1 }, arr: [ { id: 1 } ] };
		const observed = observe(state);

		const marker = observe.getHistory(observed).length;
		observed.a.n = 2;               // 1
		observed.arr.push({ id: 2 });   // 2
		observed.a.n = 3;               // 3

		observe.undoSince(observed, marker);
		expect(state).toEqual({ a: { n: 1 }, arr: [ { id: 1 } ] });
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('bracket keys with dots are a single segment and match exact/up/down modes', () => {
		const dotKey = 'first.last';
		const state: { user: Record<string, any>; } = { user: { [dotKey]: 1, plain: 0 } };
		const observed = observe(state);

		const exact = vi.fn();
		const down = vi.fn();
		const up = vi.fn();

		const stopExact = observe.listen(
			observed,
			o => o.user[dotKey],
			(p, nv, ov) => exact(p.join('.'), nv, ov),
			'exact',
		);
		const stopDown = observe.listen(observed, o => o.user, (p, nv, ov) => down(p.join('.'), nv, ov), 'down');
		const stopUp = observe.listen(observed, o => o.user[dotKey], (p, nv, ov) => up(p.join('.'), nv, ov), 'up');

		// change the bracket key
		observed.user[dotKey] = 2;

		expect(exact).toHaveBeenCalledTimes(1);
		expect(exact).toHaveBeenLastCalledWith(`user.${ dotKey }`, 2, 1);
		expect(down).toHaveBeenCalledTimes(1);
		expect(down).toHaveBeenLastCalledWith(`user.${ dotKey }`, 2, 1);
		expect(up).toHaveBeenCalledTimes(0);

		// replace the parent object; up and down should fire for 'user'
		observed.user = { [dotKey]: 3, plain: 0 };

		expect(down).toHaveBeenCalledTimes(2);
		expect(down.mock.calls[1][0]).toBe('user');
		expect(up).toHaveBeenCalledTimes(1);
		expect(up.mock.calls[0][0]).toBe('user');

		stopExact();
		stopDown();
		stopUp();
	});

	test('mark: capture and undoSince marker reverts just the intended operations', () => {
		const state = { a: 1, arr: [ 1 ] };
		const observed = observe(state);

		const m = observe.mark(observed);
		observed.a = 2;
		observed.arr.push(2);
		observe.undoSince(observed, m);
		expect(state).toEqual({ a: 1, arr: [ 1 ] });
		expect(observe.getHistory(observed)).toEqual([]);
	});

	test('transaction: commit leaves state, returned undo reverts; throws auto-rollback', () => {
		const state = { user: { name: 'A' }, items: [ { id: 1 } ] };
		const observed = observe(state);

		// commit path
		const { result, marker, undo } = observe.transaction(observed, obs => {
			obs.user.name = 'B';
			obs.items.push({ id: 2 });

			return obs.user.name;
		});
		expect(result).toBe('B');
		expect(state).toEqual({ user: { name: 'B' }, items: [ { id: 1 }, { id: 2 } ] });
		undo();
		expect(state).toEqual({ user: { name: 'A' }, items: [ { id: 1 } ] });
		expect(observe.getHistory(observed).length).toBe(marker);

		// rollback path
		const m2 = observe.mark(observed);
		try {
			observe.transaction(observed, obs => {
				obs.user.name = 'C';
				obs.items.push({ id: 3 });
				throw new Error('boom');
			});
			// should not get here
			expect(false).toBe(true);
		}
		catch {
			// rolled back automatically
			expect(state).toEqual({ user: { name: 'A' }, items: [ { id: 1 } ] });
			expect(observe.getHistory(observed).length).toBe(m2);
		}
	});
});
