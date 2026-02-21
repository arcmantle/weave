import { html } from 'lit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RouteConfig } from '../router';
import { Router } from '../router';

describe('Router - Code Splitting Stats', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
		window.history.replaceState(null, '', '/');
	});

	describe('Stats Collection', () => {
		it('should track lazy route load time', async () => {
			const lazyFn = vi.fn().mockImplementation(async () => {
				await new Promise(resolve => setTimeout(resolve, 10));

				return [ { path: 'details', template: () => html`<div>Details</div>` } ];
			});

			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [
				{
					path:     '/products',
					lazy:     lazyFn,
					template: () => html`<div>Products</div>`, // Add template so route can match
				},
			];
			router.setRoutes(routes);

			await router.navigate('/products');

			// Wait for lazy loading to complete
			await new Promise(resolve => setTimeout(resolve, 50));

			const stats = router.getRouteStats();
			const productStats = stats.find(s => s.path === '/products');

			expect(productStats).toBeDefined();
			expect(productStats!.loadTime).toBeGreaterThan(0);
			expect(productStats!.cacheHit).toBe(false);
		});

		it('should track cache hits', async () => {
			const lazyFn = vi.fn().mockResolvedValue([ { path: 'details', template: () => html`<div>Details</div>` } ]);

			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [
				{
					path:     '/products',
					lazy:     lazyFn,
					template: () => html`<div>Products</div>`,
				},
				{ path: '/other', template: () => html`<div>Other</div>` },
			];
			router.setRoutes(routes);

			// First load
			await router.navigate('/products');
			await new Promise(resolve => setTimeout(resolve, 50));

			// Navigate away
			await router.navigate('/other');

			// Navigate back - should be cache hit
			await router.navigate('/products');
			await new Promise(resolve => setTimeout(resolve, 50));

			const stats = router.getRouteStats();
			const cacheHitStats = stats.filter(s => s.path === '/products' && s.cacheHit);
			expect(cacheHitStats).toHaveLength(1);
		});

		it('should track multiple route loads', async () => {
			const lazyFn1 = vi.fn().mockResolvedValue([]);
			const lazyFn2 = vi.fn().mockResolvedValue([]);

			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [
				{ path: '/products', lazy: lazyFn1 },
				{ path: '/users', lazy: lazyFn2 },
			];
			router.setRoutes(routes);

			await router.navigate('/products');
			await router.navigate('/users');

			const stats = router.getRouteStats();
			expect(stats).toHaveLength(2);
			expect(stats.map(s => s.path)).toContain('/products');
			expect(stats.map(s => s.path)).toContain('/users');
		});

		it('should include timestamp in stats', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			const before = Date.now();
			await router.navigate('/products');
			const after = Date.now();

			const stats = router.getStats('/products');
			expect(stats).toBeDefined();
			expect(stats!.timestamp).toBeGreaterThanOrEqual(before);
			expect(stats!.timestamp).toBeLessThanOrEqual(after);
		});
	});

	describe('LRU Cache Management', () => {
		it('should respect maxMetricsEntries limit', async () => {
			router = new Router({ enableMetrics: true, maxMetricsEntries: 3 });

			const routes: RouteConfig[] = [];
			for (let i = 0; i < 5; i++) {
				routes.push({
					path: `/route${ i }`,
					lazy: async () => [],
				});
			}
			router.setRoutes(routes);

			// Load all routes
			for (let i = 0; i < 5; i++)
				await router.navigate(`/route${ i }`);


			const stats = router.getRouteStats();
			expect(stats).toHaveLength(3);
			// Should keep most recent 3
			expect(stats.map(s => s.path).sort()).toEqual([ '/route2', '/route3', '/route4' ]);
		});

		it('should clear stats with clearStats()', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			await router.navigate('/products');
			expect(router.getRouteStats()).toHaveLength(1);

			router.clearStats();
			expect(router.getRouteStats()).toHaveLength(0);
		});
	});

	describe('Stats API', () => {
		it('should return all stats with getRouteStats()', async () => {
			const lazyFn1 = vi.fn().mockResolvedValue([]);
			const lazyFn2 = vi.fn().mockResolvedValue([]);

			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [
				{ path: '/products', lazy: lazyFn1 },
				{ path: '/users', lazy: lazyFn2 },
			];
			router.setRoutes(routes);

			await router.navigate('/products');
			await router.navigate('/users');

			const stats = router.getRouteStats();
			expect(stats).toHaveLength(2);
		});

		it('should return specific stats with getStats(path)', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			await router.navigate('/products');

			const stats = router.getStats('/products');
			expect(stats).toBeDefined();
			expect(stats!.path).toBe('/products');
		});

		it('should return undefined for non-existent stats', () => {
			router = new Router({ enableMetrics: true });
			expect(router.getStats('/nonexistent')).toBeUndefined();
		});

		it('should return aggregated stats with getAggregatedStats()', async () => {
			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [
				{ path: '/route1', lazy: async () => [], template: () => html`<div>R1</div>` },
				{ path: '/route2', lazy: async () => [], template: () => html`<div>R2</div>` },
				{ path: '/route3', lazy: async () => [], template: () => html`<div>R3</div>` },
			];
			router.setRoutes(routes);

			// Load routes
			await router.navigate('/route1');
			await new Promise(resolve => setTimeout(resolve, 10));
			await router.navigate('/route2');
			await new Promise(resolve => setTimeout(resolve, 10));
			await router.navigate('/route3');
			await new Promise(resolve => setTimeout(resolve, 10));

			// Navigate back to route1 for cache hit
			await router.navigate('/route1');
			await new Promise(resolve => setTimeout(resolve, 10));

			const aggregated = router.getAggregatedStats();
			expect(aggregated.totalLoads).toBe(4);
			expect(aggregated.cacheHits).toBe(1);
			expect(aggregated.averageLoadTime).toBeGreaterThanOrEqual(0);
		});

		it('should calculate correct average load time', async () => {
			router = new Router({ enableMetrics: true });

			// Mock specific load times
			const stats = (router as any).routeStats;
			stats.set('/route1', {
				path:      '/route1',
				loadTime:  100,
				cacheHit:  false,
				timestamp: Date.now(),
			});
			stats.set('/route2', {
				path:      '/route2',
				loadTime:  200,
				cacheHit:  false,
				timestamp: Date.now(),
			});
			stats.set('/route3', {
				path:      '/route3',
				loadTime:  0,
				cacheHit:  true,
				timestamp: Date.now(),
			});

			const aggregated = router.getAggregatedStats();
			expect(aggregated.averageLoadTime).toBe(150); // (100 + 200) / 2
		});

		it('should handle empty stats gracefully', () => {
			router = new Router({ enableMetrics: true });

			const aggregated = router.getAggregatedStats();
			expect(aggregated).toEqual({
				totalLoads:      0,
				cacheHits:       0,
				averageLoadTime: 0,
			});
		});
	});

	describe('Disabled Metrics', () => {
		it('should not track stats when metrics disabled', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			router = new Router({ enableMetrics: false });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			await router.navigate('/products');

			// Stats should be empty when metrics disabled
			const stats = router.getRouteStats();
			expect(stats).toHaveLength(0);
		});
	});

	describe('Integration with Prefetch', () => {
		it('should track prefetch stats separately from navigation', async () => {
			const lazyFn = vi.fn().mockResolvedValue([]);

			router = new Router({ enableMetrics: true });
			const routes: RouteConfig[] = [ { path: '/products', lazy: lazyFn } ];
			router.setRoutes(routes);

			// Preload
			await router.preload('/products');

			const stats = router.getRouteStats();
			const preloadStats = stats.find(s => s.path === '/products');

			expect(preloadStats).toBeDefined();
			expect(preloadStats!.cacheHit).toBe(false);

			// Navigate - should be cache hit
			await router.navigate('/products');

			const allStats = router.getRouteStats();
			const cacheHitStats = allStats.filter(s => s.path === '/products' && s.cacheHit);
			expect(cacheHitStats).toHaveLength(1);
		});
	});

	describe('Memory Management', () => {
		it('should not leak memory with many route loads', async () => {
			router = new Router({ enableMetrics: true, maxMetricsEntries: 10 });

			const routes: RouteConfig[] = [];
			for (let i = 0; i < 100; i++) {
				routes.push({
					path: `/route${ i }`,
					lazy: async () => [],
				});
			}
			router.setRoutes(routes);

			// Load 100 routes
			for (let i = 0; i < 100; i++)
				await router.navigate(`/route${ i }`);


			// Should only keep 10
			const stats = router.getRouteStats();
			expect(stats).toHaveLength(10);
		});
	});
});
