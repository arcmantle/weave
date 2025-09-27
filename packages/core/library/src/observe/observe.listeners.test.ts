import { describe, expect, test, vi } from 'vitest';

import { observe } from './observe.ts';

describe('observe - listeners', () => {
	test('path listener fires with correct path and values', () => {
		const obj = { a: { b: 1 } };
		const observed = observe(obj);
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

	test('symbol keys are handled in listen selectors and dispatch correctly', () => {
		const S = Symbol('skey');
		const state: any = { bag: { [S]: { n: 1 }, other: 0 } };
		const observed = observe(state);
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		(observed as any).bag;

		const onUp = vi.fn();
		const stopUp = observe.listen(observed, o => (o as any).bag[S], (p, nv, ov) => onUp(p.join('.'), nv, ov), 'up');

		(observed as any).bag = { [S]: { n: 3 }, other: 0 };
		expect(onUp).toHaveBeenCalledTimes(1);

		stopUp();
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

		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete (observed as any).a.b;

		expect(onAB).toHaveBeenCalledTimes(1);
		expect(onAB).toHaveBeenLastCalledWith('a.b', undefined, 3);

		stop();
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

		observed.user[dotKey] = 2;

		expect(exact).toHaveBeenCalledTimes(1);
		expect(exact).toHaveBeenLastCalledWith(`user.${ dotKey }`, 2, 1);
		expect(down).toHaveBeenCalledTimes(1);
		expect(down).toHaveBeenLastCalledWith(`user.${ dotKey }`, 2, 1);
		expect(up).toHaveBeenCalledTimes(0);

		observed.user = { [dotKey]: 3, plain: 0 };

		expect(down).toHaveBeenCalledTimes(2);
		expect(down.mock.calls[1][0]).toBe('user');
		expect(up).toHaveBeenCalledTimes(1);
		expect(up.mock.calls[0][0]).toBe('user');

		stopExact();
		stopDown();
		stopUp();
	});
});
