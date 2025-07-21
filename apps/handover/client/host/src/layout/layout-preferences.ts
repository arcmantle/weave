import { type Signal, signal } from '@arcmantle/adapter-element/shared';

class LocalStorageManager {

	static getItem<T>(key: string, fallback: T): T {
		const item = localStorage.getItem(key);

		let value: T;

		if (!item) {
			this.setItem(key, fallback);

			value = fallback;
		}
		else {
			const parsed = JSON.parse(item) as { value: unknown; };
			value = parsed.value as T;
		}

		return value as T;
	}

	static setItem(key: string, value: any): void {
		localStorage.setItem(key, JSON.stringify({ value }));
	}

}

const createLocalStorageSignal = <T>(key: string, fallback: T): Signal<T> => {
	const sig = signal(LocalStorageManager.getItem(key, fallback));
	sig.subscribe(value => LocalStorageManager.setItem(key, value));

	return sig;
};


export const layoutPreferences = {
	primarySidebar: {
		visible: createLocalStorageSignal('primarySidebarVisible', true) as Signal<boolean>,
	},
	secondarySidebar: {
		visible: createLocalStorageSignal('secondarySidebarVisible', true) as Signal<boolean>,
	},
	editorArea: {
		visible: createLocalStorageSignal('editorAreaVisible', true) as Signal<boolean>,
	},
	panelArea: {
		visible: createLocalStorageSignal('panelAreaVisible', true) as Signal<boolean>,
	},
	statusbar: {
		visible: createLocalStorageSignal('statusbarVisible', true) as Signal<boolean>,
	},
};
