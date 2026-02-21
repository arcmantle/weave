import { describe, expect, test, vi } from 'vitest';

import { chronicle } from '../src/chronicle.ts';


describe('chronicle.listen - options', () => {
	test('once: listener called only once and auto-unsubscribes', () => {
		const state = { a: 0 };
		const chronicled = chronicle(state);

		let calls = 0;
		chronicle.listen(chronicled, s => s.a, () => { calls++; }, 'exact', { once: true });

		chronicled.a = 1;
		chronicled.a = 2;

		expect(calls).toBe(1);
	});

	test('schedule: microtask delays invocation until after sync code', async () => {
		const state = { a: 0 };
		const chronicled = chronicle(state);

		let called = false;
		chronicle.listen(chronicled, s => s.a, () => { called = true; }, 'exact', { schedule: 'microtask' });

		chronicled.a = 1;
		// Should not have been called synchronously
		expect(called).toBe(false);

		await Promise.resolve(); // flush microtasks
		expect(called).toBe(true);
	});

	test('debounceMs: coalesces rapid changes into a single notification', () => {
		vi.useFakeTimers();
		const state = { a: 0 };
		const chronicled = chronicle(state);

		let calls = 0;
		chronicle.listen(chronicled, s => s.a, () => { calls++; }, 'exact', { debounceMs: 10 });

		chronicled.a = 1;
		vi.advanceTimersByTime(5);
		chronicled.a = 2;
		vi.advanceTimersByTime(5);
		chronicled.a = 3;

		// Not yet fired
		expect(calls).toBe(0);
		vi.advanceTimersByTime(10);
		expect(calls).toBe(1);

		vi.useRealTimers();
	});

	test('throttleMs: delivers at most once per window with trailing call', () => {
		vi.useFakeTimers();
		const state = { a: 0 };
		const chronicled = chronicle(state);

		let calls = 0;
		chronicle.listen(chronicled, s => s.a, () => { calls++; }, 'exact', { throttleMs: 10 });

		chronicled.a = 1; // immediate
		expect(calls).toBe(1);
		chronicled.a = 2; // throttled, trailing scheduled
		expect(calls).toBe(1);

		vi.advanceTimersByTime(9);
		expect(calls).toBe(1);
		vi.advanceTimersByTime(2);
		expect(calls).toBe(2);

		vi.useRealTimers();
	});
});
