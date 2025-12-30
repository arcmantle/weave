import type { ChangeListener, ChangeMeta, ListenerOptions, QueuedCall } from './types.ts';

// Per-root pause state and queued notifications
const pauseState: WeakMap<object, { paused: boolean; queue: QueuedCall[]; }> = new WeakMap();

const isPaused = (root: object): boolean => (pauseState.get(root)?.paused === true);

const enqueue = (root: object, call: QueuedCall) => {
	let st = pauseState.get(root);
	if (!st) {
		st = { paused: true, queue: [] };
		pauseState.set(root, st);
	}

	st.queue.push(call);
};

export const notifyListeners = (
	root: object,
	listeners: Set<ChangeListener>,
	args: [ string[], any, any, ChangeMeta | undefined ],
): void => {
	if (listeners.size === 0)
		return;

	if (isPaused(root)) {
		listeners.forEach(listener => enqueue(root, { listener, args }));

		return;
	}

	listeners.forEach(listener => listener(...args));
};

export const pause = (obj: object): void => {
	const st = pauseState.get(obj);
	if (st)
		st.paused = true;
	else
		pauseState.set(obj, { paused: true, queue: [] });
};

export const resume = (obj: object): void => {
	const st = pauseState.get(obj);
	if (!st)
		return;

	// Deliver queued notifications in FIFO order
	const q = st.queue.splice(0, st.queue.length);
	st.paused = false;
	for (const { listener, args } of q)
		listener(...args);
};

export const flush = (obj: object): void => {
	const st = pauseState.get(obj);
	if (!st || st.queue.length === 0)
		return;

	const q = st.queue.splice(0, st.queue.length);
	for (const { listener, args } of q)
		listener(...args);
};

// Wrap a listener with QoL options: once, debounce, throttle, schedule=microtask
export const buildEffectiveListener = (
	listener: ChangeListener,
	options?: ListenerOptions,
): { effective: ChangeListener; setUnsubscribe: (fn: () => void) => void; } => {
	const opts = options ?? {};
	let unsubscribe: (() => void) | undefined;
	const setUnsubscribe = (fn: () => void) => { unsubscribe = fn; };

	const scheduleInvoke = (fn: () => void) => {
		if (opts.schedule === 'microtask')
			queueMicrotask(fn);
		else
			fn();
	};

	let calledOnce = false;
	let debounceTimer: any = null;
	let throttleTimer: any = null;
	let nextAllowed = 0;
	let pendingArgs: [string[], any, any, ChangeMeta | undefined] | null = null;

	const invoke = (args: [string[], any, any, ChangeMeta | undefined]) => {
		if (opts.once && calledOnce)
			return;

		scheduleInvoke(() => {
			listener(...args);
			if (opts.once) {
				calledOnce = true;
				if (unsubscribe)
					unsubscribe();
			}
		});
	};

	const effective: ChangeListener = (path, newValue, oldValue, meta) => {
		const args: [string[], any, any, ChangeMeta | undefined] = [ path, newValue, oldValue, meta ];
		if (opts.debounceMs != null && opts.debounceMs >= 0) {
			pendingArgs = args;
			if (debounceTimer)
				clearTimeout(debounceTimer);

			debounceTimer = setTimeout(() => {
				const a = pendingArgs!;
				pendingArgs = null;
				invoke(a);
			}, opts.debounceMs);

			return;
		}

		if (opts.throttleMs != null && opts.throttleMs > 0) {
			const now = Date.now();
			if (now >= nextAllowed) {
				nextAllowed = now + opts.throttleMs;
				invoke(args);
			}
			else {
				pendingArgs = args;
				if (!throttleTimer) {
					throttleTimer = setTimeout(() => {
						throttleTimer = null;
						const a = pendingArgs!;
						pendingArgs = null;
						nextAllowed = Date.now() + (opts.throttleMs ?? 0);
						invoke(a);
					}, Math.max(0, nextAllowed - now));
				}
			}

			return;
		}

		// default immediate
		invoke(args);
	};

	return { effective, setUnsubscribe };
};
