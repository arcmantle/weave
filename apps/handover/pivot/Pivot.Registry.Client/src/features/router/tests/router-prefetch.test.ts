import { html } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrefetchConfig, RouteConfig } from '../router';
import { Router } from '../router';


describe('Router - Prefetching', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
		window.history.replaceState(null, '', '/');
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe('Manual Prefetching', () => {
		it('should preload a single route', async () => {
			const lazyFn = vi.fn().mockResolvedValue([ { path: 'details', template: () => html`<div>Details</div>` } ]);

			router = new Router();
			const routes: RouteConfig[] = [
				{
					path: '/products',
					lazy: lazyFn,
				},
			];
			router.setRoutes(routes);

			await router.preload('/products');

			expect(lazyFn).toHaveBeenCalledOnce();
		});

		it('should cache preloaded routes', async () => {
			const lazyFn = vi.fn().mockResolvedValue([ { path: 'details', template: () => html`<div>Details</div>` } ]);

			router = new Router();
			const routes: RouteConfig[] = [
				{
					path: '/products',
					lazy: lazyFn,
				},
			];
			router.setRoutes(routes);

			// Preload twice
			await router.preload('/products');
			await router.preload('/products');

			// Should only load once
			expect(lazyFn).toHaveBeenCalledOnce();
		});

		it('should reuse prefetch cache during navigation', async () => {
			const lazyFn = vi.fn().mockResolvedValue([ { path: 'details', template: () => html`<div>Details</div>` } ]);

			router = new Router();
			const routes: RouteConfig[] = [
				{
					path: '/products',
					lazy: lazyFn,
				},
			];
			router.setRoutes(routes);

			// Preload
			await router.preload('/products');

			// Navigate - should use cached data
			await router.navigate('/products');

			// Should only load once (during preload)
			expect(lazyFn).toHaveBeenCalledOnce();
		});

		it('should preload all lazy routes with preloadAll()', async () => {
			const lazyFn1 = vi.fn().mockResolvedValue([]);
			const lazyFn2 = vi.fn().mockResolvedValue([]);

			router = new Router();
			const routes: RouteConfig[] = [
				{ path: '/products', lazy: lazyFn1 },
				{ path: '/users', lazy: lazyFn2 },
			];
			router.setRoutes(routes);

			await router.preloadAll();

			expect(lazyFn1).toHaveBeenCalledOnce();
			expect(lazyFn2).toHaveBeenCalledOnce();
		});

		it('should handle preload errors gracefully', async () => {
			const lazyFn = vi.fn().mockRejectedValue(new Error('Load failed'));

			router = new Router();
			const routes: RouteConfig[] = [ { path: '/broken', lazy: lazyFn } ];
			router.setRoutes(routes);

			// Should not throw
			await expect(router.preload('/broken')).resolves.toBeUndefined();
		});

		it('should not preload non-lazy routes', async () => {
			router = new Router();
			const routes: RouteConfig[] = [ { path: '/', template: () => html`<div>Home</div>` } ];
			router.setRoutes(routes);

			// Should complete without error
			await expect(router.preload('/')).resolves.toBeUndefined();
		});
	});

	describe('Hover Strategy', () => {
		it('should prefetch on link hover with delay', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			const prefetchConfig: PrefetchConfig = {
				strategy: 'hover',
				delay:    50,
			};

			router = new Router({ prefetch: prefetchConfig });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			// Add link to DOM
			const link = document.createElement('a');
			link.href = '/products';
			document.body.appendChild(link);

			// Simulate hover
			const event = new MouseEvent('mouseover', { bubbles: true });
			link.dispatchEvent(event);

			// Should not prefetch immediately
			expect(lazyFn).not.toHaveBeenCalled();

			// Advance time past delay
			vi.advanceTimersByTime(50);
			await vi.runAllTimersAsync();

			expect(lazyFn).toHaveBeenCalledOnce();
		});

		it('should ignore external links', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			const prefetchConfig: PrefetchConfig = {
				strategy: 'hover',
			};

			router = new Router({ prefetch: prefetchConfig });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			// Add external link
			const link = document.createElement('a');
			link.href = 'https://external.com/page';
			document.body.appendChild(link);

			// Simulate hover
			const event = new MouseEvent('mouseover', { bubbles: true });
			link.dispatchEvent(event);

			vi.advanceTimersByTime(100);
			await vi.runAllTimersAsync();

			expect(lazyFn).not.toHaveBeenCalled();
		});
	});

	describe('Visible Strategy', () => {
		it('should prefetch when link becomes visible', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			// Mock IntersectionObserver
			const mockObserve = vi.fn();
			const mockDisconnect = vi.fn();
			let callback: IntersectionObserverCallback;

			global.IntersectionObserver = class {

				constructor(cb: IntersectionObserverCallback) {
					callback = cb;
				}

				observe = mockObserve;
				disconnect = mockDisconnect;
				unobserve = vi.fn();
				takeRecords = () => [];
				root = null;
				rootMargin = '';
				thresholds = [];

			} as any;

			const prefetchConfig: PrefetchConfig = {
				strategy:  'visible',
				threshold: 0.1,
			};

			router = new Router({ prefetch: prefetchConfig });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			// Add link
			const link = document.createElement('a');
			link.href = '/products';
			document.body.appendChild(link);

			// Simulate intersection
			const entries: IntersectionObserverEntry[] = [
				{
					isIntersecting: true,
					target:         link,
				} as unknown as IntersectionObserverEntry,
			];

			callback!(entries, {} as IntersectionObserver);
			await vi.runAllTimersAsync();

			expect(lazyFn).toHaveBeenCalledOnce();
		});

		it('should not prefetch when link is not intersecting', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			let callback: IntersectionObserverCallback;
			global.IntersectionObserver = class {

				constructor(cb: IntersectionObserverCallback) {
					callback = cb;
				}

				observe = vi.fn();
				disconnect = vi.fn();
				unobserve = vi.fn();
				takeRecords = () => [];
				root = null;
				rootMargin = '';
				thresholds = [];

			} as any;

			const prefetchConfig: PrefetchConfig = {
				strategy: 'visible',
			};

			router = new Router({ prefetch: prefetchConfig });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			const link = document.createElement('a');
			link.href = '/products';
			document.body.appendChild(link);

			// Not intersecting
			const entries: IntersectionObserverEntry[] = [
				{
					isIntersecting: false,
					target:         link,
				} as unknown as IntersectionObserverEntry,
			];

			callback!(entries, {} as IntersectionObserver);
			await vi.runAllTimersAsync();

			expect(lazyFn).not.toHaveBeenCalled();
		});
	});

	describe('Idle Strategy', () => {
		it('should prefetch all routes during idle time', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			// Mock requestIdleCallback - should call callback immediately
			const mockRequestIdleCallback = vi.fn((cb: IdleRequestCallback) => {
				setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 0);

				return 1;
			});
			(window as any).requestIdleCallback = mockRequestIdleCallback;

			const prefetchConfig: PrefetchConfig = {
				strategy: 'idle',
			};

			router = new Router({ prefetch: prefetchConfig });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			// Advance timers to trigger idle callback
			await vi.runAllTimersAsync();

			expect(mockRequestIdleCallback).toHaveBeenCalled();
			expect(lazyFn).toHaveBeenCalled();
		});

		it('should fallback to setTimeout when requestIdleCallback unavailable', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			// Remove requestIdleCallback
			delete (window as any).requestIdleCallback;

			const prefetchConfig: PrefetchConfig = {
				strategy: 'idle',
			};

			router = new Router({ prefetch: prefetchConfig });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			// Advance setTimeout
			vi.advanceTimersByTime(1000);
			await vi.runAllTimersAsync();

			expect(lazyFn).toHaveBeenCalledOnce();
		});
	});

	describe('Manual Strategy', () => {
		it('should not auto-prefetch with manual strategy', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			const prefetchConfig: PrefetchConfig = {
				strategy: 'manual',
			};

			router = new Router({ prefetch: prefetchConfig });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			// Add link
			const link = document.createElement('a');
			link.href = '/products';
			document.body.appendChild(link);

			// Hover shouldn't trigger
			link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
			vi.advanceTimersByTime(100);
			await vi.runAllTimersAsync();

			expect(lazyFn).not.toHaveBeenCalled();

			// Manual preload should work
			await router.preload('/products');
			expect(lazyFn).toHaveBeenCalledOnce();
		});
	});

	describe('Stats Tracking', () => {
		it('should track prefetch stats', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			await router.preload('/products');

			const stats = router.getRouteStats();
			const productStats = stats.find(s => s.path === '/products');

			expect(productStats).toBeDefined();
			expect(productStats!.loadTime).toBeGreaterThanOrEqual(0);
			expect(productStats!.cacheHit).toBe(false);
		});
	});
});
