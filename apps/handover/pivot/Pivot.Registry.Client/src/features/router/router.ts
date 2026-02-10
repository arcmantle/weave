import { createContext } from '@lit/context';
import type { ReactiveController, ReactiveControllerHost, TemplateResult } from 'lit';


export type RouteTemplate = (params: Record<string, string>) => TemplateResult;
export type RouteLazy = () => Promise<RouteConfig[]>;
export type RouteGuard = (to: RouteMatch, from: RouteMatch | null) => boolean | Promise<boolean>;
export type RouteMetadata = Record<string, any>;
export interface RouteAnimation {
	enter?: (element: Element) => Promise<void> | void;
	exit?:  (element: Element) => Promise<void> | void;
}

// Navigation event types
export interface NavigationEvent {
	from:      RouteMatch | null;
	to:        RouteMatch;
	timestamp: number;
}

export interface NavigationErrorEvent extends NavigationEvent {
	error: Error;
}

export type NavigationListener = (event: NavigationEvent) => void;
export type NavigationErrorListener = (event: NavigationErrorEvent) => void;

// Context for dependency injection
export const routerContext: ReturnType<typeof createContext<Router>> = createContext<Router>(Symbol('router'));

export interface RouteConfig {
	path:           string;
	template?:      RouteTemplate;
	component?:     string;
	children?:      RouteConfig[];
	lazy?:          RouteLazy;
	name?:          string;
	redirect?:      string;
	beforeEnter?:   RouteGuard;
	canDeactivate?: RouteGuard;
	metadata?:      RouteMetadata;
	animation?:     RouteAnimation;
	errorBoundary?: ErrorBoundary; // Error boundary for this route
}

export interface RouteMatch {
	path:       string;
	params:     Record<string, string>;
	query:      URLSearchParams;
	hash:       string;
	template?:  RouteTemplate;
	component?: string;
	loading?:   boolean;
	error?:     Error;
	chain:      RouteMatch[];
	metadata?:  RouteMetadata;
	name?:      string;
	animation?: RouteAnimation;
}

export interface NavigationOptions {
	replace?:     boolean;
	query?:       Record<string, string>;
	hash?:        string;
	skipGuards?:  boolean;
	state?:       any;
	_retryCount?: number; // Internal: track retry attempts
}

export interface RouterConfig {
	basePath?:           string;
	scrollRestoration?:  boolean;
	useViewTransitions?: boolean;
	fallbackRoute?:      RouteConfig;
	// Enterprise features
	enableMetrics?:      boolean;        // Default: true
	reportPerformance?:  (timing: NavigationTiming) => void;
	analyticsEndpoint?:  string;         // Optional endpoint for sendBeacon
	maxMetricsEntries?:  number;         // Max LRU cache size (default 100)
	prefetch?:           PrefetchConfig; // Prefetch configuration
}

// Performance Metrics
export interface NavigationTiming {
	total:             number; // Total navigation time
	guards:            number; // Time spent in guards
	templateRender:    number; // Template rendering time
	animations:        number; // Animation/transition time
	scrollRestoration: number; // Scroll restoration time
	redirect:          number; // Redirect processing time
	path:              string; // Route path
	timestamp:         number; // When navigation occurred
}

// Code Splitting Statistics
export interface RouteStats {
	path:        string;  // Route path
	loadTime:    number;  // Time to load (ms)
	bundleSize?: number;  // Bundle size in bytes (if available)
	cacheHit:    boolean; // Whether loaded from cache
	timestamp:   number;  // When loaded
}

// Error Boundary
export interface ErrorBoundary {
	fallback:         RouteTemplate;                              // Error fallback template
	onError?:         (error: Error, match: RouteMatch) => void;  // Error callback
	maxRetries?:      number;                                     // Max retry attempts (default 3)
	retrySkipGuards?: boolean;                                    // Skip guards on retry (default false)
}

// Prefetch Configuration
export interface PrefetchConfig {
	strategy:   'hover' | 'visible' | 'idle' | 'manual'; // Prefetch strategy
	delay?:     number;                                  // Hover delay in ms (default 50)
	threshold?: number;                                  // Intersection observer threshold (default 0.1)
}

interface CompiledRoute extends RouteConfig {
	pattern:  URLPattern;
	fullPath: string;
	priority: number; // For sorting: exact > params > wildcards
}

// Simple trie node for route optimization
interface RouteNode {
	segment:        string;
	routes:         CompiledRoute[];
	children:       Map<string, RouteNode>;
	wildcardChild?: RouteNode;
	paramChild?:    RouteNode;
}

// LRU Cache for memory-efficient metric/stats storage
export class LRUCache<K, V> {

	private cache:   Map<K, V> = new Map();
	private maxSize: number;

	constructor(maxSize: number = 100) {
		this.maxSize = maxSize;
	}

	get(key: K): V | undefined {
		const value = this.cache.get(key);
		if (value !== undefined) {
			// Move to end (most recently used)
			this.cache.delete(key);
			this.cache.set(key, value);
		}

		return value;
	}

	set(key: K, value: V): void {
		// Delete if exists to re-insert at end
		if (this.cache.has(key))
			this.cache.delete(key);


		// Evict oldest if at capacity
		if (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey !== undefined)
				this.cache.delete(firstKey);
		}

		this.cache.set(key, value);
	}

	has(key: K): boolean {
		return this.cache.get(key) !== undefined;
	}

	clear(): void {
		this.cache.clear();
	}

	get size(): number {
		return this.cache.size;
	}

	values(): IterableIterator<V> {
		return this.cache.values();
	}

}

export class Router {

	private routes:             RouteConfig[] = [];
	private compiledRoutes:     CompiledRoute[] = [];
	private routeTree:          RouteNode;
	private namedRoutes:        Map<string, CompiledRoute> = new Map();
	private controllers:        Set<RouterController> = new Set();
	private baseUrl:            string;
	private basePath:           string = '';
	private lazyCache:          WeakMap<RouteConfig, RouteConfig[] | Promise<RouteConfig[]>> = new WeakMap();
	private currentMatch:       RouteMatch | null = null;
	private scrollPositions:    Map<string, { x: number; y: number; }> = new Map();
	private scrollRestoration:  boolean = true;
	private useViewTransitions: boolean = false;
	private redirectCount:      number = 0;
	private readonly MAX_REDIRECTS = 10;
	private fallbackRoute?:     RouteConfig;

	// Enterprise features
	private enableMetrics:      boolean = true;
	private reportPerformance?: (timing: NavigationTiming) => void;
	private analyticsEndpoint?: string;
	private timings:            LRUCache<string, NavigationTiming>;
	private routeStats:         LRUCache<string, RouteStats>;
	private prefetchConfig?:    PrefetchConfig;
	private prefetchCache:      WeakMap<RouteConfig, Promise<RouteConfig[]>> = new WeakMap();

	// Event listeners
	private beforeNavigateListeners: NavigationListener[] = [];
	private navigateStartListeners:  NavigationListener[] = [];
	private navigateEndListeners:    NavigationListener[] = [];
	private navigateErrorListeners:  NavigationErrorListener[] = [];

	constructor(config: RouterConfig = {}) {
		this.baseUrl = window.location.origin;
		this.basePath = config.basePath || '';
		this.scrollRestoration = config.scrollRestoration ?? true;
		this.useViewTransitions = config.useViewTransitions ?? false;
		this.fallbackRoute = config.fallbackRoute;
		this.routeTree = this.createNode('');

		// Enterprise features initialization
		this.enableMetrics = config.enableMetrics ?? true;
		this.reportPerformance = config.reportPerformance;
		this.analyticsEndpoint = config.analyticsEndpoint;
		this.timings = new LRUCache<string, NavigationTiming>(config.maxMetricsEntries ?? 100);
		this.routeStats = new LRUCache<string, RouteStats>(config.maxMetricsEntries ?? 100);
		this.prefetchConfig = config.prefetch;

		// Setup prefetching if configured
		if (this.prefetchConfig)
			this.setupPrefetching();


		// Intercept anchor clicks
		document.addEventListener('click', this.handleClick.bind(this));

		// Handle popstate for back/forward navigation
		window.addEventListener('popstate', this.handlePopState.bind(this));
	}

	private handleClick(e: MouseEvent): void {
		const anchor = (e.target as Element).closest('a');

		if (!anchor)
			return;

		// Don't intercept if modifier keys are pressed (allow native browser behavior)
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
			return;

		// Don't intercept if not left click
		if (e.button !== 0)
			return;

		if (anchor.target === '_blank')
			return;
		if (anchor.hasAttribute('download'))
			return;
		if (anchor.getAttribute('rel') === 'external')
			return;

		const href = anchor.getAttribute('href');
		if (!href)
			return;

		// Check if it's an external link
		if (href.startsWith('http') || href.startsWith('//'))
			return;

		// Prevent default and navigate
		e.preventDefault();
		this.navigate(href);
	}

	private handlePopState(): void {
		// Restore scroll position if enabled
		if (this.scrollRestoration) {
			const key = window.location.pathname;
			const pos = this.scrollPositions.get(key);
			if (pos)
				window.scrollTo(pos.x, pos.y);
		}

		this.notifyControllers();
	}

	setRoutes(routes: RouteConfig[]): void {
		this.routes = routes;
		this.compiledRoutes = this.compileRoutes(routes);
		this.buildNamedRoutesMap(this.compiledRoutes);
		this.buildRouteTree(this.compiledRoutes);
	}

	// Event listener methods
	onBeforeNavigate(listener: NavigationListener): () => void {
		this.beforeNavigateListeners.push(listener);

		return () => {
			const index = this.beforeNavigateListeners.indexOf(listener);
			if (index > -1)
				this.beforeNavigateListeners.splice(index, 1);
		};
	}

	onNavigateStart(listener: NavigationListener): () => void {
		this.navigateStartListeners.push(listener);

		return () => {
			const index = this.navigateStartListeners.indexOf(listener);
			if (index > -1)
				this.navigateStartListeners.splice(index, 1);
		};
	}

	onNavigateEnd(listener: NavigationListener): () => void {
		this.navigateEndListeners.push(listener);

		return () => {
			const index = this.navigateEndListeners.indexOf(listener);
			if (index > -1)
				this.navigateEndListeners.splice(index, 1);
		};
	}

	onNavigateError(listener: NavigationErrorListener): () => void {
		this.navigateErrorListeners.push(listener);

		return () => {
			const index = this.navigateErrorListeners.indexOf(listener);
			if (index > -1)
				this.navigateErrorListeners.splice(index, 1);
		};
	}

	private emitBeforeNavigate(event: NavigationEvent): void {
		this.beforeNavigateListeners.forEach(listener => listener(event));
	}

	private emitNavigateStart(event: NavigationEvent): void {
		this.navigateStartListeners.forEach(listener => listener(event));
	}

	private emitNavigateEnd(event: NavigationEvent): void {
		this.navigateEndListeners.forEach(listener => listener(event));
	}

	private emitNavigateError(event: NavigationErrorEvent): void {
		this.navigateErrorListeners.forEach(listener => listener(event));
	}

	private compileRoutes(routes: RouteConfig[], parentPath = ''): CompiledRoute[] {
		const compiled: CompiledRoute[] = [];

		for (const route of routes) {
			const fullPath = this.normalizePath(parentPath + route.path);
			const patternPath = this.basePath + fullPath;

			try {
				const pattern = new URLPattern({ pathname: patternPath });
				const priority = this.calculateRoutePriority(route.path);
				const compiledRoute: CompiledRoute = {
					...route,
					pattern,
					fullPath,
					priority,
				};

				compiled.push(compiledRoute);

				// Recursively compile children
				if (route.children) {
					const childRoutes = this.compileRoutes(route.children, fullPath);
					compiled.push(...childRoutes);
				}
			}
			catch (error) {
				console.error(`Failed to compile route pattern: ${ patternPath }`, error);
			}
		}

		// Sort by priority (higher priority first)
		return compiled.sort((a, b) => b.priority - a.priority);
	}

	private calculateRoutePriority(path: string): number {
		let priority = 0;
		const segments = path.split('/').filter(Boolean);

		for (const segment of segments) {
			if (segment === '*' || segment === '**') {
				// Wildcard gets lowest priority
				priority += 1;
			}
			else if (segment.startsWith(':')) {
				// Parameter gets medium priority
				priority += 10;
			}
			else {
				// Exact match gets highest priority
				priority += 100;
			}
		}

		return priority;
	}

	private createNode(segment: string): RouteNode {
		return {
			segment,
			routes:   [],
			children: new Map(),
		};
	}

	private buildRouteTree(routes: CompiledRoute[]): void {
		this.routeTree = this.createNode('');

		for (const route of routes) {
			const segments = route.fullPath.split('/').filter(Boolean);
			let currentNode = this.routeTree;

			for (const segment of segments) {
				if (segment === '*' || segment === '**') {
					// Wildcard segment
					if (!currentNode.wildcardChild)
						currentNode.wildcardChild = this.createNode(segment);

					currentNode = currentNode.wildcardChild;
				}
				else if (segment.startsWith(':')) {
					// Parameter segment
					if (!currentNode.paramChild)
						currentNode.paramChild = this.createNode(segment);

					currentNode = currentNode.paramChild;
				}
				else {
					// Exact match segment
					if (!currentNode.children.has(segment))
						currentNode.children.set(segment, this.createNode(segment));

					currentNode = currentNode.children.get(segment)!;
				}
			}

			currentNode.routes.push(route);
		}
	}

	private buildNamedRoutesMap(routes: CompiledRoute[]): void {
		this.namedRoutes.clear();
		for (const route of routes) {
			if (route.name)
				this.namedRoutes.set(route.name, route);
		}
	}

	private normalizePath(path: string): string {
		// Ensure path starts with / and doesn't end with / (unless it's root)
		path = path.startsWith('/') ? path : '/' + path;

		return path === '/' ? path : path.replace(/\/$/, '');
	}

	async navigate(path: string, options: NavigationOptions = {}): Promise<boolean> {
		const timestamp = Date.now();
		const navStart = performance.now();
		let guardsTime = 0;
		let renderTime = 0;
		let animationTime = 0;
		let scrollTime = 0;
		let redirectTime = 0;

		try {
			// Save current scroll position
			if (this.scrollRestoration && this.currentMatch) {
				this.scrollPositions.set(this.currentMatch.path, {
					x: window.scrollX,
					y: window.scrollY,
				});
			}

			// Build full URL
			let url: URL;
			try {
				url = new URL(path, this.baseUrl);
			}
			catch {
				url = new URL(this.baseUrl + this.basePath + path);
			}

			// Add query params if provided
			if (options.query) {
				Object.entries(options.query).forEach(([ key, value ]) => {
					url.searchParams.set(key, value);
				});
			}

			// Add hash if provided
			if (options.hash)
				url.hash = options.hash;


			// Get the match for the new path
			let nextMatch = this.matchURL(url);

			if (!nextMatch && this.fallbackRoute) {
				// Use fallback route for 404
				const fallbackUrl = new URL(this.basePath + this.fallbackRoute.path, this.baseUrl);
				nextMatch = this.matchURL(fallbackUrl);
			}

			if (!nextMatch) {
				console.warn(`No route found for ${ url.pathname }`);

				return false;
			}

			// Emit beforeNavigate event
			const navEvent: NavigationEvent = {
				from: this.currentMatch,
				to:   nextMatch,
				timestamp,
			};
			this.emitBeforeNavigate(navEvent);

			// Check canDeactivate guard on current route
			const guardStart = performance.now();
			if (!options.skipGuards && this.currentMatch) {
				const currentRoute = this.findRouteByPath(this.currentMatch.path);
				if (currentRoute?.canDeactivate) {
					const canLeave = await currentRoute.canDeactivate(nextMatch, this.currentMatch);
					if (!canLeave)
						return false;
				}
			}

			// Check beforeEnter guard on next route
			if (!options.skipGuards) {
				const nextRoute = this.findRouteByPath(nextMatch.path);
				if (nextRoute?.beforeEnter) {
					const canEnter = await nextRoute.beforeEnter(nextMatch, this.currentMatch);
					if (!canEnter)
						return false;
				}
			}

			guardsTime = performance.now() - guardStart;

			// Handle redirects
			const nextRoute = this.findRouteByPath(nextMatch.path);
			if (nextRoute?.redirect) {
				const redirectStart = performance.now();
				this.redirectCount++;
				if (this.redirectCount > this.MAX_REDIRECTS) {
					console.error('Maximum redirect limit reached');
					this.redirectCount = 0;

					return false;
				}

				const result = await this.navigate(nextRoute.redirect, { ...options, replace: true });
				redirectTime = performance.now() - redirectStart;

				return result;
			}

			this.redirectCount = 0;

			// Emit navigateStart event
			this.emitNavigateStart(navEvent);

			// Perform navigation with View Transitions API if enabled
			const doNavigation = async () => {
				const renderStart = performance.now();

				// Update history
				const fullUrl = url.pathname + url.search + url.hash;
				if (options.replace)
					window.history.replaceState(options.state || null, '', fullUrl);

				else
					window.history.pushState(options.state || null, '', fullUrl);

				// Handle exit animation
				const animStart = performance.now();
				if (this.currentMatch) {
					const currentRoute = this.findRouteByPath(this.currentMatch.path);
					if (currentRoute?.animation?.exit) {
						const elements = document.querySelectorAll('[data-route-element]');
						await Promise.all(
							Array.from(elements).map(el => currentRoute.animation!.exit!(el)),
						);
					}
				}

				this.currentMatch = nextMatch;

				// Handle enter animation
				if (nextRoute?.animation?.enter) {
					// Wait for next frame to ensure element is rendered
					await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
					const elements = document.querySelectorAll('[data-route-element]');
					await Promise.all(
						Array.from(elements).map(el => nextRoute.animation!.enter!(el)),
					);
				}

				animationTime = performance.now() - animStart;
				renderTime = performance.now() - renderStart - animationTime;

				// Scroll to top or hash
				const scrollStart = performance.now();
				if (this.scrollRestoration) {
					if (url.hash) {
						// Try to scroll to hash element
						const el = document.getElementById(url.hash.slice(1));
						if (el)
							el.scrollIntoView({ behavior: 'smooth' });
					}
					else if (!options.replace) {
						// Scroll to top on new navigation
						window.scrollTo(0, 0);
					}
				}

				scrollTime = performance.now() - scrollStart;

				this.notifyControllers();
			};

			// Use View Transitions API if available and enabled
			if (this.useViewTransitions && 'startViewTransition' in document) {
				const docWithTransition = document as Document & {
					startViewTransition: (callback: () => Promise<void>) => { finished: Promise<void>; };
				};
				await docWithTransition.startViewTransition(doNavigation).finished;
			}
			else {
				await doNavigation();
			}

			// Record metrics
			if (this.enableMetrics) {
				const totalTime = performance.now() - navStart;
				const timing: NavigationTiming = {
					total:             totalTime,
					guards:            guardsTime,
					templateRender:    renderTime,
					animations:        animationTime,
					scrollRestoration: scrollTime,
					redirect:          redirectTime,
					path:              nextMatch!.path,
					timestamp,
				};

				this.timings.set(nextMatch!.path, timing);

				// Report to callback if provided
				if (this.reportPerformance)
					this.reportPerformance(timing);


				// Send to analytics endpoint if configured
				if (this.analyticsEndpoint && 'sendBeacon' in navigator) {
					const beacon = JSON.stringify({ type: 'navigation', ...timing });
					navigator.sendBeacon(this.analyticsEndpoint, beacon);
				}
			}

			// Emit navigateEnd event
			this.emitNavigateEnd(navEvent);

			return true;
		}
		catch (error) {
			// Try error boundaries with cascading
			const handled = await this.handleRouteError(error as Error, path, options);
			if (handled)
				return true;

			// Emit error event
			const errorEvent: NavigationErrorEvent = {
				from:  this.currentMatch,
				to:    { path, params: {}, query: new URLSearchParams(), hash: '', chain: [] } as RouteMatch,
				timestamp,
				error: error as Error,
			};
			this.emitNavigateError(errorEvent);
			throw error;
		}
	}

	navigateByName(name: string, options: NavigationOptions = {}): Promise<boolean> {
		const route = this.namedRoutes.get(name);
		if (!route) {
			console.warn(`No route found with name: ${ name }`);

			return Promise.resolve(false);
		}

		return this.navigate(route.fullPath, options);
	}

	private findRouteByPath(path: string): CompiledRoute | undefined {
		return this.compiledRoutes.find(r => r.fullPath === path);
	}

	match(path?: string): RouteMatch | null {
		if (path) {
			const url = new URL(path, this.baseUrl);

			return this.matchURL(url);
		}

		const url = new URL(window.location.href);

		return this.matchURL(url);
	}

	matchAtDepth(depth: number, path?: string): RouteMatch | null {
		const match = this.match(path);
		if (!match)
			return null;

		return match.chain[depth] || null;
	}

	private matchURL(url: URL): RouteMatch | null {
		const pathname = this.stripBasePath(url.pathname);
		const chain: RouteMatch[] = [];

		// Try to match against all compiled routes (already sorted by priority)
		for (const compiledRoute of this.compiledRoutes) {
			const result = compiledRoute.pattern.exec(url);

			if (result) {
				// Extract params from URLPattern groups
				const params: Record<string, string> = {};
				if (result.pathname.groups)
					Object.assign(params, result.pathname.groups);


				const routeMatch: RouteMatch = {
					path:      compiledRoute.fullPath,
					params,
					query:     url.searchParams,
					hash:      url.hash,
					template:  compiledRoute.template,
					component: compiledRoute.component,
					name:      compiledRoute.name,
					metadata:  compiledRoute.metadata,
					animation: compiledRoute.animation,
					chain:     [],
				};

				// Build the chain for nested routes
				this.buildChain(chain, routeMatch, pathname);
				routeMatch.chain = chain;

				// Handle lazy loading
				if (compiledRoute.lazy) {
					const cached = this.lazyCache.get(compiledRoute);

					// Check if children are already compiled
					const hasChildren = this.hasMatchingChildRoute(pathname, compiledRoute);

					// If we have a cached value (not a Promise), track the cache hit and continue
					if (cached && !(cached instanceof Promise)) {
						if (this.enableMetrics) {
							const timestamp = Date.now();
							this.routeStats.set(`${ timestamp }:${ compiledRoute.path }`, {
								path:     compiledRoute.path,
								loadTime: 0,
								cacheHit: true,
								timestamp,
							});
						}

						return routeMatch;
					}

					// If we have matching children but no cache, just return (children already compiled)
					if (hasChildren)
						return routeMatch;

					// If cached Promise, wait for it
					if (cached instanceof Promise) {
						cached.then(() => this.notifyControllers()).catch(() => this.notifyControllers());
						routeMatch.loading = true;

						return routeMatch;
					}

					// Not cached - start loading
					const loadStart = performance.now();
					const loadPromise = compiledRoute.lazy().then(children => {
						const loadTime = performance.now() - loadStart;

						this.lazyCache.set(compiledRoute, children);

						// Track stats if enabled
						if (this.enableMetrics) {
							const timestamp = Date.now();
							this.routeStats.set(`${ timestamp }:${ compiledRoute.path }`, {
								path:     compiledRoute.path,
								loadTime,
								cacheHit: false,
								timestamp,
							});
						}

						// Recompile routes with new children
						const newCompiled = this.compileRoutes(children, compiledRoute.fullPath);
						this.compiledRoutes.push(...newCompiled);
						this.buildNamedRoutesMap(this.compiledRoutes);
						this.buildRouteTree(this.compiledRoutes);

						return children;
					}).catch(error => {
						this.lazyCache.delete(compiledRoute);
						throw error;
					});

					this.lazyCache.set(compiledRoute, loadPromise);
					loadPromise.then(() => this.notifyControllers()).catch(() => this.notifyControllers());
					routeMatch.loading = true;

					return routeMatch;
				}

				return routeMatch;
			}
		}

		return null;
	}

	private hasMatchingChildRoute(pathname: string, route: CompiledRoute): boolean {
		return this.compiledRoutes.some(r =>
			r.fullPath.startsWith(route.fullPath) && r.fullPath !== route.fullPath);
	}

	private buildChain(chain: RouteMatch[], match: RouteMatch, pathname: string): void {
		// Add the current match to the chain
		chain.push(match);
	}

	private stripBasePath(pathname: string): string {
		if (!this.basePath)
			return pathname;

		if (pathname.startsWith(this.basePath))
			return pathname.slice(this.basePath.length) || '/';

		return pathname;
	}

	getCurrentPath(): string {
		return window.location.pathname;
	}

	addController(controller: RouterController): void {
		this.controllers.add(controller);
	}

	removeController(controller: RouterController): void {
		this.controllers.delete(controller);
	}

	private notifyControllers(): void {
		this.controllers.forEach(controller => controller.routeChanged());
	}

	// Enterprise Features - Prefetching
	private setupPrefetching(): void {
		if (!this.prefetchConfig)
			return;

		const { strategy, delay = 50, threshold = 0.1 } = this.prefetchConfig;

		if (strategy === 'hover') {
			// Prefetch on link hover
			document.addEventListener('mouseover', (e) => {
				const link = (e.target as HTMLElement).closest('a');
				if (!link || !link.href)
					return;

				const url = new URL(link.href);
				if (url.origin !== window.location.origin)
					return;

				// Debounce hover
				setTimeout(() => {
					this.preload(url.pathname).catch(() => {});
				}, delay);
			}, { passive: true });
		}
		else if (strategy === 'visible') {
			// Prefetch when link becomes visible
			const observer = new IntersectionObserver((entries) => {
				entries.forEach(entry => {
					if (entry.isIntersecting) {
						const link = entry.target as HTMLAnchorElement;
						if (!link.href)
							return;

						const url = new URL(link.href);
						if (url.origin === window.location.origin)
							this.preload(url.pathname).catch(() => {});
					}
				});
			}, { threshold });

			// Observe all links
			const observeLinks = () => {
				document.querySelectorAll('a[href]').forEach(link => {
					observer.observe(link);
				});
			};

			observeLinks();
			// Re-observe on DOM changes
			const mutationObserver = new MutationObserver(observeLinks);
			mutationObserver.observe(document.body, { childList: true, subtree: true });
		}
		else if (strategy === 'idle') {
			// Prefetch during idle time
			if ('requestIdleCallback' in window) {
				const idleCallback = () => {
					this.preloadAll().catch(() => {});
				};
				(window as any).requestIdleCallback(idleCallback, { timeout: 2000 });
			}
			else {
				// Fallback to setTimeout
				setTimeout(() => this.preloadAll().catch(() => {}), 1000);
			}
		}
		// 'manual' strategy: user calls preload() explicitly
	}

	async preload(path: string): Promise<void> {
		const url = new URL(path, this.baseUrl);
		const match = this.matchURL(url);
		if (!match)
			return;

		// Find lazy routes in the match chain
		for (const routeMatch of match.chain) {
			const route = this.findRouteByPath(routeMatch.path);
			if (!route)
				continue;

			if (route.lazy && !this.lazyCache.has(route)) {
				// Load lazy route
				const loadStart = performance.now();
				const cacheHit = this.prefetchCache.has(route);

				try {
					if (cacheHit) {
						// Reuse prefetch cache
						const children = await this.prefetchCache.get(route)!;
						this.lazyCache.set(route, children);
					}
					else {
						// Load and cache
						const loadPromise = route.lazy();
						this.prefetchCache.set(route, loadPromise);

						const children = await loadPromise;
						this.lazyCache.set(route, children);

						// Track stats
						const loadTime = performance.now() - loadStart;
						this.routeStats.set(route.path, {
							path:      route.path,
							loadTime,
							cacheHit:  false,
							timestamp: Date.now(),
						});
					}

					// Recompile with loaded children
					const children = this.lazyCache.get(route);
					if (Array.isArray(children)) {
						const newCompiled = this.compileRoutes(children, route.path);
						this.compiledRoutes.push(...newCompiled);
						this.buildNamedRoutesMap(this.compiledRoutes);
						this.buildRouteTree(this.compiledRoutes);
					}
				}
				catch (error) {
					console.warn(`Failed to preload route ${ route.path }:`, error);
				}
			}
		}
	}

	async preloadAll(): Promise<void> {
		const lazyRoutes = this.compiledRoutes.filter(r => r.lazy);
		await Promise.all(lazyRoutes.map(r => this.preload(r.fullPath)));
	}

	// Enterprise Features - Error Boundaries
	private async handleRouteError(error: Error, path: string, options: NavigationOptions): Promise<boolean> {
		// Get the failed route
		const url = new URL(path, this.baseUrl);
		const failedMatch = this.matchURL(url);
		if (!failedMatch)
			return false;

		// Search up the route chain for error boundary
		const errorBoundary = this.findErrorBoundary(failedMatch.chain);
		if (!errorBoundary)
			return false;

		// Call error callback if provided
		if (errorBoundary.onError)
			errorBoundary.onError(error, failedMatch);


		// Check if we should retry
		const retryCount = options._retryCount ?? 0;
		const maxRetries = errorBoundary.maxRetries ?? 3;

		if (retryCount < maxRetries) {
			// Retry with incremented count
			const retryOptions: NavigationOptions = {
				...options,
				_retryCount: retryCount + 1,
			};

			// Skip guards on retry if configured
			if (errorBoundary.retrySkipGuards)
				retryOptions.skipGuards = true;


			try {
				return await this.navigate(path, retryOptions);
			}
			catch {
				// Retry failed, continue to fallback
			}
		}

		// Render error boundary fallback
		const errorMatch: RouteMatch = {
			...failedMatch,
			template: errorBoundary.fallback,
			error,
		};

		this.currentMatch = errorMatch;
		this.notifyControllers();

		return true;
	}

	private findErrorBoundary(chain: RouteMatch[]): ErrorBoundary | undefined {
		// Search from innermost (current) to outermost (root)
		for (let i = chain.length - 1; i >= 0; i--) {
			const match = chain[i]!;
			const route = this.findRouteByPath(match.path);
			if (route?.errorBoundary)
				return route.errorBoundary;
		}

		return undefined;
	}

	// Enterprise Features - Performance Metrics
	getTimings(): NavigationTiming[] {
		return Array.from(this.timings.values());
	}

	getLastTiming(): NavigationTiming | undefined {
		const all = Array.from(this.timings.values());

		return all[all.length - 1];
	}

	clearTimings(): void {
		this.timings.clear();
	}

	// Enterprise Features - Code Splitting Stats
	getRouteStats(): RouteStats[] {
		return Array.from(this.routeStats.values());
	}

	getStats(path: string): RouteStats | undefined {
		// Find most recent stats for this path
		return Array.from(this.routeStats.values())
			.filter(s => s.path === path)
			.sort((a, b) => b.timestamp - a.timestamp)[0];
	}

	clearStats(): void {
		this.routeStats.clear();
	}

	// Get aggregated stats
	getAggregatedStats(): { totalLoads: number; cacheHits: number; averageLoadTime: number; } {
		const stats = this.getRouteStats();
		const totalLoads = stats.length;
		const cacheHits = stats.filter(s => s.cacheHit).length;
		const loadTimes = stats.filter(s => !s.cacheHit).map(s => s.loadTime);
		const averageLoadTime = loadTimes.length > 0
			? loadTimes.reduce((sum, t) => sum + t, 0) / loadTimes.length
			: 0;

		return { totalLoads, cacheHits, averageLoadTime };
	}

}

export class RouterController implements ReactiveController {

	private host:   ReactiveControllerHost;
	private router: Router;
	private depth:  number;

	constructor(host: ReactiveControllerHost, router: Router, depth = 0) {
		this.host = host;
		this.router = router;
		this.depth = depth;
		host.addController(this);
	}

	hostConnected(): void {
		this.router.addController(this);
	}

	hostDisconnected(): void {
		this.router.removeController(this);
	}

	routeChanged(): void {
		this.host.requestUpdate();
	}

	navigate(path: string, options?: NavigationOptions): Promise<boolean> {
		return this.router.navigate(path, options);
	}

	navigateByName(name: string, options?: NavigationOptions): Promise<boolean> {
		return this.router.navigateByName(name, options);
	}

	match(path?: string): RouteMatch | null {
		return this.router.matchAtDepth(this.depth, path);
	}

	getCurrentPath(): string {
		return this.router.getCurrentPath();
	}

	getDepth(): number {
		return this.depth;
	}

}

// Global router instance
export const router: Router = new Router();
