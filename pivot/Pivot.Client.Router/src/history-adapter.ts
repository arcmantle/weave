/**
 * History adapter interface for abstracting navigation state management.
 * Allows the router to operate without the browser History API,
 * enabling use in Chrome extensions, service workers, tests, etc.
 */
export interface HistoryAdapter {
	/** The origin URL (e.g. `http://localhost:3000`). Used for URL construction. */
	readonly origin: string;

	/** Get the current pathname (e.g. `/users/123`). */
	getCurrentPath(): string;

	/** Get the current full URL string. */
	getCurrentURL(): string;

	/** Get the current scroll position. Returns `{ x: 0, y: 0 }` if not applicable. */
	getScrollPosition(): { x: number; y: number; };

	/**
	 * Push a new entry onto the history stack.
	 * @param state - Arbitrary state object to associate.
	 * @param url   - The URL string to push (pathname + search + hash).
	 */
	pushState(state: any, url: string): void;

	/**
	 * Replace the current history entry.
	 * @param state - Arbitrary state object to associate.
	 * @param url   - The URL string to replace with.
	 */
	replaceState(state: any, url: string): void;

	/**
	 * Navigate back in the history stack.
	 * Adapters that don't support back/forward may no-op.
	 */
	back(): void;

	/**
	 * Navigate forward in the history stack.
	 * Adapters that don't support back/forward may no-op.
	 */
	forward(): void;

	/**
	 * Subscribe to navigation changes (e.g. popstate, or adapter-specific events).
	 * @returns An unsubscribe function.
	 */
	onPopState(listener: () => void): () => void;

	/**
	 * Subscribe to anchor click events for SPA link interception.
	 * Adapters without a DOM may no-op and return a no-op unsubscribe.
	 * @returns An unsubscribe function.
	 */
	onLinkClick(listener: (e: MouseEvent) => void): () => void;

	/** Scroll to a specific position. No-ops in non-DOM environments. */
	scrollTo(x: number, y: number): void;

	/** Scroll an element into view. No-ops in non-DOM environments. */
	scrollIntoView(elementId: string): void;

	/**
	 * Dispose of the adapter, removing all event listeners.
	 * Called when the router is destroyed.
	 */
	dispose(): void;
}


/**
 * Default browser-based history adapter.
 * Wraps the standard History API, window.location, popstate, and click interception.
 */
export class BrowserHistoryAdapter implements HistoryAdapter {

	protected popStateListeners: (() => void)[] = [];
	protected clickListeners:    ((e: MouseEvent) => void)[] = [];
	protected boundPopState:     () => void;
	protected boundClick:        (e: MouseEvent) => void;

	get origin(): string {
		return window.location.origin;
	}

	constructor() {
		this.boundPopState = () => {
			this.popStateListeners.forEach(l => l());
		};

		this.boundClick = (e: MouseEvent) => {
			this.clickListeners.forEach(l => l(e));
		};

		window.addEventListener('popstate', this.boundPopState);
		document.addEventListener('click', this.boundClick);
	}

	getCurrentPath(): string {
		return window.location.pathname;
	}

	getCurrentURL(): string {
		return window.location.href;
	}

	getScrollPosition(): { x: number; y: number; } {
		return { x: window.scrollX, y: window.scrollY };
	}

	pushState(state: any, url: string): void {
		window.history.pushState(state, '', url);
	}

	replaceState(state: any, url: string): void {
		window.history.replaceState(state, '', url);
	}

	back(): void {
		window.history.back();
	}

	forward(): void {
		window.history.forward();
	}

	onPopState(listener: () => void): () => void {
		this.popStateListeners.push(listener);

		return () => {
			const idx = this.popStateListeners.indexOf(listener);
			if (idx > -1)
				this.popStateListeners.splice(idx, 1);
		};
	}

	onLinkClick(listener: (e: MouseEvent) => void): () => void {
		this.clickListeners.push(listener);

		return () => {
			const idx = this.clickListeners.indexOf(listener);
			if (idx > -1)
				this.clickListeners.splice(idx, 1);
		};
	}

	scrollTo(x: number, y: number): void {
		window.scrollTo(x, y);
	}

	scrollIntoView(elementId: string): void {
		const el = document.getElementById(elementId);
		if (el)
			el.scrollIntoView({ behavior: 'smooth' });
	}

	dispose(): void {
		window.removeEventListener('popstate', this.boundPopState);
		document.removeEventListener('click', this.boundClick);
		this.popStateListeners = [];
		this.clickListeners = [];
	}

}


/** Configuration options for the MemoryHistoryAdapter. */
export interface MemoryHistoryAdapterConfig {
	/** Initial path to start at. Defaults to `/`. */
	initialPath?: string;

	/** Origin URL for URL construction. Defaults to `http://localhost`. */
	origin?: string;

	/**
	 * Optional storage backend for persisting the current path.
	 * Useful for Chrome extensions that want to persist routing state
	 * across popup opens via `localStorage`, `chrome.storage`, etc.
	 */
	storage?: MemoryHistoryStorage;
}


/** Storage interface for persisting memory history state. */
export interface MemoryHistoryStorage {
	getPath():            string | null;
	setPath(path: string): void;
}


/** History entry stored in the memory stack. */
interface MemoryHistoryEntry {
	state: any;
	url:   string;
}


/**
 * In-memory history adapter with no browser API dependencies.
 *
 * Use cases:
 * - Chrome extensions (popup / side panel routing)
 * - Service workers
 * - SSR / Node.js environments
 * - Unit testing
 * - Any context without `window.history`
 *
 * Optionally backed by a storage interface (e.g. `localStorage`) so that
 * routing state persists across Chrome extension popup reopens.
 */
export class MemoryHistoryAdapter implements HistoryAdapter {

	protected stack:     MemoryHistoryEntry[];
	protected index:     number;
	protected listeners: (() => void)[] = [];
	protected _origin:   string;
	protected storage?:  MemoryHistoryStorage;

	get origin(): string {
		return this._origin;
	}

	constructor(config: MemoryHistoryAdapterConfig = {}) {
		this._origin = config.origin ?? 'http://localhost';
		this.storage = config.storage;

		const initialPath = this.storage?.getPath() ?? config.initialPath ?? '/';
		this.stack = [ { state: null, url: initialPath } ];
		this.index = 0;
	}

	getCurrentPath(): string {
		const entry = this.stack[this.index]!;

		// Strip query and hash to return just the pathname
		try {
			const url = new URL(entry.url, this._origin);

			return url.pathname;
		}
		catch {
			return entry.url.split('?')[0]!.split('#')[0]!;
		}
	}

	getCurrentURL(): string {
		const entry = this.stack[this.index]!;

		try {
			return new URL(entry.url, this._origin).href;
		}
		catch {
			return this._origin + entry.url;
		}
	}

	getScrollPosition(): { x: number; y: number; } {
		return { x: 0, y: 0 };
	}

	pushState(state: any, url: string): void {
		// Discard any forward entries
		this.stack = this.stack.slice(0, this.index + 1);
		this.stack.push({ state, url });
		this.index++;

		this.storage?.setPath(url);
	}

	replaceState(state: any, url: string): void {
		this.stack[this.index] = { state, url };
		this.storage?.setPath(url);
	}

	back(): void {
		if (this.index > 0) {
			this.index--;
			this.storage?.setPath(this.stack[this.index]!.url);
			this.listeners.forEach(l => l());
		}
	}

	forward(): void {
		if (this.index < this.stack.length - 1) {
			this.index++;
			this.storage?.setPath(this.stack[this.index]!.url);
			this.listeners.forEach(l => l());
		}
	}

	onPopState(listener: () => void): () => void {
		this.listeners.push(listener);

		return () => {
			const idx = this.listeners.indexOf(listener);
			if (idx > -1)
				this.listeners.splice(idx, 1);
		};
	}

	onLinkClick(_listener: (e: MouseEvent) => void): () => void {
		// No DOM in memory mode — no-op
		return () => {};
	}

	scrollTo(_x: number, _y: number): void {
		// No-op in memory mode
	}

	scrollIntoView(_elementId: string): void {
		// No-op in memory mode
	}

	dispose(): void {
		this.listeners = [];
	}

	/** Get the current history stack length (useful for testing). */
	get length(): number {
		return this.stack.length;
	}

	/** Get the current state object. */
	get state(): any {
		return this.stack[this.index]?.state ?? null;
	}

}
