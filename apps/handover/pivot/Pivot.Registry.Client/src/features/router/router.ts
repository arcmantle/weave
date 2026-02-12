import { createContext } from '@lit/context';
import type { ReactiveController, ReactiveControllerHost, TemplateResult } from 'lit';

import { BrowserHistoryAdapter, type HistoryAdapter } from './history-adapter.ts';


/**
 * A function that renders a route's template given matched URL parameters.
 * @param params - URL parameters extracted from the route path (e.g., `{ id: '123' }` from `/users/:id`)
 * @returns A Lit TemplateResult to render
 */
export type RouteTemplate = (params: Record<string, string>) => TemplateResult;

/**
 * Strips URLPattern modifiers (`?`, `+`, `*`) from a param name.
 * E.g., `'name?'` → `'name'`, `'id'` → `'id'`.
 */
type StripModifier<S extends string> =
	S extends `${ infer Name }?` | `${ infer Name }+` | `${ infer Name }*`
		? Name
		: S;

/** Returns `true` if the raw param has a `?` modifier. */
type IsOptional<S extends string> = S extends `${ string }?` ? true : false;

/**
 * Extracts raw (unstripped) param segments from a URLPattern path string.
 *
 * @example
 * ```typescript
 * type A = ExtractRawParams<'/explore/:name?'>;             // 'name?'
 * type B = ExtractRawParams<'/users/:id/posts/:postId?'>;   // 'id' | 'postId?'
 * ```
 */
type ExtractRawParams<P extends string> =
	P extends `${ string }:${ infer Param }/${ infer Rest }`
		? Param | ExtractRawParams<Rest>
		: P extends `${ string }:${ infer Param }`
			? Param
			: never;

/** Extracts only the required (non-`?`) param keys from a path. */
type RequiredParamKeys<P extends string> = {
	[K in ExtractRawParams<P>]: IsOptional<K> extends true ? never : K;
}[ExtractRawParams<P>];

/** Extracts only the optional (`?`-suffixed) param keys from a path, stripped of the modifier. */
type OptionalParamKeys<P extends string> = {
	[K in ExtractRawParams<P>]: IsOptional<K> extends true ? StripModifier<K> : never;
}[ExtractRawParams<P>];

/**
 * Maps a URLPattern path string to a typed params object.
 *
 * - Required params (`:id`) produce `{ id: string }`.
 * - Optional params (`:name?`) produce `{ name?: string | undefined }`.
 * - Paths without named parameters fall back to `Record<string, string>`.
 * - Non-literal `string` paths fall back to `Record<string, string>`.
 *
 * The intersection with `Record<string, string>` ensures bracket-access
 * always works as a fallback, even for keys not extracted from the path.
 *
 * @example
 * ```typescript
 * type A = ExtractRouteParams<'/plugin/:name'>;              // { name: string } & Record<string, string>
 * type B = ExtractRouteParams<'/explore/:name?'>;            // { name?: string | undefined } & Record<string, string>
 * type C = ExtractRouteParams<'/users/:id/posts/:postId?'>;  // { id: string; postId?: string | undefined } & Record<string, string>
 * type D = ExtractRouteParams<'/about'>;                     // Record<string, string>
 * ```
 */
export type ExtractRouteParams<P extends string> =
	string extends P
		? Record<string, string>
		: [ExtractRawParams<P>] extends [never]
			? Record<string, string>
			: { [K in RequiredParamKeys<P>]: string }
				& { [K in OptionalParamKeys<P>]?: string | undefined }
				& Record<string, string>;

/**
 * A function that dynamically loads child routes (code splitting).
 * The result is cached using a WeakMap keyed on the route config object.
 * @returns Promise resolving to an array of child route configurations
 */
export type RouteLazy = () => Promise<RouteConfig[]>;

/**
 * A navigation guard that determines whether navigation should proceed.
 * Return `true` to allow navigation, `false` to block it.
 * For redirects, call `router.navigate()` manually and return `false`.
 * @param to - The route being navigated to
 * @param from - The route being navigated from (null if no previous route)
 * @returns Boolean or Promise<boolean> indicating whether navigation should proceed
 */
export type RouteGuard = (to: RouteMatch, from: RouteMatch | null) => boolean | Promise<boolean>;

/**
 * Arbitrary metadata that can be attached to a route.
 * Useful for storing things like page titles, breadcrumbs, permissions, etc.
 */
export type RouteMetadata = Record<string, any>;

/**
 * Animation callbacks for route transitions.
 * Elements must have the `data-route-element` attribute to be targeted.
 */
export interface RouteAnimation {
	/** Animation to play when entering this route */
	enter?: (element: Element) => Promise<void> | void;
	/** Animation to play when exiting this route */
	exit?:  (element: Element) => Promise<void> | void;
}

/**
 * Minimal representation of the browser ViewTransition object.
 * Used to avoid depending on a global TS lib that may not include it.
 */
export interface ViewTransitionObject {
	/** Fulfills once the pseudo-element tree is created and the animation is about to start. */
	ready:              Promise<void>;
	/** Fulfills once the transition animation is finished. */
	finished:           Promise<void>;
	/** Fulfills when the update callback has completed. */
	updateCallbackDone: Promise<void>;
	/** Skips the animation but still runs the update callback. */
	skipTransition():   void;
}

/**
 * Configuration for View Transitions API integration.
 *
 * The View Transitions API captures snapshots of named elements before and
 * after a DOM update, then creates a smooth animated transition between them.
 *
 * When view transitions are enabled for a route, only the actual DOM update
 * (setting the current match and notifying controllers) is wrapped inside
 * `document.startViewTransition()`.  History changes, guards, scroll
 * restoration, and lifecycle events all happen outside the transition
 * callback.
 *
 * @example
 * ```typescript
 * // Basic — default cross-fade transition
 * { path: '/browse', viewTransition: true }
 *
 * // With types — for CSS :active-view-transition-type() matching
 * { path: '/browse', viewTransition: { types: ['slide'] } }
 *
 * // Custom JS animation via onReady
 * {
 *   path: '/details/:id',
 *   viewTransition: {
 *     types: ['zoom'],
 *     onReady(transition) {
 *       document.documentElement.animate(
 *         { clipPath: ['circle(0%)', 'circle(100%)'] },
 *         { duration: 400, pseudoElement: '::view-transition-new(root)' },
 *       );
 *     },
 *   },
 * }
 * ```
 */
export interface ViewTransitionConfig {
	/**
	 * Transition type strings applied to the `ViewTransition`.
	 * Use with the CSS `:active-view-transition-type()` pseudo-class
	 * to conditionally apply different animations.
	 *
	 * @example `['slide']`, `['forwards']`, `['backwards', 'slide']`
	 */
	types?: string[];

	/**
	 * Callback invoked when the ViewTransition `ready` promise resolves.
	 * At this point the pseudo-element tree is created and the animation
	 * is about to start — use this for custom JavaScript-driven
	 * animations (e.g. clip-path reveals).
	 */
	onReady?: (transition: ViewTransitionObject) => void;
}

/**
 * Event emitted during navigation lifecycle.
 * Listen via onBeforeNavigateStart, onAfterNavigateStart, onBeforeNavigateEnd, onAfterNavigateEnd.
 */
export interface NavigationEvent {
	/** The route being navigated from (null if no previous route) */
	from:      RouteMatch | null;
	/** The route being navigated to */
	to:        RouteMatch;
	/** Timestamp when navigation started (from Date.now()) */
	timestamp: number;
}

/**
 * Event emitted when navigation fails.
 * Listen via onNavigateError.
 */
export interface NavigationErrorEvent extends NavigationEvent {
	/** The error that occurred during navigation */
	error: Error;
}

/**
 * Listener function for navigation lifecycle events.
 * Return false or Promise<false> to block navigation from continuing.
 * Return true, void, or undefined to allow navigation to proceed.
 */
export type NavigationListener = (event: NavigationEvent) => boolean | Promise<boolean> | void;

/** Listener function for navigation error events */
export type NavigationErrorListener = (event: NavigationErrorEvent) => void;

/**
 * Lit Context for dependency injection.
 * Used by <router-outlet> and <router-link> to consume the nearest router instance.
 */
export const routerContext: ReturnType<typeof createContext<Router>>
	= createContext<Router>(Symbol('router'));

/**
 * Properties of RouteConfig that can be inherited via `reuseFrom`.
 * Derived from RouteConfig, excluding identity fields (`path`, `name`) and `reuseFrom` itself.
 */
export type InheritableRouteProperty = Exclude<keyof RouteConfig, 'path' | 'name' | 'reuseFrom'>;

/** Keys that are never inherited — identity keys plus compiled-only internals. */
const NON_INHERITABLE_KEYS: ReadonlySet<string> = new Set<keyof CompiledRoute>([
	'path',
	'name',
	'reuseFrom',
	// CompiledRoute-only keys — never part of the public RouteConfig surface.
	'pattern',
	'fullPath',
	'priority',
	'parentRoute',
]);

/**
 * Explicit configuration for `reuseFrom`.
 * Lets you pick exactly which properties to inherit from the source route.
 */
export interface RouteReuseConfig {
	/** Name of the route to inherit from. */
	name:       string;
	/** Properties to inherit from the source route. */
	properties: InheritableRouteProperty[];
}

/**
 * Configuration for a single route.
 * At minimum, provide `path` and either `template`, `component`, or `redirect`.
 */
export interface RouteConfig {
	/** URLPattern path string (e.g., '/', '/users/:id', '/files/*') */
	path:            string;
	/** Function that returns a Lit template to render (receives matched params) */
	template?:       RouteTemplate;
	/** Custom element tag name to create (alternative to template) */
	component?:      string;
	/** Static nested child routes */
	children?:       RouteConfig[];
	/** Function to dynamically load child routes (for code splitting) */
	lazy?:           RouteLazy;
	/** Unique name for this route (used with navigateByName) */
	name?:           string;
	/** Path to redirect to (uses history.replace to avoid polluting back stack) */
	redirect?:       string;
	/** Guard that runs before entering this route (return false to block navigation) */
	beforeEnter?:    RouteGuard;
	/** Guard that runs before leaving this route (return false to block navigation) */
	canDeactivate?:  RouteGuard;
	/** Arbitrary metadata attached to this route */
	metadata?:       RouteMetadata;
	/** Enter/exit animations for this route */
	animation?:      RouteAnimation;
	/**
	 * View Transitions API configuration for this route.
	 *
	 * - `true`  — enable default cross-fade transition.
	 * - `false` — explicitly disable (overrides router-level default).
	 * - `ViewTransitionConfig` — enable with custom types / onReady.
	 * - `undefined` — inherit the router-level default.
	 */
	viewTransition?: boolean | ViewTransitionConfig;
	/** Error boundary configuration for handling navigation errors */
	errorBoundary?:  ErrorBoundary;
	/**
	 * Inherit properties from another named route.
	 *
	 * - **String** — inherits all inheritable properties that are not explicitly
	 *   set on this route (template, component, children, lazy, redirect,
	 *   beforeEnter, canDeactivate, metadata, animation, errorBoundary).
	 * - **Object** — inherits only the listed properties from the named route.
	 * - **Array** — inherits listed properties from multiple named routes.
	 *   Earlier entries take precedence (first-write-wins).
	 *
	 * In all forms, a property that is already defined on this route is never
	 * overwritten.
	 *
	 * @example
	 * ```typescript
	 * // String shorthand — inherit everything not set locally
	 * { path: '/explore',     name: 'explore', template: fn, beforeEnter: guard },
	 * { path: '/explore/:id', reuseFrom: 'explore' },
	 *
	 * // Object form — inherit only specific properties
	 * { path: '/explore/:id', reuseFrom: { name: 'explore', properties: ['template'] } },
	 *
	 * // Array form — inherit different properties from different routes
	 * { path: '/combo', reuseFrom: [
	 *   { name: 'explore',   properties: ['template'] },
	 *   { name: 'dashboard', properties: ['beforeEnter', 'errorBoundary'] },
	 * ]},
	 * ```
	 */
	reuseFrom?:      string | RouteReuseConfig | RouteReuseConfig[];
}

/**
 * Define a route with type-safe template params inferred from the path.
 *
 * When the path contains named parameters (e.g., `/users/:id`), the
 * template function receives a narrowed params object with known keys
 * and `string` values — enabling dot-access, autocomplete, and typo
 * detection.
 *
 * Routes without named parameters fall back to `Record<string, string>`,
 * behaving identically to plain `RouteConfig` objects.
 *
 * @example
 * ```typescript
 * // Params inferred as { name: string } — dot-access works, typos caught.
 * defineRoute({
 *   path:     '/plugin/:name',
 *   template: (params) => html`<plugin-detail .name=${params.name}></plugin-detail>`,
 * })
 *
 * // Multiple params — { id: string; tab: string }
 * defineRoute({
 *   path:     '/users/:id/:tab',
 *   template: (params) => html`<user-page .id=${params.id} .tab=${params.tab}></user-page>`,
 * })
 * ```
 */
export function defineRoute<const P extends string>(
	config: { path: P; template?: (params: ExtractRouteParams<P>) => TemplateResult; }
		& Omit<RouteConfig, 'path' | 'template'>,
): RouteConfig {
	return config as RouteConfig;
}

export interface RouteMatch {
	/** The matched path */
	path:            string;
	/** URL parameters extracted from the path (e.g., { id: '123' } from /users/:id) */
	params:          Record<string, string>;
	/** Parsed query string parameters */
	query:           URLSearchParams;
	/** URL hash fragment (without the #) */
	hash:            string;
	/** Template function to render (if route uses template) */
	template?:       RouteTemplate;
	/** Component tag name (if route uses component) */
	component?:      string;
	/** True if lazy routes are currently loading */
	loading?:        boolean;
	/** Error that occurred during route matching or loading */
	error?:          Error;
	/** Full chain of nested route matches from root to leaf */
	chain:           RouteMatch[];
	/** Metadata from the matched route */
	metadata?:       RouteMetadata;
	/** Name of the matched route (if defined) */
	name?:           string;
	/** Animation configuration for this route */
	animation?:      RouteAnimation;
	/** Resolved view transition config for this match */
	viewTransition?: boolean | ViewTransitionConfig;
	/** Guard that runs before entering this route */
	beforeEnter?:    RouteGuard;
	/** Guard that runs before leaving this route */
	canDeactivate?:  RouteGuard;
	/** Redirect target path (if this route redirects) */
	redirect?:       string;
}

/**
 * Options for controlling navigation behavior.
 */
export interface NavigationOptions {
	/** Use history.replace instead of history.push (doesn't add to back stack) */
	replace?:     boolean;
	/** Query parameters to append to the URL */
	query?:       Record<string, string>;
	/** Hash fragment to append to the URL (without the #) */
	hash?:        string;
	/** Skip beforeEnter and canDeactivate guards */
	skipGuards?:  boolean;
	/** State object to pass to history.pushState/replaceState */
	state?:       any;
	/** @internal Track retry attempts for error boundaries */
	_retryCount?: number;
}

/**
 * Configuration options for the Router constructor.
 * All properties are optional with sensible defaults.
 */
export interface RouterConfig {
	/** URL prefix for all routes (e.g., '/app' makes routes relative to /app) */
	basePath?:          string;
	/** Save and restore scroll positions on navigation (default: true) */
	scrollRestoration?: boolean;
	/**
	 * Default View Transitions API configuration applied to all routes.
	 *
	 * - `true`  — enable default cross-fade for every route.
	 * - `false` — disable globally (default).
	 * - `ViewTransitionConfig` — enable with default types / onReady.
	 *
	 * Individual routes can override this via their own `viewTransition` property.
	 *
	 * @default false
	 */
	viewTransition?:    boolean | ViewTransitionConfig;
	/** Route to use when no match is found (404 fallback) */
	fallbackRoute?:     RouteConfig;
	/** Custom history adapter (default: BrowserHistoryAdapter) */
	history?:           HistoryAdapter;
	/** Record navigation performance metrics (default: true) */
	enableMetrics?:     boolean;
	/** Callback invoked after each navigation with timing data */
	reportPerformance?: (timing: NavigationTiming) => void;
	/** Optional endpoint for sending metrics via navigator.sendBeacon() */
	analyticsEndpoint?: string;
	/** Maximum number of metric/stat entries to keep in LRU cache (default: 100) */
	maxMetricsEntries?: number;
	/** Configuration for route prefetching strategies */
	prefetch?:          PrefetchConfig;
}

/**
 * Performance timing breakdown for a navigation.
 * Recorded when enableMetrics is true (default).
 * All times are in milliseconds.
 */
export interface NavigationTiming {
	/** Total navigation time from start to completion */
	total:             number;
	/** Time spent running beforeEnter and canDeactivate guards */
	guards:            number;
	/** Time spent rendering the template to DOM */
	templateRender:    number;
	/** Time spent on enter/exit animations */
	animations:        number;
	/** Time spent restoring scroll position */
	scrollRestoration: number;
	/** Time spent processing redirects */
	redirect:          number;
	/** The path that was navigated to */
	path:              string;
	/** Timestamp when navigation occurred (from Date.now()) */
	timestamp:         number;
}

/**
 * Statistics about lazy route loading performance.
 * Tracked automatically when using the `lazy` property on routes.
 */
export interface RouteStats {
	/** The route path that was loaded */
	path:        string;
	/** Time it took to load the route bundle (ms) */
	loadTime:    number;
	/** Size of the loaded bundle in bytes (if available) */
	bundleSize?: number;
	/** Whether this load was served from cache */
	cacheHit:    boolean;
	/** Timestamp when the route was loaded (from Date.now()) */
	timestamp:   number;
}

/**
 * Error boundary configuration for graceful error handling.
 * When navigation fails, the router walks up the route chain to find the nearest error boundary.
 */
export interface ErrorBoundary {
	/** Template to render when an error occurs */
	fallback:         RouteTemplate;
	/** Callback invoked when an error occurs */
	onError?:         (error: Error, match: RouteMatch) => void;
	/** Maximum number of retry attempts before showing fallback (default: 3) */
	maxRetries?:      number;
	/** Whether to skip guards when retrying navigation (default: false) */
	retrySkipGuards?: boolean;
}

/**
 * Configuration for automatic route prefetching.
 * Preload lazy route bundles before the user navigates for faster page transitions.
 */
export interface PrefetchConfig {
	/** Prefetching strategy:
	 * - 'hover': Prefetch when user hovers a link (debounced by delay)
	 * - 'visible': Prefetch when link enters viewport (via IntersectionObserver)
	 * - 'idle': Prefetch during browser idle time (via requestIdleCallback)
	 * - 'manual': No automatic prefetching (call router.preload() explicitly)
	 */
	strategy:   'hover' | 'visible' | 'idle' | 'manual';
	/** Hover delay in milliseconds before prefetching (hover strategy only, default: 50) */
	delay?:     number;
	/** IntersectionObserver threshold 0-1 (visible strategy only, default: 0.1) */
	threshold?: number;
}

interface CompiledRoute extends RouteConfig {
	pattern:      URLPattern;
	fullPath:     string;
	priority:     number; // For sorting: exact > params > wildcards
	parentRoute?: CompiledRoute;
}

// Simple trie node for route optimization
interface RouteNode {
	segment:        string;
	routes:         CompiledRoute[];
	children:       Map<string, RouteNode>;
	wildcardChild?: RouteNode;
	paramChild?:    RouteNode;
}

/**
 * Least Recently Used (LRU) cache with bounded memory.
 * Used internally for storing navigation metrics and route statistics.
 * Automatically evicts the least recently accessed items when the cache is full.
 */
export class LRUCache<K, V> {

	protected cache:   Map<K, V> = new Map();
	protected maxSize: number;

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

/**
 * Production-grade client-side router for Lit applications.
 *
 * Features:
 * - Native URLPattern API for route matching
 * - Trie-based route tree for performance
 * - Navigation guards (beforeEnter, canDeactivate)
 * - Lazy loading with code splitting
 * - Named routes
 * - Nested routes
 * - Animations and View Transitions API
 * - Performance metrics and analytics
 * - Prefetching strategies
 * - Error boundaries
 * - Custom history adapters
 * - Automatic anchor interception
 * - Scroll restoration
 *
 * @example
 * ```typescript
 * const router = new Router({ basePath: '/app' });
 * router.setRoutes([
 *   { path: '/', template: () => html`<home-page></home-page>` },
 *   { path: '/users/:id', template: (params) => html`<user-page .userId=${params.id}></user-page>` }
 * ]);
 * ```
 */
export class Router {

	protected routes:            RouteConfig[] = [];
	protected compiledRoutes:    CompiledRoute[] = [];
	protected routeTree:         RouteNode;
	protected namedRoutes:       Map<string, CompiledRoute> = new Map();
	protected controllers:       Set<RouterController> = new Set();
	protected baseUrl:           string;
	protected basePath:          string = '';
	protected lazyCache:         WeakMap<RouteConfig, RouteConfig[] | Promise<RouteConfig[]>> = new WeakMap();
	protected currentMatch:      RouteMatch | null = null;
	protected pendingPath:       string | null = null;
	protected scrollPositions:   Map<string, { x: number; y: number; }> = new Map();
	protected scrollRestoration: boolean = true;
	protected viewTransition:    boolean | ViewTransitionConfig = false;
	protected redirectCount:     number = 0;
	protected readonly MAX_REDIRECTS = 10;
	protected navigationDepth:   number = 0;
	protected readonly MAX_NAVIGATION_DEPTH = 10;
	protected fallbackRoute?:    RouteConfig;

	// History adapter
	protected historyAdapter:    HistoryAdapter;
	protected cleanupPopState?:  () => void;
	protected cleanupLinkClick?: () => void;

	protected enableMetrics:      boolean = true;
	protected reportPerformance?: (timing: NavigationTiming) => void;
	protected analyticsEndpoint?: string;
	protected timings:            LRUCache<string, NavigationTiming>;
	protected routeStats:         LRUCache<string, RouteStats>;
	protected prefetchConfig?:    PrefetchConfig;
	protected prefetchCache:      WeakMap<RouteConfig, Promise<RouteConfig[]>> = new WeakMap();

	// Event listeners
	protected beforeNavigateStartListeners: NavigationListener[] = [];
	protected afterNavigateStartListeners:  NavigationListener[] = [];
	protected beforeNavigateEndListeners:   NavigationListener[] = [];
	protected afterNavigateEndListeners:    NavigationListener[] = [];
	protected navigateErrorListeners:       NavigationErrorListener[] = [];

	constructor(config: RouterConfig = {}) {
		this.historyAdapter = config.history ?? new BrowserHistoryAdapter();
		this.baseUrl = this.historyAdapter.origin;
		this.basePath = config.basePath || '';
		this.scrollRestoration = config.scrollRestoration ?? true;
		this.viewTransition = config.viewTransition ?? false;
		this.fallbackRoute = config.fallbackRoute;
		this.routeTree = this.createNode('');

		this.enableMetrics = config.enableMetrics ?? true;
		this.reportPerformance = config.reportPerformance;
		this.analyticsEndpoint = config.analyticsEndpoint;
		this.timings = new LRUCache<string, NavigationTiming>(config.maxMetricsEntries ?? 100);
		this.routeStats = new LRUCache<string, RouteStats>(config.maxMetricsEntries ?? 100);
		this.prefetchConfig = config.prefetch;

		// Setup prefetching if configured
		if (this.prefetchConfig)
			this.setupPrefetching();


		// Intercept anchor clicks via adapter
		this.cleanupLinkClick = this.historyAdapter.onLinkClick(this.handleClick.bind(this));

		// Handle popstate for back/forward navigation via adapter
		this.cleanupPopState = this.historyAdapter.onPopState(this.handlePopState.bind(this));
	}

	protected handleClick(e: MouseEvent): void {
		// Walk the composed path so we can find <a> elements inside shadow DOM.
		let anchor: HTMLAnchorElement | null = null;
		for (const node of e.composedPath()) {
			if (node instanceof HTMLAnchorElement) {
				anchor = node;
				break;
			}

			// Stop at document / shadow root boundaries that aren't elements.
			if (!(node instanceof HTMLElement))
				break;
		}

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

	protected handlePopState(): void {
		// Restore scroll position if enabled
		if (this.scrollRestoration) {
			const key = this.historyAdapter.getCurrentPath();
			const pos = this.scrollPositions.get(key);
			if (pos)
				this.historyAdapter.scrollTo(pos.x, pos.y);
		}

		// Re-match the current URL so currentMatch stays in sync with the browser.
		const url = new URL(this.historyAdapter.getCurrentPath(), this.baseUrl);
		this.currentMatch = this.matchURL(url);

		this.notifyControllers();
	}

	/**
	 * Set the routing table. Replaces any existing routes.
	 * Compiles routes into URLPatterns and builds the route tree for efficient matching.
	 *
	 * @param routes - Array of route configurations
	 *
	 * @example
	 * ```typescript
	 * router.setRoutes([
	 *   { path: '/', template: () => html`<home></home>`, name: 'home' },
	 *   { path: '/about', template: () => html`<about></about>` },
	 *   {
	 *     path: '/users/:id',
	 *     template: (params) => html`<user .id=${params.id}></user>`,
	 *     name: 'user'
	 *   }
	 * ]);
	 * ```
	 */
	setRoutes(routes: RouteConfig[]): void {
		this.routes = routes;
		this.compiledRoutes = this.compileRoutes(routes);
		this.buildNamedRoutesMap(this.compiledRoutes);
		this.buildRouteTree(this.compiledRoutes);
	}

	/**
	 * Subscribe to the beforeNavigateStart event.
	 * Fires before navigation begins, before any guards are run.
	 * Return false or Promise<false> from your listener to block navigation.
	 *
	 * @param listener - Function to call when navigation is about to start
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```typescript
	 * const unsubscribe = router.onBeforeNavigateStart(async (event) => {
	 *   console.log(`Navigating from ${event.from?.path} to ${event.to.path}`);
	 *   // Block navigation if needed
	 *   if (someCondition) return false;
	 * });
	 * // Later: unsubscribe();
	 * ```
	 */
	onBeforeNavigateStart(listener: NavigationListener): () => void {
		this.beforeNavigateStartListeners.push(listener);

		return () => {
			const index = this.beforeNavigateStartListeners.indexOf(listener);
			if (index > -1)
				this.beforeNavigateStartListeners.splice(index, 1);
		};
	}

	/**
	 * Subscribe to the afterNavigateStart event.
	 * Fires after guards pass but before DOM is updated.
	 * Perfect for showing loading indicators.
	 * Return false or Promise<false> from your listener to block navigation.
	 *
	 * @param listener - Function to call after navigation starts
	 * @returns Unsubscribe function
	 */
	onAfterNavigateStart(listener: NavigationListener): () => void {
		this.afterNavigateStartListeners.push(listener);

		return () => {
			const index = this.afterNavigateStartListeners.indexOf(listener);
			if (index > -1)
				this.afterNavigateStartListeners.splice(index, 1);
		};
	}

	/**
	 * Subscribe to the beforeNavigateEnd event.
	 * Fires after DOM is updated but before controllers are notified.
	 * Useful for making final adjustments before the UI reflects the navigation.
	 * Return false or Promise<false> from your listener to block navigation.
	 *
	 * @param listener - Function to call before navigation ends
	 * @returns Unsubscribe function
	 *
	 * @example
	 * ```typescript
	 * const unsubscribe = router.onBeforeNavigateEnd(async (event) => {
	 *   console.log('DOM updated, about to notify controllers');
	 *   // Can still block here if needed
	 *   const ready = await checkIfReady();
	 *   if (!ready) return false;
	 * });
	 * ```
	 */
	onBeforeNavigateEnd(listener: NavigationListener): () => void {
		this.beforeNavigateEndListeners.push(listener);

		return () => {
			const index = this.beforeNavigateEndListeners.indexOf(listener);
			if (index > -1)
				this.beforeNavigateEndListeners.splice(index, 1);
		};
	}

	/**
	 * Subscribe to the afterNavigateEnd event.
	 * Fires after navigation is fully complete.
	 * Perfect for hiding loading indicators and tracking analytics.
	 * Returning false does not block (navigation already complete), but async listeners will be awaited.
	 *
	 * @param listener - Function to call after navigation completes
	 * @returns Unsubscribe function
	 */
	onAfterNavigateEnd(listener: NavigationListener): () => void {
		this.afterNavigateEndListeners.push(listener);

		return () => {
			const index = this.afterNavigateEndListeners.indexOf(listener);
			if (index > -1)
				this.afterNavigateEndListeners.splice(index, 1);
		};
	}

	/**
	 * Subscribe to navigation error events.
	 * Fires when navigation fails due to errors in guards, template rendering, etc.
	 *
	 * @param listener - Function to call when navigation errors occur
	 * @returns Unsubscribe function
	 */
	onNavigateError(listener: NavigationErrorListener): () => void {
		this.navigateErrorListeners.push(listener);

		return () => {
			const index = this.navigateErrorListeners.indexOf(listener);
			if (index > -1)
				this.navigateErrorListeners.splice(index, 1);
		};
	}

	protected async emitBeforeNavigateStart(event: NavigationEvent): Promise<boolean> {
		const results = await Promise.all(
			this.beforeNavigateStartListeners.map(listener => listener(event)),
		);

		return !results.includes(false);
	}

	protected async emitAfterNavigateStart(event: NavigationEvent): Promise<boolean> {
		const results = await Promise.all(
			this.afterNavigateStartListeners.map(listener => listener(event)),
		);

		return !results.includes(false);
	}

	protected async emitBeforeNavigateEnd(event: NavigationEvent): Promise<boolean> {
		const results = await Promise.all(
			this.beforeNavigateEndListeners.map(listener => listener(event)),
		);

		return !results.includes(false);
	}

	protected async emitAfterNavigateEnd(event: NavigationEvent): Promise<boolean> {
		const results = await Promise.all(
			this.afterNavigateEndListeners.map(listener => listener(event)),
		);

		return !results.includes(false);
	}

	protected emitNavigateError(event: NavigationErrorEvent): void {
		this.navigateErrorListeners.forEach(listener => listener(event));
	}

	protected compileRoutes(routes: RouteConfig[], parentPath = '', parentRoute?: CompiledRoute): CompiledRoute[] {
		const compiled: CompiledRoute[] = [];

		for (const route of routes) {
			const fullPath = this.joinPaths(parentPath, route.path);
			const patternPath = this.basePath + fullPath;

			try {
				const pattern = new URLPattern({ pathname: patternPath });
				const priority = route.children
					? -1
					: this.calculateRoutePriority(route.path);

				const compiledRoute: CompiledRoute = {
					...route,
					pattern,
					fullPath,
					priority,
					parentRoute,
				};

				// Compile children first so they appear before the parent in
				// the flat array — stable sort then keeps children ahead of
				// the layout when priorities are equal.
				if (route.children) {
					const childRoutes = this.compileRoutes(route.children, fullPath, compiledRoute);
					compiled.push(...childRoutes);
				}

				compiled.push(compiledRoute);
			}
			catch (error) {
				console.error(`Failed to compile route pattern: ${ patternPath }`, error);
			}
		}

		// Resolve reuseFrom references — copy template/component from the named source route
		this.resolveReuseFrom(compiled);

		// Sort by priority (higher priority first)
		return compiled.sort((a, b) => b.priority - a.priority);
	}

	protected calculateRoutePriority(path: string): number {
		// Root or empty path is an exact match at the parent level and should
		// have high priority (empty path means "match the parent path itself").
		if (path === '/' || path === '')
			return 100;

		let priority = 0;
		const segments = path.split('/').filter(Boolean);

		for (const segment of segments) {
			if (segment === '*' || segment === '**' || /^\(.*\)$/.test(segment)) {
				// Wildcard or regex capture group gets lowest priority
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

	protected createNode(segment: string): RouteNode {
		return {
			segment,
			routes:   [],
			children: new Map(),
		};
	}

	protected buildRouteTree(routes: CompiledRoute[]): void {
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

	/**
	 * Resolves `reuseFrom` references in compiled routes.
	 *
	 * - **String form**: copies every inheritable property from the source that
	 *   is not already defined on the target route.
	 * - **Object form**: copies only the explicitly listed properties.
	 * - **Array form**: applies multiple object-form entries in order.  Earlier
	 *   entries take precedence (first-write-wins for each property).
	 *
	 * In all cases a property already set on the target is never overwritten.
	 *
	 * Chained `reuseFrom` is supported — if route C reuses from B which reuses
	 * from A, the source chain is resolved recursively (depth-first) so
	 * declaration order does not matter. Circular references are detected and
	 * produce a warning.
	 */
	protected resolveReuseFrom(routes: CompiledRoute[]): void {
		// Build a name → route lookup from the current batch
		const byName: Map<string, CompiledRoute> = new Map();
		for (const route of routes) {
			if (route.name)
				byName.set(route.name, route);
		}

		/** Tracks which routes have already been fully resolved. */
		const resolved: Set<CompiledRoute> = new Set();
		/** Tracks routes currently being resolved (cycle detection). */
		const resolving: Set<CompiledRoute> = new Set();

		const resolve = (route: CompiledRoute): void => {
			if (resolved.has(route) || !route.reuseFrom)
				return;

			if (resolving.has(route)) {
				console.warn(
					`[Router] Circular reuseFrom detected on route '${ route.path }'. `
					+ 'Inheritance chain aborted.',
				);

				return;
			}

			resolving.add(route);

			const reuseFrom = route.reuseFrom;

			if (typeof reuseFrom === 'string') {
				// String shorthand — inherit everything from one source, skip blacklisted keys.
				const source = byName.get(reuseFrom);
				if (!source) {
					console.warn(
						`[Router] reuseFrom '${ reuseFrom }' on route '${ route.path }' `
						+ 'references a route name that does not exist.',
					);
				}
				else {
					resolve(source);

					for (const key of Object.keys(source)) {
						if (NON_INHERITABLE_KEYS.has(key))
							continue;

						const prop = key as InheritableRouteProperty;
						if (route[prop] === undefined && source[prop] !== undefined)
							(route as unknown as Record<InheritableRouteProperty, unknown>)[prop] = source[prop];
					}
				}
			}
			else {
				// Object or array form — normalize to array, inherit listed properties.
				const configs = Array.isArray(reuseFrom) ? reuseFrom : [ reuseFrom ];

				for (const config of configs) {
					const source = byName.get(config.name);
					if (!source) {
						console.warn(
							`[Router] reuseFrom '${ config.name }' on route '${ route.path }' `
							+ 'references a route name that does not exist.',
						);

						continue;
					}

					resolve(source);

					for (const prop of config.properties) {
						if (route[prop] === undefined && source[prop] !== undefined)
							(route as unknown as Record<InheritableRouteProperty, unknown>)[prop] = source[prop];
					}
				}
			}

			resolving.delete(route);
			resolved.add(route);
		};

		for (const route of routes)
			resolve(route);
	}

	protected buildNamedRoutesMap(routes: CompiledRoute[]): void {
		this.namedRoutes.clear();
		for (const route of routes) {
			if (route.name)
				this.namedRoutes.set(route.name, route);
		}
	}

	protected normalizePath(path: string): string {
		// Ensure path starts with / and doesn't end with / (unless it's root)
		path = path.startsWith('/') ? path : '/' + path;

		return path === '/' ? path : path.replace(/\/$/, '');
	}

	/**
	 * Join a parent path and a child path, handling separators correctly.
	 *
	 * - Child paths starting with `/` are treated as absolute (ignore parent prefix).
	 * - Relative child paths are appended to the parent with a `/` separator.
	 * - Empty child paths resolve to the parent path.
	 */
	protected joinPaths(parent: string, child: string): string {
		if (!parent)
			return this.normalizePath(child);

		// Absolute child path — ignore parent prefix.
		if (child.startsWith('/'))
			return this.normalizePath(child);

		// Relative child path — join with separator.
		const base = parent.endsWith('/') ? parent : parent + '/';

		return this.normalizePath(base + child);
	}

	/**
	 * Navigate to a path.
	 * Handles guards, lazy loading, animations, scroll restoration, and View Transitions API.
	 *
	 * @param path - The path to navigate to (e.g., '/users/123' or '/about')
	 * @param options - Navigation options including state, query params, hash, replace mode, and animation settings
	 * @returns Promise that resolves to true if navigation succeeded, false if blocked by guards or redirect occurred
	 *
	 * @example
	 * ```typescript
	 * // Simple navigation
	 * await router.navigate('/about');
	 *
	 * // With query params and state
	 * await router.navigate('/users/123', {
	 *   query: { tab: 'profile' },
	 *   state: { fromDashboard: true }
	 * });
	 *
	 * // Replace current history entry
	 * await router.navigate('/login', { replace: true });
	 * ```
	 */
	async navigate(path: string, options: NavigationOptions = {}): Promise<boolean> {
		const timestamp   = Date.now();
		const navStart    = performance.now();
		let guardsTime    = 0;
		let renderTime    = 0;
		let animationTime = 0;
		let scrollTime    = 0;
		let redirectTime  = 0;

		try {
			// Check navigation depth to prevent infinite loops from guards calling navigate()
			this.navigationDepth++;
			if (this.navigationDepth > this.MAX_NAVIGATION_DEPTH) {
				console.error(
					`Maximum navigation depth (${ this.MAX_NAVIGATION_DEPTH }) exceeded.`
					+ ` Possible infinite redirect loop.`,
				);
				this.navigationDepth = 0;

				return false;
			}

			// Save current scroll position
			if (this.scrollRestoration && this.currentMatch)
				this.scrollPositions.set(this.currentMatch.path, this.historyAdapter.getScrollPosition());

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

			// If navigating to the exact same URL (pathname + query + hash), treat as no-op.
			const targetUrl  = url.pathname + url.search + url.hash;
			const currentUrl = new URL(this.historyAdapter.getCurrentPath(), this.baseUrl);
			const currentFull = currentUrl.pathname + currentUrl.search + currentUrl.hash;
			if (this.currentMatch && targetUrl === currentFull && !options.replace)
				return true;

			// Eagerly set the pending path so that isActive() reflects the
			// target immediately — even before guards and animations finish.
			// Cleared in the finally block; rolled back if navigation fails.
			this.pendingPath = this.stripBasePath(url.pathname);

			// Emit beforeNavigate event
			const navEvent: NavigationEvent = {
				from: this.currentMatch,
				to:   nextMatch,
				timestamp,
			};
			const beforeStartAllowed = await this.emitBeforeNavigateStart(navEvent);
			if (!beforeStartAllowed)
				return false;

			// Check canDeactivate guards on the current route chain (leaf → parent).
			const guardStart = performance.now();
			if (!options.skipGuards && this.currentMatch) {
				for (const chainMatch of [ ...this.currentMatch.chain ].reverse()) {
					if (chainMatch.canDeactivate) {
						const canLeave = await chainMatch.canDeactivate(nextMatch, this.currentMatch);
						if (!canLeave)
							return false;
					}
				}
			}

			// Check beforeEnter guards on the full route chain (parent → leaf).
			// Parent layout guards run first; if any guard returns false, navigation is blocked.
			if (!options.skipGuards) {
				for (const chainMatch of nextMatch.chain) {
					if (chainMatch.beforeEnter) {
						const canEnter = await chainMatch.beforeEnter(nextMatch, this.currentMatch);
						if (!canEnter)
							return false;
					}
				}
			}

			guardsTime = performance.now() - guardStart;

			// Handle redirects — use the redirect stored directly on the match.
			if (nextMatch.redirect) {
				const redirectStart = performance.now();
				this.redirectCount++;
				if (this.redirectCount > this.MAX_REDIRECTS) {
					console.error('Maximum redirect limit reached');
					this.redirectCount = 0;

					return false;
				}

				const result = await this.navigate(nextMatch.redirect, { ...options, replace: true });
				redirectTime = performance.now() - redirectStart;

				return result;
			}

			this.redirectCount = 0;

			// Emit afterNavigateStart event
			const afterStartAllowed = await this.emitAfterNavigateStart(navEvent);
			if (!afterStartAllowed)
				return false;

			// Perform navigation — View Transitions API is applied only to the
			// DOM update (setting currentMatch + notifying controllers) so that
			// elements outside the route outlet (e.g. headers, sidebars) are not
			// captured in the transition snapshot.
			const renderStart = performance.now();

			// Update history (outside view transition — this is not a DOM change)
			const fullUrl = url.pathname + url.search + url.hash;
			if (options.replace)
				this.historyAdapter.replaceState(options.state || null, fullUrl);

			else
				this.historyAdapter.pushState(options.state || null, fullUrl);

			// Handle exit animation via controllers (reaches inside shadow DOM).
			// Skip when the route pattern hasn't changed (same-route param mutation).
			const animStart = performance.now();
			const currentKey = this.currentMatch
				? `${ this.currentMatch.path }:${ this.currentMatch.name ?? '' }`
				: null;
			const nextKey = `${ nextMatch.path }:${ nextMatch.name ?? '' }`;
			const routePatternChanged = currentKey !== nextKey;

			if (routePatternChanged && this.currentMatch?.animation?.exit) {
				const exitPromises: Promise<void>[] = [];
				this.controllers.forEach(controller => {
					if (controller.onBeforeMatchChange)
						exitPromises.push(controller.onBeforeMatchChange());
				});
				await Promise.all(exitPromises);
			}

			// Resolve the effective view transition config for this route.
			// Per-route config takes precedence; undefined falls back to router default.
			const resolvedVT = this.resolveViewTransition(nextMatch);

			/**
			 * The DOM update callback — this is the only part wrapped in
			 * `startViewTransition()` so snapshot capture is scoped to
			 * the content that actually changes.
			 */
			const applyMatchUpdate = async () => {
				this.currentMatch = nextMatch;
				await this.notifyControllers();
			};

			if (resolvedVT && 'startViewTransition' in document) {
				const docWithTransition = document as Document & {
					startViewTransition: (
						options: (() => Promise<void>) | { update: () => Promise<void>; types?: string[]; },
					) => ViewTransitionObject;
				};

				const vtConfig: ViewTransitionConfig | undefined =
					typeof resolvedVT === 'object' ? resolvedVT : undefined;

				// Build the options object for startViewTransition.
				// When types are specified, use the options form; otherwise use the callback form.
				let transition: ViewTransitionObject;
				if (vtConfig?.types?.length) {
					transition = docWithTransition.startViewTransition({
						update: applyMatchUpdate,
						types:  vtConfig.types,
					});
				}
				else {
					transition = docWithTransition.startViewTransition(applyMatchUpdate);
				}

				// Allow custom JS-driven animations via onReady
				if (vtConfig?.onReady)
					transition.ready.then(() => vtConfig.onReady!(transition)).catch(() => {});


				await transition.finished;
			}
			else {
				await applyMatchUpdate();
			}

			// Handle enter animation (outside view transition — separate system)
			// Enter animations are handled by router-outlet's updated() lifecycle.
			// No document query needed.

			animationTime = performance.now() - animStart;
			renderTime = performance.now() - renderStart - animationTime;

			// Scroll to top or hash
			const scrollStart = performance.now();
			if (this.scrollRestoration) {
				if (url.hash) {
					// Try to scroll to hash element
					this.historyAdapter.scrollIntoView(url.hash.slice(1));
				}
				else if (!options.replace) {
					// Scroll to top on new navigation
					this.historyAdapter.scrollTo(0, 0);
				}
			}

			scrollTime = performance.now() - scrollStart;

			// Emit beforeNavigateEnd event
			const beforeEndAllowed = await this.emitBeforeNavigateEnd(navEvent);
			if (!beforeEndAllowed)
				return false;

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

			// Emit afterNavigateEnd event (doesn't block, but awaits completion)
			await this.emitAfterNavigateEnd(navEvent);

			// Reset navigation depth on successful navigation
			this.navigationDepth = 0;

			return true;
		}
		catch (error) {
			// Reset navigation depth on error
			this.navigationDepth = 0;
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
		finally {
			// Always decrement depth in finally block to handle all cases
			this.navigationDepth = Math.max(0, this.navigationDepth - 1);
			this.pendingPath = null;
		}
	}

	/**
	 * Navigate to a named route.
	 * Routes can be assigned names in their configuration, allowing navigation by name instead of path.
	 *
	 * @param name - The name of the route to navigate to
	 * @param options - Navigation options (same as navigate())
	 * @returns Promise that resolves to true if navigation succeeded, false if route not found or blocked
	 *
	 * @example
	 * ```typescript
	 * // Define named routes
	 * router.setRoutes([
	 *   { path: '/', name: 'home', template: () => html`<home></home>` },
	 *   { path: '/users/:id', name: 'user', template: () => html`<user></user>` }
	 * ]);
	 *
	 * // Navigate by name
	 * await router.navigateByName('home');
	 * await router.navigateByName('user', { query: { tab: 'profile' } });
	 * ```
	 */
	navigateByName(name: string, options: NavigationOptions = {}): Promise<boolean> {
		const route = this.namedRoutes.get(name);
		if (!route) {
			console.warn(`No route found with name: ${ name }`);

			return Promise.resolve(false);
		}

		return this.navigate(route.fullPath, options);
	}

	protected findRouteByPath(path: string): CompiledRoute | undefined {
		return this.compiledRoutes.find(r => r.fullPath === path);
	}

	/**
	 * Match a path against the routing table.
	 * If no path is provided, matches the current URL.
	 *
	 * @param path - Optional path to match. If not provided, uses current URL
	 * @returns RouteMatch object containing matched route, params, query, hash, and chain, or null if no match
	 *
	 * @example
	 * ```typescript
	 * // Match current URL
	 * const match = router.match();
	 * console.log(match?.path); // e.g., '/users/123'
	 *
	 * // Match specific path
	 * const match = router.match('/users/123');
	 * console.log(match?.params.id); // '123'
	 * ```
	 */
	match(path?: string): RouteMatch | null {
		if (path) {
			const url = new URL(path, this.baseUrl);

			return this.matchURL(url);
		}

		const url = new URL(this.historyAdapter.getCurrentURL());

		return this.matchURL(url);
	}

	/**
	 * Match a path and return the match at a specific depth in the route chain.
	 * Useful for nested routing where you want to access a specific level of the hierarchy.
	 *
	 * @param depth - The depth in the route chain (0-based index)
	 * @param path - Optional path to match. If not provided, uses current URL
	 * @returns RouteMatch at the specified depth, or null if not found
	 *
	 * @example
	 * ```typescript
	 * // For nested route: /dashboard/settings/profile
	 * const rootMatch = router.matchAtDepth(0); // /dashboard
	 * const childMatch = router.matchAtDepth(1); // /settings
	 * const leafMatch = router.matchAtDepth(2); // /profile
	 * ```
	 */
	matchAtDepth(depth: number, path?: string): RouteMatch | null {
		const match = this.match(path);
		if (!match)
			return null;

		return match.chain[depth] || null;
	}

	protected matchURL(url: URL): RouteMatch | null {
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
					path:           compiledRoute.fullPath,
					params,
					query:          url.searchParams,
					hash:           url.hash,
					template:       compiledRoute.template,
					component:      compiledRoute.component,
					name:           compiledRoute.name,
					metadata:       compiledRoute.metadata,
					animation:      compiledRoute.animation,
					viewTransition: compiledRoute.viewTransition,
					beforeEnter:    compiledRoute.beforeEnter,
					canDeactivate:  compiledRoute.canDeactivate,
					redirect:       compiledRoute.redirect,
					chain:          [],
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

	protected hasMatchingChildRoute(pathname: string, route: CompiledRoute): boolean {
		return this.compiledRoutes.some(r =>
			r.fullPath.startsWith(route.fullPath) && r.fullPath !== route.fullPath);
	}

	protected buildChain(chain: RouteMatch[], match: RouteMatch, pathname: string): void {
		// Walk up the parent ancestry to find the matched CompiledRoute
		// and build RouteMatch entries for each ancestor.
		// Use both fullPath and name to disambiguate routes that share a fullPath
		// (e.g. a layout and its default child both resolving to '/').
		const compiledRoute = this.compiledRoutes.find(r =>
			r.fullPath === match.path && r.name === match.name);

		if (!compiledRoute) {
			chain.push(match);

			return;
		}

		// Collect the ancestry chain (leaf → root)
		const ancestry: CompiledRoute[] = [];
		let current: CompiledRoute | undefined = compiledRoute.parentRoute;
		while (current) {
			ancestry.push(current);
			current = current.parentRoute;
		}

		// Reverse to root → leaf order and create RouteMatch for each ancestor
		ancestry.reverse();

		const url = new URL(pathname, this.baseUrl);

		for (const ancestor of ancestry) {
			const result = ancestor.pattern.exec(url);
			const params: Record<string, string> = {};
			if (result?.pathname.groups)
				Object.assign(params, result.pathname.groups);

			chain.push({
				path:           ancestor.fullPath,
				params,
				query:          match.query,
				hash:           match.hash,
				template:       ancestor.template,
				component:      ancestor.component,
				name:           ancestor.name,
				metadata:       ancestor.metadata,
				animation:      ancestor.animation,
				viewTransition: ancestor.viewTransition,
				beforeEnter:    ancestor.beforeEnter,
				canDeactivate:  ancestor.canDeactivate,
				redirect:       ancestor.redirect,
				chain:          [],
			});
		}

		// Finally push the leaf match itself
		chain.push(match);
	}

	/**
	 * Resolves the effective view-transition configuration for a given match.
	 *
	 * Resolution order:
	 * 1. The **leaf route**'s own `viewTransition` property (if defined).
	 * 2. Walk up the **route chain** — the first ancestor with an explicit
	 *    `viewTransition` wins.
	 * 3. The **router-level** `viewTransition` default.
	 *
	 * `false` at any level explicitly disables transitions even if a parent
	 * or the router default is `true`.
	 *
	 * @returns A truthy value (boolean `true` or a `ViewTransitionConfig` object)
	 *          when transitions should run, or `false`/`undefined` when they should not.
	 */
	protected resolveViewTransition(match: RouteMatch): boolean | ViewTransitionConfig {
		// Check the leaf match first
		if (match.viewTransition !== undefined)
			return match.viewTransition;

		// Walk the chain from leaf to root looking for an explicit setting
		for (let i = match.chain.length - 1; i >= 0; i--) {
			const entry = match.chain[i]!;
			if (entry.viewTransition !== undefined)
				return entry.viewTransition;
		}

		// Fall back to router default
		return this.viewTransition;
	}

	protected stripBasePath(pathname: string): string {
		if (!this.basePath)
			return pathname;

		if (pathname.startsWith(this.basePath))
			return pathname.slice(this.basePath.length) || '/';

		return pathname;
	}

	/**
	 * Get the current path from the history adapter.
	 *
	 * @returns The current path (e.g., '/users/123')
	 *
	 * @example
	 * ```typescript
	 * const path = router.getCurrentPath();
	 * console.log(path); // '/dashboard/settings'
	 * ```
	 */
	getCurrentPath(): string {
		return this.historyAdapter.getCurrentPath();
	}

	/**
	 * Check whether the given path matches the current route.
	 *
	 * - Exact match for `'/'` (root) — only returns `true` when the
	 *   current path is exactly `'/'`.
	 * - For any other path, returns `true` when the current path equals
	 *   the given path **or** starts with it followed by a `'/'` (prefix match).
	 *   This makes `isActive('/browse')` match `/browse`, `/browse/foo`, etc.
	 *
	 * @param path - The path to test against the current route.
	 * @returns `true` if the path is currently active.
	 *
	 * @example
	 * ```typescript
	 * // Given the current URL is /browse/some-plugin
	 * router.isActive('/');       // false
	 * router.isActive('/browse'); // true
	 * router.isActive('/admin');  // false
	 * ```
	 */
	isActive(path: string): boolean {
		const current = this.pendingPath
			?? this.stripBasePath(this.historyAdapter.getCurrentPath());

		if (path === '/')
			return current === '/';

		return current === path || current.startsWith(path + '/');
	}

	/**
	 * Get the history adapter used by this router.
	 * Useful for advanced history manipulation or testing.
	 *
	 * @returns The HistoryAdapter instance (BrowserHistoryAdapter or MemoryHistoryAdapter)
	 *
	 * @example
	 * ```typescript
	 * const adapter = router.getHistoryAdapter();
	 * // For testing: router = new Router({ historyAdapter: new MemoryHistoryAdapter() });
	 * ```
	 */
	getHistoryAdapter(): HistoryAdapter {
		return this.historyAdapter;
	}

	/**
	 * Dispose of the router, cleaning up all event listeners and history adapter.
	 * Call this when unmounting the router to prevent memory leaks.
	 *
	 * @example
	 * ```typescript
	 * // Clean up when app is destroyed
	 * router.dispose();
	 * ```
	 */
	dispose(): void {
		this.cleanupPopState?.();
		this.cleanupLinkClick?.();
		this.historyAdapter.dispose();
	}

	addController(controller: RouterController): void {
		this.controllers.add(controller);
	}

	removeController(controller: RouterController): void {
		this.controllers.delete(controller);
	}

	protected async notifyControllers(): Promise<void> {
		const updatePromises: Promise<boolean>[] = [];
		this.controllers.forEach(controller => updatePromises.push(controller.routeChanged()));

		await Promise.all(updatePromises);
	}

	protected setupPrefetching(): void {
		if (!this.prefetchConfig)
			return;

		const { strategy, delay = 50, threshold = 0.1 } = this.prefetchConfig;

		// DOM-dependent strategies require a browser environment
		const hasDom = typeof document !== 'undefined';

		if (strategy === 'hover' && hasDom) {
			// Prefetch on link hover
			document.addEventListener('mouseover', (e) => {
				const link = (e.target as HTMLElement).closest('a');
				if (!link || !link.href)
					return;

				const url = new URL(link.href);
				if (url.origin !== this.historyAdapter.origin)
					return;

				// Debounce hover
				setTimeout(() => {
					this.preload(url.pathname).catch(() => {});
				}, delay);
			}, { passive: true });
		}
		else if (strategy === 'visible' && hasDom) {
			// Prefetch when link becomes visible
			const observer = new IntersectionObserver((entries) => {
				entries.forEach(entry => {
					if (entry.isIntersecting) {
						const link = entry.target as HTMLAnchorElement;
						if (!link.href)
							return;

						const url = new URL(link.href);
						if (url.origin === this.historyAdapter.origin)
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
			if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
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

	/**
	 * Manually preload a route and its lazy children.
	 * Fetches the route's lazy modules and compiles any children into the routing table.
	 * Useful for improving perceived performance by loading routes before navigation.
	 *
	 * @param path - The path to preload (e.g., '/dashboard')
	 * @returns Promise that resolves when the route is loaded and compiled
	 *
	 * @example
	 * ```typescript
	 * // Preload on hover
	 * linkElement.addEventListener('mouseenter', () => {
	 *   router.preload('/dashboard').catch(console.error);
	 * });
	 *
	 * // Preload critical routes on app startup
	 * await router.preload('/dashboard');
	 * ```
	 */
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

	/**
	 * Preload all lazy routes in the routing table.
	 * Fetches all lazy modules in parallel, useful for aggressive prefetching strategies.
	 *
	 * @returns Promise that resolves when all lazy routes are loaded
	 *
	 * @example
	 * ```typescript
	 * // Preload all routes during idle time
	 * if ('requestIdleCallback' in window) {
	 *   requestIdleCallback(() => {
	 *     router.preloadAll().catch(console.error);
	 *   });
	 * }
	 * ```
	 */
	async preloadAll(): Promise<void> {
		const lazyRoutes = this.compiledRoutes.filter(r => r.lazy);
		await Promise.all(lazyRoutes.map(r => this.preload(r.fullPath)));
	}

	protected async handleRouteError(error: Error, path: string, options: NavigationOptions): Promise<boolean> {
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

	protected findErrorBoundary(chain: RouteMatch[]): ErrorBoundary | undefined {
		// Search from innermost (current) to outermost (root)
		for (let i = chain.length - 1; i >= 0; i--) {
			const match = chain[i]!;
			const route = this.findRouteByPath(match.path);
			if (route?.errorBoundary)
				return route.errorBoundary;
		}

		return undefined;
	}

	/**
	 * Get all navigation timing metrics.
	 * Returns an array of timing data for all navigations, useful for performance analysis.
	 *
	 * @returns Array of NavigationTiming objects with durations for guards, render, animation, etc.
	 *
	 * @example
	 * ```typescript
	 * const timings = router.getTimings();
	 * timings.forEach(t => {
	 *   console.log(`${t.path}: ${t.totalTime}ms (guards: ${t.guardsTime}ms, render: ${t.renderTime}ms)`);
	 * });
	 * ```
	 */
	getTimings(): NavigationTiming[] {
		return Array.from(this.timings.values());
	}

	/**
	 * Get the most recent navigation timing.
	 *
	 * @returns The last NavigationTiming object, or undefined if no navigation has occurred
	 *
	 * @example
	 * ```typescript
	 * const lastTiming = router.getLastTiming();
	 * console.log(`Last navigation took ${lastTiming?.totalTime}ms`);
	 * ```
	 */
	getLastTiming(): NavigationTiming | undefined {
		const all = Array.from(this.timings.values());

		return all[all.length - 1];
	}

	/**
	 * Clear all stored navigation timings.
	 * Useful for resetting metrics between test runs or after app state changes.
	 *
	 * @example
	 * ```typescript
	 * router.clearTimings();
	 * ```
	 */
	clearTimings(): void {
		this.timings.clear();
	}

	/**
	 * Get statistics for all lazy-loaded routes.
	 * Returns load times and cache hit information for performance monitoring.
	 *
	 * @returns Array of RouteStats objects with load times and cache info
	 *
	 * @example
	 * ```typescript
	 * const stats = router.getRouteStats();
	 * stats.forEach(s => {
	 *   console.log(`${s.path}: ${s.loadTime}ms, cached: ${s.fromCache}`);
	 * });
	 * ```
	 */
	getRouteStats(): RouteStats[] {
		return Array.from(this.routeStats.values());
	}

	/**
	 * Get the most recent statistics for a specific route path.
	 *
	 * @param path - The route path to get stats for
	 * @returns RouteStats for the path, or undefined if not found
	 *
	 * @example
	 * ```typescript
	 * const stats = router.getStats('/dashboard');
	 * console.log(`Load time: ${stats?.loadTime}ms`);
	 * ```
	 */
	getStats(path: string): RouteStats | undefined {
		// Find most recent stats for this path
		return Array.from(this.routeStats.values())
			.filter(s => s.path === path)
			.sort((a, b) => b.timestamp - a.timestamp)[0];
	}

	/**
	 * Clear all stored route statistics.
	 *
	 * @example
	 * ```typescript
	 * router.clearStats();
	 * ```
	 */
	clearStats(): void {
		this.routeStats.clear();
	}

	/**
	 * Get aggregated statistics across all lazy-loaded routes.
	 * Provides summary metrics including total loads, cache hits, and average load time.
	 *
	 * @returns Object with totalLoads, cacheHits, and averageLoadTime (in milliseconds)
	 *
	 * @example
	 * ```typescript
	 * const { totalLoads, cacheHits, averageLoadTime } = router.getAggregatedStats();
	 * console.log(`${cacheHits}/${totalLoads} from cache, avg load: ${averageLoadTime}ms`);
	 * ```
	 */
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

/**
 * Lit ReactiveController for integrating the router with Lit components.
 * Automatically requests host updates when the route changes.
 * Used internally by router-outlet and router-link components.
 *
 * @example
 * ```typescript
 * class MyComponent extends LitElement {
 *   private routerCtrl = new RouterController(this, router, 0);
 *
 *   render() {
 *     const match = this.routerCtrl.match();
 *     return match?.template(match.params) ?? nothing;
 *   }
 * }
 * ```
 */
export class RouterController implements ReactiveController {

	protected host:   ReactiveControllerHost;
	protected router: Router;
	protected depth:  number;

	/**
	 * Create a new RouterController.
	 *
	 * @param host - The Lit ReactiveControllerHost (typically a LitElement)
	 * @param router - The Router instance to control
	 * @param depth - The nesting depth for nested routing (default: 0)
	 */
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

	/**
	 * Called by the router when the route changes. Triggers a host update.
	 * Returns the host's updateComplete promise so the caller can await the render cycle.
	 */
	routeChanged(): Promise<boolean> {
		this.host.requestUpdate();

		return this.host.updateComplete;
	}

	/**
	 * Optional callback invoked before the router changes the current match.
	 * Used by router-outlet to play exit animations before the DOM swaps.
	 */
	onBeforeMatchChange?: () => Promise<void>;

	/**
	 * Navigate to a path.
	 * Delegates to the router's navigate method.
	 *
	 * @param path - The path to navigate to
	 * @param options - Navigation options
	 * @returns Promise that resolves to true if navigation succeeded
	 */
	navigate(path: string, options?: NavigationOptions): Promise<boolean> {
		return this.router.navigate(path, options);
	}

	/**
	 * Navigate to a named route.
	 * Delegates to the router's navigateByName method.
	 *
	 * @param name - The name of the route
	 * @param options - Navigation options
	 * @returns Promise that resolves to true if navigation succeeded
	 */
	navigateByName(name: string, options?: NavigationOptions): Promise<boolean> {
		return this.router.navigateByName(name, options);
	}

	/**
	 * Match a path at the controller's depth.
	 * For nested routing, returns the match at the specified depth level.
	 *
	 * @param path - Optional path to match. If not provided, uses current URL
	 * @returns RouteMatch at this controller's depth, or null if no match
	 */
	match(path?: string): RouteMatch | null {
		return this.router.matchAtDepth(this.depth, path);
	}

	/**
	 * Get the current path from the router.
	 *
	 * @returns The current path
	 */
	getCurrentPath(): string {
		return this.router.getCurrentPath();
	}

	/**
	 * Check whether the given path matches the current route.
	 * Delegates to the router's isActive method.
	 *
	 * @param path - The path to test
	 * @returns `true` if the path is currently active
	 */
	isActive(path: string): boolean {
		return this.router.isActive(path);
	}

	/**
	 * Get the nesting depth of this controller.
	 *
	 * @returns The depth (0 for root level)
	 */
	getDepth(): number {
		return this.depth;
	}

}

// Global router instance — per-route animations handle transitions.
export const router: Router = new Router();
