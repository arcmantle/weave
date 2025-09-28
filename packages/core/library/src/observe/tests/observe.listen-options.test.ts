import { describe, expect, test, vi } from 'vitest';

import { observe } from '../observe.ts';

describe('observe.listen - options', () => {
	test('once: listener called only once and auto-unsubscribes', () => {
		const state = { a: 0 };
		const observed = observe(state);

		let calls = 0;
		observe.listen(observed, s => s.a, () => { calls++; }, 'exact', { once: true });

		observed.a = 1;
		observed.a = 2;

		expect(calls).toBe(1);
	});

	test('schedule: microtask delays invocation until after sync code', async () => {
		const state = { a: 0 };
		const observed = observe(state);

		let called = false;
		observe.listen(observed, s => s.a, () => { called = true; }, 'exact', { schedule: 'microtask' });

		observed.a = 1;
		// Should not have been called synchronously
		expect(called).toBe(false);

		await Promise.resolve(); // flush microtasks
		expect(called).toBe(true);
	});

	test('debounceMs: coalesces rapid changes into a single notification', () => {
		vi.useFakeTimers();
		const state = { a: 0 };
		const observed = observe(state);

		let calls = 0;
		observe.listen(observed, s => s.a, () => { calls++; }, 'exact', { debounceMs: 10 });

		observed.a = 1;
		vi.advanceTimersByTime(5);
		observed.a = 2;
		vi.advanceTimersByTime(5);
		observed.a = 3;

		// Not yet fired
		expect(calls).toBe(0);
		vi.advanceTimersByTime(10);
		expect(calls).toBe(1);

		vi.useRealTimers();
	});

	test('throttleMs: delivers at most once per window with trailing call', () => {
		vi.useFakeTimers();
		const state = { a: 0 };
		const observed = observe(state);

		let calls = 0;
		observe.listen(observed, s => s.a, () => { calls++; }, 'exact', { throttleMs: 10 });

		observed.a = 1; // immediate
		expect(calls).toBe(1);
		observed.a = 2; // throttled, trailing scheduled
		expect(calls).toBe(1);

		vi.advanceTimersByTime(9);
		expect(calls).toBe(1);
		vi.advanceTimersByTime(2);
		expect(calls).toBe(2);

		vi.useRealTimers();
	});
});
