import { html } from 'lit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NavigationTiming, RouteConfig } from '../router';
import { Router } from '../router';


describe('Router - Performance Metrics', () => {
	let router: Router;
	const mockSendBeacon = vi.fn();

	beforeEach(() => {
		// Reset DOM
		document.body.innerHTML = '<div id="app"></div>';
		window.history.replaceState(null, '', '/');

		// Mock sendBeacon
		Object.defineProperty(navigator, 'sendBeacon', {
			value:        mockSendBeacon,
			writable:     true,
			configurable: true,
		});
		mockSendBeacon.mockClear();
	});

	describe('Metrics Collection', () => {
		it('should collect navigation timing metrics by default', async () => {
			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [
				{ path: '/', template: () => html`<div>Home</div>` },
				{ path: '/about', template: () => html`<div>About</div>` },
			];
			router.setRoutes(routes);

			await router.navigate('/about');

			const timings = router.getTimings();
			expect(timings).toHaveLength(1);
			expect(timings[0]).toMatchObject({
				path:      '/about',
				total:     expect.any(Number),
				guards:    expect.any(Number),
				timestamp: expect.any(Number),
			});
		});

		it('should track all timing phases', async () => {
			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [
				{
					path:        '/',
					template:    () => html`<div>Home</div>`,
					beforeEnter: async () => {
						await new Promise(resolve => setTimeout(resolve, 10));

						return true;
					},
				},
			];
			router.setRoutes(routes);

			await router.navigate('/');

			const timing = router.getLastTiming();
			expect(timing).toBeDefined();
			expect(timing!.total).toBeGreaterThan(0);
			expect(timing!.guards).toBeGreaterThan(0);
			expect(timing!.templateRender).toBeGreaterThanOrEqual(0);
			expect(timing!.animations).toBeGreaterThanOrEqual(0);
			expect(timing!.scrollRestoration).toBeGreaterThanOrEqual(0);
			expect(timing!.redirect).toBe(0);
		});

		it('should track metrics for redirected routes', async () => {
			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [
				{ path: '/', template: () => html`<div>Home</div>` },
				{ path: '/old', redirect: '/' },
			];
			router.setRoutes(routes);

			await router.navigate('/old');

			const timings = router.getTimings();
			expect(timings.length).toBeGreaterThan(0);
			// Final navigation should be to '/'
			const lastTiming = router.getLastTiming();
			expect(lastTiming).toBeDefined();
			expect(lastTiming!.path).toBe('/');
		});

		it('should disable metrics when enableMetrics is false', async () => {
			router = new Router({ enableMetrics: false });
			const routes: RouteConfig[] = [ { path: '/', template: () => html`<div>Home</div>` } ];
			router.setRoutes(routes);

			await router.navigate('/');

			const timings = router.getTimings();
			expect(timings).toHaveLength(0);
		});
	});

	describe('LRU Cache', () => {
		it('should respect maxMetricsEntries limit', async () => {
			router = new Router({ enableMetrics: true, maxMetricsEntries: 3 });
			const routes: RouteConfig[] = [
				{ path: '/1', template: () => html`<div>1</div>` },
				{ path: '/2', template: () => html`<div>2</div>` },
				{ path: '/3', template: () => html`<div>3</div>` },
				{ path: '/4', template: () => html`<div>4</div>` },
			];
			router.setRoutes(routes);

			await router.navigate('/1');
			await router.navigate('/2');
			await router.navigate('/3');
			await router.navigate('/4');

			const timings = router.getTimings();
			expect(timings).toHaveLength(3);
			// Should keep most recent 3
			expect(timings.map(t => t.path)).toEqual([ '/2', '/3', '/4' ]);
		});

		it('should update position on access', () => {
			router = new Router({ enableMetrics: true, maxMetricsEntries: 2 });
			const cache = (router as any).timings;

			const timing1: NavigationTiming = {
				path:              '/1',
				total:             100,
				guards:            10,
				templateRender:    20,
				animations:        30,
				scrollRestoration: 5,
				redirect:          0,
				timestamp:         Date.now(),
			};
			const timing2: NavigationTiming = { ...timing1, path: '/2' };

			cache.set('/1', timing1);
			cache.set('/2', timing2);

			// Access /1 to make it most recent
			cache.get('/1');

			// Add /3, should evict /2
			const timing3: NavigationTiming = { ...timing1, path: '/3' };
			cache.set('/3', timing3);

			expect(cache.has('/1')).toBe(true);
			expect(cache.has('/2')).toBe(false);
			expect(cache.has('/3')).toBe(true);
		});
	});

	describe('Metrics Reporting', () => {
		it('should call reportPerformance callback', async () => {
			const callback = vi.fn();
			router = new Router({
				enableMetrics:     true,
				reportPerformance: callback,
			});
			const routes: RouteConfig[] = [ { path: '/', template: () => html`<div>Home</div>` } ];
			router.setRoutes(routes);

			await router.navigate('/');

			expect(callback).toHaveBeenCalledOnce();
			expect(callback).toHaveBeenCalledWith(expect.objectContaining({
				path:  '/',
				total: expect.any(Number),
			}));
		});

		it('should send beacon to analyticsEndpoint', async () => {
			router = new Router({
				enableMetrics:     true,
				analyticsEndpoint: 'https://analytics.example.com/track',
			});
			const routes: RouteConfig[] = [ { path: '/', template: () => html`<div>Home</div>` } ];
			router.setRoutes(routes);

			await router.navigate('/');

			expect(mockSendBeacon).toHaveBeenCalledOnce();
			expect(mockSendBeacon).toHaveBeenCalledWith(
				'https://analytics.example.com/track',
				expect.stringContaining('"type":"navigation"'),
			);

			// Verify beacon payload
			const payload = JSON.parse(mockSendBeacon.mock.calls[0]![1] as string);
			expect(payload).toMatchObject({
				type: 'navigation',
				path: '/',
			});
		});

		it('should not send beacon when analyticsEndpoint not configured', async () => {
			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [ { path: '/', template: () => html`<div>Home</div>` } ];
			router.setRoutes(routes);

			await router.navigate('/');

			expect(mockSendBeacon).not.toHaveBeenCalled();
		});
	});

	describe('Metrics API', () => {
		it('should return all timings with getTimings()', async () => {
			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [
				{ path: '/1', template: () => html`<div>1</div>` },
				{ path: '/2', template: () => html`<div>2</div>` },
			];
			router.setRoutes(routes);

			await router.navigate('/1');
			await router.navigate('/2');

			const timings = router.getTimings();
			expect(timings).toHaveLength(2);
			expect(timings[0]!.path).toBe('/1');
			expect(timings[1]!.path).toBe('/2');
		});

		it('should return most recent timing with getLastTiming()', async () => {
			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [
				{ path: '/1', template: () => html`<div>1</div>` },
				{ path: '/2', template: () => html`<div>2</div>` },
			];
			router.setRoutes(routes);

			await router.navigate('/1');
			await router.navigate('/2');

			const last = router.getLastTiming();
			expect(last).toBeDefined();
			expect(last!.path).toBe('/2');
		});

		it('should clear all timings with clearTimings()', async () => {
			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [ { path: '/', template: () => html`<div>Home</div>` } ];
			router.setRoutes(routes);

			await router.navigate('/');
			expect(router.getTimings()).toHaveLength(1);

			router.clearTimings();
			expect(router.getTimings()).toHaveLength(0);
		});

		it('should return undefined for getLastTiming() when empty', () => {
			router = new Router({ enableMetrics: true });
			expect(router.getLastTiming()).toBeUndefined();
		});
	});

	describe('Memory Management', () => {
		it('should not leak memory with many navigations', async () => {
			router = new Router({ enableMetrics: true, maxMetricsEntries: 10 });
			const routes: RouteConfig[] = Array.from({ length: 100 }, (_, i) => ({
				path:     `/route-${ i }`,
				template: () => html`<div>${ i }</div>`,
			}));
			router.setRoutes(routes);

			// Navigate 100 times
			for (let i = 0; i < 100; i++)
				await router.navigate(`/route-${ i }`);


			// Should only keep 10 most recent
			const timings = router.getTimings();
			expect(timings).toHaveLength(10);
		});
	});
});
