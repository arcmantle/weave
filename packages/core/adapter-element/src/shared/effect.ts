import { Signal as SignalPolyfill } from 'signal-polyfill';


let needsEnqueue = true;


const watcher = new SignalPolyfill.subtle.Watcher(() => {
	if (needsEnqueue) {
		needsEnqueue = false;
		queueMicrotask(processPending);
	}
});


function processPending() {
	needsEnqueue = true;

	for (const s of watcher.getPending())
		s.get();

	watcher.watch();
}


export function effectNative(callback: () => any): () => void {
	let cleanup: ((...args: any) => any) | undefined = undefined;

	const computed = new SignalPolyfill.Computed(() => {
		cleanup?.();
		cleanup = callback();
	});

	watcher.watch(computed);
	computed.get();

	return (): void => {
		watcher.unwatch(computed);

		cleanup?.();
		cleanup = undefined;
	};
};
