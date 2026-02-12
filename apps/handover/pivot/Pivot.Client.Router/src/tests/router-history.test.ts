import { html } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryHistoryAdapter, type MemoryHistoryStorage } from '../history-adapter.js';
import { type RouteConfig, Router } from '../router.js';


// ─── MemoryHistoryAdapter unit tests ────────────────────────────────────────

describe('MemoryHistoryAdapter', () => {
	let adapter: MemoryHistoryAdapter;

	beforeEach(() => {
		adapter = new MemoryHistoryAdapter();
	});

	afterEach(() => {
		adapter.dispose();
	});

	it('should start at the initial path', () => {
		expect(adapter.getCurrentPath()).toBe('/');
	});

	it('should accept a custom initial path', () => {
		adapter = new MemoryHistoryAdapter({ initialPath: '/dashboard' });
		expect(adapter.getCurrentPath()).toBe('/dashboard');
	});

	it('should accept a custom origin', () => {
		adapter = new MemoryHistoryAdapter({ origin: 'https://my-extension.local' });
		expect(adapter.origin).toBe('https://my-extension.local');
	});

	it('should default origin to http://localhost', () => {
		expect(adapter.origin).toBe('http://localhost');
	});

	it('should push state onto the stack', () => {
		adapter.pushState(null, '/page-1');
		expect(adapter.getCurrentPath()).toBe('/page-1');
		expect(adapter.length).toBe(2); // initial + pushed
	});

	it('should replace state on the stack', () => {
		adapter.replaceState(null, '/replaced');
		expect(adapter.getCurrentPath()).toBe('/replaced');
		expect(adapter.length).toBe(1); // no growth
	});

	it('should navigate back', () => {
		adapter.pushState(null, '/page-1');
		adapter.pushState(null, '/page-2');
		adapter.back();

		expect(adapter.getCurrentPath()).toBe('/page-1');
	});

	it('should navigate forward', () => {
		adapter.pushState(null, '/page-1');
		adapter.pushState(null, '/page-2');
		adapter.back();
		adapter.forward();

		expect(adapter.getCurrentPath()).toBe('/page-2');
	});

	it('should not go back beyond the start', () => {
		adapter.back();
		expect(adapter.getCurrentPath()).toBe('/');
	});

	it('should not go forward beyond the end', () => {
		adapter.forward();
		expect(adapter.getCurrentPath()).toBe('/');
	});

	it('should discard forward entries on push', () => {
		adapter.pushState(null, '/a');
		adapter.pushState(null, '/b');
		adapter.back(); // now at /a
		adapter.pushState(null, '/c'); // /b should be discarded

		expect(adapter.length).toBe(3); // /, /a, /c
		adapter.forward(); // should not go anywhere
		expect(adapter.getCurrentPath()).toBe('/c');
	});

	it('should fire popstate listeners on back/forward', () => {
		const listener = vi.fn();
		adapter.onPopState(listener);

		adapter.pushState(null, '/page-1');
		adapter.back();

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('should unsubscribe from popstate', () => {
		const listener = vi.fn();
		const unsub = adapter.onPopState(listener);
		unsub();

		adapter.pushState(null, '/page-1');
		adapter.back();

		expect(listener).not.toHaveBeenCalled();
	});

	it('should return scroll position as 0,0', () => {
		expect(adapter.getScrollPosition()).toEqual({ x: 0, y: 0 });
	});

	it('should expose current state', () => {
		adapter.pushState({ foo: 'bar' }, '/stateful');
		expect(adapter.state).toEqual({ foo: 'bar' });
	});

	it('should return full URL from getCurrentURL', () => {
		adapter.pushState(null, '/test?q=1#hash');
		expect(adapter.getCurrentURL()).toBe('http://localhost/test?q=1#hash');
	});

	it('should strip query and hash from getCurrentPath', () => {
		adapter.pushState(null, '/test?q=1#hash');
		expect(adapter.getCurrentPath()).toBe('/test');
	});

	it('onLinkClick should return a no-op unsubscribe', () => {
		const unsub = adapter.onLinkClick(vi.fn());
		expect(typeof unsub).toBe('function');
		unsub(); // should not throw
	});

	it('scrollTo and scrollIntoView should not throw', () => {
		expect(() => adapter.scrollTo(0, 0)).not.toThrow();
		expect(() => adapter.scrollIntoView('test')).not.toThrow();
	});

	describe('with storage backend', () => {
		let storage: MemoryHistoryStorage;

		beforeEach(() => {
			const store: Record<string, string> = {};
			storage = {
				getPath: () => store['path'] ?? null,
				setPath: (path: string) => { store['path'] = path; },
			};
		});

		it('should restore initial path from storage', () => {
			storage.setPath('/restored');
			adapter = new MemoryHistoryAdapter({ storage });
			expect(adapter.getCurrentPath()).toBe('/restored');
		});

		it('should persist path to storage on push', () => {
			adapter = new MemoryHistoryAdapter({ storage });
			adapter.pushState(null, '/persisted');
			expect(storage.getPath()).toBe('/persisted');
		});

		it('should persist path to storage on replace', () => {
			adapter = new MemoryHistoryAdapter({ storage });
			adapter.replaceState(null, '/replaced');
			expect(storage.getPath()).toBe('/replaced');
		});

		it('should persist path to storage on back/forward', () => {
			adapter = new MemoryHistoryAdapter({ storage });
			adapter.pushState(null, '/a');
			adapter.pushState(null, '/b');
			adapter.back();
			expect(storage.getPath()).toBe('/a');
			adapter.forward();
			expect(storage.getPath()).toBe('/b');
		});
	});
});


// ─── Router + MemoryHistoryAdapter integration tests ────────────────────────

describe('Router with MemoryHistoryAdapter', () => {
	let router: Router;
	let adapter: MemoryHistoryAdapter;

	const routes: RouteConfig[] = [
		{ path: '/', template: () => html`<div>Home</div>` },
		{ path: '/about', template: () => html`<div>About</div>` },
		{ path: '/users/:id', template: (p) => html`<div>User ${ p['id'] }</div>` },
		{ path: '/contact', template: () => html`<div>Contact</div>` },
	];

	beforeEach(() => {
		adapter = new MemoryHistoryAdapter();
		router = new Router({ history: adapter });
		router.setRoutes(routes);
	});

	afterEach(() => {
		router.dispose();
	});

	it('should create a router with memory adapter', () => {
		expect(router).toBeDefined();
		expect(router.getHistoryAdapter()).toBe(adapter);
	});

	it('should navigate using memory adapter', async () => {
		const result = await router.navigate('/about');
		expect(result).toBe(true);
		expect(adapter.getCurrentPath()).toBe('/about');
	});

	it('should match routes after navigation', async () => {
		await router.navigate('/about');
		const match = router.match();
		expect(match).toBeDefined();
		expect(match?.path).toBe('/about');
	});

	it('should match parameterized routes', async () => {
		await router.navigate('/users/42');
		const match = router.match();
		expect(match).toBeDefined();
		expect(match?.params['id']).toBe('42');
	});

	it('should support replace navigation', async () => {
		await router.navigate('/about');
		await router.navigate('/contact', { replace: true });
		expect(adapter.getCurrentPath()).toBe('/contact');
		// Replace should not add to history, so length should be 2 (initial + navigate to /about, then replaced)
		expect(adapter.length).toBe(2);
	});

	it('should return false for non-existent routes', async () => {
		const result = await router.navigate('/nonexistent');
		expect(result).toBe(false);
	});

	it('should report current path through router', async () => {
		await router.navigate('/about');
		expect(router.getCurrentPath()).toBe('/about');
	});

	it('should handle query params', async () => {
		await router.navigate('/about', { query: { ref: 'nav' } });
		expect(adapter.getCurrentPath()).toBe('/about');
	});

	it('should handle hash', async () => {
		await router.navigate('/about', { hash: '#section' });
		expect(adapter.getCurrentPath()).toBe('/about');
	});

	it('should handle navigation state', async () => {
		await router.navigate('/about', { state: { from: 'home' } });
		expect(adapter.state).toEqual({ from: 'home' });
	});

	it('should work with guards', async () => {
		const guardedRoutes: RouteConfig[] = [
			{ path: '/', template: () => html`<div>Home</div>` },
			{
				path:        '/protected',
				template:    () => html`<div>Protected</div>`,
				beforeEnter: () => false,
			},
		];

		router.setRoutes(guardedRoutes);

		const result = await router.navigate('/protected');
		expect(result).toBe(false);
		expect(adapter.getCurrentPath()).toBe('/');
	});

	it('should work with redirects', async () => {
		const redirectRoutes: RouteConfig[] = [
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/old', redirect: '/new' },
			{ path: '/new', template: () => html`<div>New</div>` },
		];

		router.setRoutes(redirectRoutes);

		const result = await router.navigate('/old');
		expect(result).toBe(true);
		expect(adapter.getCurrentPath()).toBe('/new');
	});

	it('should work with named routes', async () => {
		const namedRoutes: RouteConfig[] = [
			{ path: '/', template: () => html`<div>Home</div>`, name: 'home' },
			{ path: '/about', template: () => html`<div>About</div>`, name: 'about' },
		];

		router.setRoutes(namedRoutes);

		const result = await router.navigateByName('about');
		expect(result).toBe(true);
		expect(adapter.getCurrentPath()).toBe('/about');
	});

	it('should support event listeners', async () => {
		const startSpy = vi.fn();
		const endSpy = vi.fn();
		router.onAfterNavigateStart(startSpy);
		router.onAfterNavigateEnd(endSpy);

		await router.navigate('/about');

		expect(startSpy).toHaveBeenCalledTimes(1);
		expect(endSpy).toHaveBeenCalledTimes(1);
	});

	it('should record metrics with memory adapter', async () => {
		const metricsRouter = new Router({
			history:       adapter,
			enableMetrics: true,
		});

		metricsRouter.setRoutes(routes);

		await metricsRouter.navigate('/about');

		const timings = metricsRouter.getTimings();
		expect(timings.length).toBeGreaterThan(0);

		metricsRouter.dispose();
	});

	it('should work with fallback routes', async () => {
		const fallbackRouter = new Router({
			history:       adapter,
			fallbackRoute: { path: '/404', template: () => html`<div>Not Found</div>` },
		});

		fallbackRouter.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/404', template: () => html`<div>Not Found</div>` },
		]);

		const result = await fallbackRouter.navigate('/nonexistent');
		expect(result).toBe(true);

		fallbackRouter.dispose();
	});
});


// ─── LocalStorage-backed adapter example ────────────────────────────────────

describe('MemoryHistoryAdapter with localStorage storage', () => {
	let store: Record<string, string>;
	let adapter: MemoryHistoryAdapter;

	beforeEach(() => {
		store = {};
		adapter = new MemoryHistoryAdapter({
			storage: {
				getPath: () => store['router-path'] ?? null,
				setPath: (path) => { store['router-path'] = path; },
			},
		});
	});

	afterEach(() => {
		adapter.dispose();
	});

	it('should persist navigation state across adapter instances', () => {
		// Simulate first popup open
		adapter.pushState(null, '/settings');
		expect(store['router-path']).toBe('/settings');

		adapter.dispose();

		// Simulate second popup open - should restore from storage
		const adapter2 = new MemoryHistoryAdapter({
			storage: {
				getPath: () => store['router-path'] ?? null,
				setPath: (path) => { store['router-path'] = path; },
			},
		});

		expect(adapter2.getCurrentPath()).toBe('/settings');
		adapter2.dispose();
	});
});
