import { bench, describe } from 'vitest';

import { observe } from '../observe.ts';

interface Obj { a: { b: { c: number; }; }; }

const makeObserved = () => {
	const state: Obj = { a: { b: { c: 0 } } };
	const observed = observe(state);
	// warm up proxy path
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	observed.a.b.c;

	return observed;
};

const noOp = () => { /* noop */ };

describe('observe dispatch (microbench)', () => {
	bench('baseline: set leaf (no listeners)', () => {
		const observed = makeObserved();
		let i = 0;
		observed.a.b.c = ++i;
		observe.undo(observed, 1);
	});

	bench('global listeners: 200', () => {
		const observed = makeObserved();
		for (let i = 0; i < 200; i++)
			observe.listen(observed, o => o as any, noOp, 'down');

		let i = 0;
		observed.a.b.c = ++i;
		observe.undo(observed, 1);
	});

	bench('global listeners: 1k', () => {
		const observed = makeObserved();
		for (let i = 0; i < 1000; i++)
			observe.listen(observed, o => o as any, noOp, 'down');

		let i = 0;
		observed.a.b.c = ++i;
		observe.undo(observed, 1);
	});

	bench('down listeners on ancestors: 200', () => {
		const observed = makeObserved();
		// register many down listeners on a and a.b and a.b.c
		for (let i = 0; i < 200; i++) {
			observe.listen(observed, o => o.a, noOp, 'down');
			observe.listen(observed, o => o.a.b, noOp, 'down');
			observe.listen(observed, o => o.a.b.c, noOp, 'down');
		}

		let i = 0;
		observed.a.b.c = ++i;
		observe.undo(observed, 1);
	});

	bench('down listeners on ancestors: 1k', () => {
		const observed = makeObserved();
		for (let i = 0; i < 1000; i++) {
			observe.listen(observed, o => o.a, noOp, 'down');
			observe.listen(observed, o => o.a.b, noOp, 'down');
			observe.listen(observed, o => o.a.b.c, noOp, 'down');
		}

		let i = 0;
		observed.a.b.c = ++i;
		observe.undo(observed, 1);
	});

	bench('up listeners on descendants: 200', () => {
		const observed = makeObserved();
		// register many up listeners under a.b.c
		for (let i = 0; i < 200; i++)
			observe.listen(observed, o => (o as any).a.b.c[`k_${ i }`], noOp, 'up');

		let i = 0;
		observed.a.b.c = ++i;
		observe.undo(observed, 1);
	});

	bench('up listeners on descendants: 1k', () => {
		const observed = makeObserved();
		for (let i = 0; i < 1000; i++)
			observe.listen(observed, o => (o as any).a.b.c[`k_${ i }`], noOp, 'up');

		let i = 0;
		observed.a.b.c = ++i;
		observe.undo(observed, 1);
	});

	bench('exact listeners on leaf: 1k', () => {
		const observed = makeObserved();
		for (let i = 0; i < 1000; i++)
			observe.listen(observed, o => o.a.b.c, noOp, 'exact');

		let i = 0;
		observed.a.b.c = ++i;
		observe.undo(observed, 1);
	});

	bench('mixed modes/distribution: 1k total', () => {
		const observed = makeObserved();
		// 400 global/down at root
		for (let i = 0; i < 400; i++)
			observe.listen(observed, o => o as any, noOp, 'down');

		// 300 down on ancestors
		for (let i = 0; i < 300; i++) {
			observe.listen(observed, o => o.a, noOp, 'down');
			observe.listen(observed, o => o.a.b, noOp, 'down');
		}

		// 200 up on descendants
		for (let i = 0; i < 200; i++)
			observe.listen(observed, o => (o as any).a.b.c[`k_${ i }`], noOp, 'up');

		// 100 exact on the leaf
		for (let i = 0; i < 100; i++)
			observe.listen(observed, o => o.a.b.c, noOp, 'exact');

		let i = 0;
		observed.a.b.c = ++i;
		observe.undo(observed, 1);
	});
});
