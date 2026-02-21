import { bench, describe } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


interface Obj { a: { b: { c: number; }; }; }

const makeChronicled = () => {
	const state: Obj = { a: { b: { c: 0 } } };
	const chronicled = chronicle(state);
	// warm up proxy path
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	chronicled.a.b.c;

	return chronicled;
};

const noOp = () => { /* noop */ };

describe('chronicle dispatch (microbench)', () => {
	bench('baseline: set leaf (no listeners)', () => {
		const chronicled = makeChronicled();
		let i = 0;
		chronicled.a.b.c = ++i;
		chronicle.undo(chronicled, 1);
	});

	bench('global listeners: 200', () => {
		const chronicled = makeChronicled();
		for (let i = 0; i < 200; i++)
			chronicle.listen(chronicled, o => o as any, noOp, 'down');

		let i = 0;
		chronicled.a.b.c = ++i;
		chronicle.undo(chronicled, 1);
	});

	bench('global listeners: 1k', () => {
		const chronicled = makeChronicled();
		for (let i = 0; i < 1000; i++)
			chronicle.listen(chronicled, o => o as any, noOp, 'down');

		let i = 0;
		chronicled.a.b.c = ++i;
		chronicle.undo(chronicled, 1);
	});

	bench('down listeners on ancestors: 200', () => {
		const chronicled = makeChronicled();
		// register many down listeners on a and a.b and a.b.c
		for (let i = 0; i < 200; i++) {
			chronicle.listen(chronicled, o => o.a, noOp, 'down');
			chronicle.listen(chronicled, o => o.a.b, noOp, 'down');
			chronicle.listen(chronicled, o => o.a.b.c, noOp, 'down');
		}

		let i = 0;
		chronicled.a.b.c = ++i;
		chronicle.undo(chronicled, 1);
	});

	bench('down listeners on ancestors: 1k', () => {
		const chronicled = makeChronicled();
		for (let i = 0; i < 1000; i++) {
			chronicle.listen(chronicled, o => o.a, noOp, 'down');
			chronicle.listen(chronicled, o => o.a.b, noOp, 'down');
			chronicle.listen(chronicled, o => o.a.b.c, noOp, 'down');
		}

		let i = 0;
		chronicled.a.b.c = ++i;
		chronicle.undo(chronicled, 1);
	});

	bench('up listeners on descendants: 200', () => {
		const chronicled = makeChronicled();
		// register many up listeners under a.b.c
		for (let i = 0; i < 200; i++)
			chronicle.listen(chronicled, o => (o as any).a.b.c[`k_${ i }`], noOp, 'up');

		let i = 0;
		chronicled.a.b.c = ++i;
		chronicle.undo(chronicled, 1);
	});

	bench('up listeners on descendants: 1k', () => {
		const chronicled = makeChronicled();
		for (let i = 0; i < 1000; i++)
			chronicle.listen(chronicled, o => (o as any).a.b.c[`k_${ i }`], noOp, 'up');

		let i = 0;
		chronicled.a.b.c = ++i;
		chronicle.undo(chronicled, 1);
	});

	bench('exact listeners on leaf: 1k', () => {
		const chronicled = makeChronicled();
		for (let i = 0; i < 1000; i++)
			chronicle.listen(chronicled, o => o.a.b.c, noOp, 'exact');

		let i = 0;
		chronicled.a.b.c = ++i;
		chronicle.undo(chronicled, 1);
	});

	bench('mixed modes/distribution: 1k total', () => {
		const chronicled = makeChronicled();
		// 400 global/down at root
		for (let i = 0; i < 400; i++)
			chronicle.listen(chronicled, o => o as any, noOp, 'down');

		// 300 down on ancestors
		for (let i = 0; i < 300; i++) {
			chronicle.listen(chronicled, o => o.a, noOp, 'down');
			chronicle.listen(chronicled, o => o.a.b, noOp, 'down');
		}

		// 200 up on descendants
		for (let i = 0; i < 200; i++)
			chronicle.listen(chronicled, o => (o as any).a.b.c[`k_${ i }`], noOp, 'up');

		// 100 exact on the leaf
		for (let i = 0; i < 100; i++)
			chronicle.listen(chronicled, o => o.a.b.c, noOp, 'exact');

		let i = 0;
		chronicled.a.b.c = ++i;
		chronicle.undo(chronicled, 1);
	});
});
