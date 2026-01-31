import { createContext } from '@lit/context';
import { ReactiveController, ReactiveControllerHost, TemplateResult } from 'lit';

export type RouteTemplate = (params: Record<string, string>) => TemplateResult;
export type RouteLazy = () => Promise<RouteConfig[]>;
export type RouteGuard = (to: RouteMatch, from: RouteMatch | null) => boolean | Promise<boolean>;
export type RouteMetadata = Record<string, any>;
export type RouteAnimation = {
	enter?: (element: Element) => Promise<void> | void;
	exit?: (element: Element) => Promise<void> | void;
};

// Navigation event types
export interface NavigationEvent {
	from: RouteMatch | null;
	to: RouteMatch;
	timestamp: number;
}

export interface NavigationErrorEvent extends NavigationEvent {
	error: Error;
}

export type NavigationListener = (event: NavigationEvent) => void;
export type NavigationErrorListener = (event: NavigationErrorEvent) => void;

// Context for dependency injection
export const routerContext = createContext<Router>(Symbol('router'));

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
	replace?:    boolean;
	query?:      Record<string, string>;
	hash?:       string;
	skipGuards?: boolean;
	state?:      any;
}

export interface RouterConfig {
	basePath?:              string;
	scrollRestoration?:     boolean;
	useViewTransitions?:    boolean;
	fallbackRoute?:         RouteConfig;
}

interface CompiledRoute extends RouteConfig {
	pattern:  URLPattern;
	fullPath: string;
	priority: number; // For sorting: exact > params > wildcards
}

// Simple trie node for route optimization
interface RouteNode {
	segment: string;
	routes: CompiledRoute[];
	children: Map<string, RouteNode>;
	wildcardChild?: RouteNode;
	paramChild?: RouteNode;
}

export class Router {

	private routes:            RouteConfig[] = [];
	private compiledRoutes:    CompiledRoute[] = [];
	private routeTree:         RouteNode;
	private namedRoutes:       Map<string, CompiledRoute> = new Map();
	private controllers:       Set<RouterController> = new Set();
	private baseUrl:           string;
	private basePath:          string = '';
	private lazyCache:         WeakMap<RouteConfig, RouteConfig[] | Promise<RouteConfig[]>> = new WeakMap();
	private currentMatch:      RouteMatch | null = null;
	private scrollPositions:   Map<string, { x: number; y: number; }> = new Map();
	private scrollRestoration: boolean = true;
	private useViewTransitions: boolean = false;
	private redirectCount:     number = 0;
	private readonly MAX_REDIRECTS = 10;
	private fallbackRoute?:    RouteConfig;

	// Event listeners
	private beforeNavigateListeners:  NavigationListener[] = [];
	private navigateStartListeners:   NavigationListener[] = [];
	private navigateEndListeners:     NavigationListener[] = [];
	private navigateErrorListeners:   NavigationErrorListener[] = [];

	constructor(config: RouterConfig = {}) {
		this.baseUrl = window.location.origin;
		this.basePath = config.basePath || '';
		this.scrollRestoration = config.scrollRestoration ?? true;
		this.useViewTransitions = config.useViewTransitions ?? false;
		this.fallbackRoute = config.fallbackRoute;
		this.routeTree = this.createNode('');

		// Intercept anchor clicks
		document.addEventListener('click', this.handleClick.bind(this));

		// Handle popstate for back/forward navigation
		window.addEventListener('popstate', this.handlePopState.bind(this));
	}

	private handleClick(e: MouseEvent): void {
		const anchor = (e.target as Element).closest('a');

		if (!anchor)
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
					if (!currentNode.wildcardChild) {
						currentNode.wildcardChild = this.createNode(segment);
					}
					currentNode = currentNode.wildcardChild;
				}
				else if (segment.startsWith(':')) {
					// Parameter segment
					if (!currentNode.paramChild) {
						currentNode.paramChild = this.createNode(segment);
					}
					currentNode = currentNode.paramChild;
				}
				else {
					// Exact match segment
					if (!currentNode.children.has(segment)) {
						currentNode.children.set(segment, this.createNode(segment));
					}
					currentNode = currentNode.children.get(segment)!;
				}
			}

			currentNode.routes.push(route);
		}
		}

		return compiled;
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
				from:      this.currentMatch,
				to:        nextMatch,
				timestamp,
			};
			this.emitBeforeNavigate(navEvent);

			// Check canDeactivate guard on current route
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

			// Handle redirects
			const nextRoute = this.findRouteByPath(nextMatch.path);
			if (nextRoute?.redirect) {
				this.redirectCount++;
				if (this.redirectCount > this.MAX_REDIRECTS) {
					console.error('Maximum redirect limit reached');
					this.redirectCount = 0;

					return false;
				}

				return this.navigate(nextRoute.redirect, { ...options, replace: true });
			}

			this.redirectCount = 0;

			// Emit navigateStart event
			this.emitNavigateStart(navEvent);

			// Perform navigation with View Transitions API if enabled
			const doNavigation = async () => {
				// Update history
				const fullUrl = url.pathname + url.search + url.hash;
				if (options.replace)
					window.history.replaceState(options.state || null, '', fullUrl);

				else
					window.history.pushState(options.state || null, '', fullUrl);

				// Handle exit animation
				if (this.currentMatch) {
					const currentRoute = this.findRouteByPath(this.currentMatch.path);
					if (currentRoute?.animation?.exit) {
						const elements = document.querySelectorAll('[data-route-element]');
						await Promise.all(
							Array.from(elements).map(el => currentRoute.animation!.exit!(el))
						);
					}
				}

				this.currentMatch = nextMatch;

				// Handle enter animation
				if (nextRoute?.animation?.enter) {
					// Wait for next frame to ensure element is rendered
					await new Promise(resolve => requestAnimationFrame(resolve));
					const elements = document.querySelectorAll('[data-route-element]');
					await Promise.all(
						Array.from(elements).map(el => nextRoute.animation!.enter!(el))
					);
				}

				// Scroll to top or hash
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

				this.notifyControllers();
			};

			// Use View Transitions API if available and enabled
			if (this.useViewTransitions && 'startViewTransition' in document) {
				await (document as any).startViewTransition(doNavigation).finished;
			}
			else {
				await doNavigation();
			}

			// Emit navigateEnd event
			this.emitNavigateEnd(navEvent);

			return true;
		}
		catch (error) {
			// Emit error event
			const errorEvent: NavigationErrorEvent = {
				from:      this.currentMatch,
				to:        { path, params: {}, query: new URLSearchParams(), hash: '', chain: [] } as RouteMatch,
				timestamp,
				error:     error as Error,
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
		const url = path ? new URL(path, this.baseUrl) : window.location;

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
				if (compiledRoute.lazy && !this.hasMatchingChildRoute(pathname, compiledRoute)) {
					const cached = this.lazyCache.get(compiledRoute);

					if (cached) {
						if (cached instanceof Promise) {
							cached.then(() => this.notifyControllers()).catch(() => this.notifyControllers());
							routeMatch.loading = true;

							return routeMatch;
						}

						// Re-match with loaded children
						return this.matchURL(url);
					}
					else {
						// Start loading
						const loadPromise = compiledRoute.lazy().then(children => {
							this.lazyCache.set(compiledRoute, children);
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
				}

				return routeMatch;
			}
		}

		return null;
	}

	private stripBasePath(pathname: string): string {
		if (this.basePath && pathname.startsWith(this.basePath))
			return pathname.slice(this.basePath.length) || '/';

		return pathname;
	}

	private buildChain(chain: RouteMatch[], match: RouteMatch, pathname: string): void {
		// Build chain by finding all parent routes
		const segments = pathname.split('/').filter(Boolean);
		let currentPath = '';

		for (let i = 0; i < segments.length; i++) {
			currentPath += '/' + segments[i];
			const parentRoute = this.compiledRoutes.find(r =>
				r.fullPath === currentPath ||
				this.normalizePath(currentPath).startsWith(r.fullPath));

			if (parentRoute && !chain.find(c => c.path === parentRoute.fullPath)) {
				const parentMatch: RouteMatch = {
					path:      parentRoute.fullPath,
					params:    match.params,
					query:     match.query,
					hash:      match.hash,
					template:  parentRoute.template,
					component: parentRoute.component,
					name:      parentRoute.name,
					metadata:  parentRoute.metadata,
					chain:     [],
				};
				chain.push(parentMatch);
			}
		}

		chain.push(match);
	}

	private hasMatchingChildRoute(pathname: string, route: CompiledRoute): boolean {
		return this.compiledRoutes.some(r =>
			r.fullPath.startsWith(route.fullPath) && r.fullPath !== route.fullPath);
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
export const router = new Router();
