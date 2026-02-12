# Router — Technical Breakdown

This document is a comprehensive technical reference for the client-side router feature.
It covers the architecture, data structures, algorithms, and lifecycle of every major subsystem.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Map](#file-map)
3. [Type System](#type-system)
4. [Route Compilation Pipeline](#route-compilation-pipeline)
5. [URL Matching Algorithm](#url-matching-algorithm)
6. [Navigation Lifecycle](#navigation-lifecycle)
7. [Guard System](#guard-system)
8. [Navigation Hooks](#navigation-hooks)
9. [Redirect Handling](#redirect-handling)
10. [Infinite Loop Protection](#infinite-loop-protection)
11. [Lazy Loading & Code Splitting](#lazy-loading--code-splitting)
12. [History Adapters](#history-adapters)
13. [Scroll Restoration](#scroll-restoration)
14. [View Transitions API](#view-transitions-api)
15. [Animations](#animations)
16. [Prefetching Strategies](#prefetching-strategies)
17. [Error Boundaries](#error-boundaries)
18. [Performance Metrics & Analytics](#performance-metrics--analytics)
19. [LRU Cache](#lru-cache)
20. [Lit Integration (RouterController)](#lit-integration-routercontroller)
21. [Components](#components)
22. [Global Singleton](#global-singleton)
23. [Anchor Interception](#anchor-interception)

---

## Architecture Overview

The router is a self-contained feature module built for Lit 3.x web component applications.
It has **zero external runtime dependencies** beyond Lit and `@lit/context`.

```text
┌─────────────────────────────────────────────────────────┐
│                     Application                         │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐   ┌────────────-──┐ │
│  │ router-link  │  │router-outlet │   │router-provider│ │
│  │  (component) │  │  (component) │   │  (component)  │ │
│  └──────┬───────┘  └──────┬───────┘   └──────┬────────┘ │
│         │                 │                  │          │
│         │     ┌───────────┴─────┐            │          │
│         └─────┤RouterController ├────────────┘          │
│               │  (Lit RC)       │                       │
│               └────────┬────────┘                       │
│                        │                                │
│               ┌────────┴────────┐                       │
│               │     Router      │                       │
│               │  (core engine)  │                       │
│               └────────┬────────┘                       │
│                        │                                │
│               ┌────────┴────────┐                       │
│               │ HistoryAdapter  │                       │
│               │  (interface)    │                       │
│               └───┬─────────┬───┘                       │
│        ┌──────────┘         └──────────┐                │
│  ┌─────┴─-─────────┐  ┌──────────────-─┴┐               │
│  │ BrowserHistory  │  │ MemoryHistory   │               │
│  │ Adapter         │  │ Adapter         │               │
│  └─────────────────┘  └─────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

Key design decisions:

- **URLPattern API** — uses the native `URLPattern` API for route matching, avoiding hand-rolled regex.
- **Trie-based route tree** — routes are compiled into a trie for O(segments) lookup with priority ordering.
- **History adapter abstraction** — decouples the router from `window.history`, enabling use in Chrome extensions, tests, and SSR.
- **Parallel hooks** — navigation lifecycle hooks run in parallel via `Promise.all`, so registration order never matters.
- **WeakMap lazy cache** — lazy route results are cached with a `WeakMap` keyed on the `RouteConfig` object reference, so cache entries are GC'd when the config object is unreachable.

---

## File Map

| File | Lines | Purpose |
| --- | --- | --- |
| `router.ts` | ~1782 | Core router engine: types, interfaces, `LRUCache`, `Router`, `RouterController`, global singleton |
| `history-adapter.ts` | ~330 | `HistoryAdapter` interface, `BrowserHistoryAdapter`, `MemoryHistoryAdapter` |
| `router-outlet.ts` | ~110 | `<router-outlet>` component — renders the matched route at a given depth |
| `router-link.ts` | ~90 | `<router-link>` component — declarative navigation links with active class |
| `router-provider.ts` | ~35 | `<router-provider>` component — provides a `Router` via Lit context |
| `index.ts` | ~6 | Barrel file re-exporting all public API |

---

## Type System

### Public Types

| Type | Shape | Description |
| --- | --- | --- |
| `RouteTemplate` | `(params: Record<string, string>) => TemplateResult` | Renders a route's view given matched params |
| `RouteLazy` | `() => Promise<RouteConfig[]>` | Dynamically loads child routes (code splitting) |
| `RouteGuard` | `(to: RouteMatch, from: RouteMatch \| null) => boolean \| Promise<boolean>` | Determines whether navigation should proceed |
| `RouteMetadata` | `Record<string, any>` | Arbitrary data attached to a route |
| `NavigationListener` | `(event: NavigationEvent) => boolean \| Promise<boolean> \| void` | Hook listener; return `false` to block |
| `NavigationErrorListener` | `(event: NavigationErrorEvent) => void` | Error hook listener |

### Core Interfaces

#### `RouteConfig`

The user-facing route definition:

```typescript
{
  path:           string;          // URLPattern path: '/', '/users/:id', '/files/*'
  template?:      RouteTemplate;   // View renderer
  component?:     string;          // Custom element tag name (alternative to template)
  children?:      RouteConfig[];   // Static child routes
  lazy?:          RouteLazy;       // Dynamic child loader
  name?:          string;          // Unique name for navigateByName()
  redirect?:      string;          // Declarative redirect target
  beforeEnter?:   RouteGuard;      // Guard before entering
  canDeactivate?: RouteGuard;      // Guard before leaving
  metadata?:      RouteMetadata;   // Arbitrary metadata
  animation?:     RouteAnimation;  // Enter/exit animations
  errorBoundary?: ErrorBoundary;   // Error handling
}
```

#### `RouteMatch`

Produced by the matching algorithm. This is what listeners, guards, templates, and components receive:

```typescript
{
  path:       string;                    // The matched route's full path
  params:     Record<string, string>;    // Extracted URL params
  query:      URLSearchParams;           // Parsed query string
  hash:       string;                    // Hash fragment
  template?:  RouteTemplate;             // Template from matched route
  component?: string;                    // Component from matched route
  loading?:   boolean;                   // True while lazy children load
  error?:     Error;                     // Error if matching/loading failed
  chain:      RouteMatch[];              // Full nested match hierarchy
  metadata?:  RouteMetadata;             // Metadata from matched route
  name?:      string;                    // Route name (if defined)
  animation?: RouteAnimation;            // Animation config
}
```

#### `NavigationEvent`

Emitted to lifecycle hooks:

```typescript
{
  from:      RouteMatch | null;  // Previous route (null on first navigation)
  to:        RouteMatch;         // Target route
  timestamp: number;             // Date.now() when navigation started
}
```

#### `NavigationOptions`

Controls navigation behavior:

```typescript
{
  replace?:     boolean;                  // Use replaceState (no back-stack entry)
  query?:       Record<string, string>;   // Query parameters
  hash?:        string;                   // Hash fragment
  skipGuards?:  boolean;                  // Bypass guards
  state?:       any;                      // History state object
  _retryCount?: number;                   // Internal: error boundary retry tracking
}
```

### Internal Types

#### `CompiledRoute`

Extends `RouteConfig` with compilation artifacts:

```typescript
interface CompiledRoute extends RouteConfig {
  pattern:  URLPattern;  // Compiled URLPattern
  fullPath: string;      // Resolved full path (parent + child)
  priority: number;      // Numeric sort score
}
```

#### `RouteNode`

A node in the trie-based route tree:

```typescript
interface RouteNode {
  segment:        string;                   // Path segment for this node
  routes:         CompiledRoute[];          // Routes that terminate at this node
  children:       Map<string, RouteNode>;   // Exact-match children
  wildcardChild?: RouteNode;               // Wildcard segment child
  paramChild?:    RouteNode;               // Parameter segment child
}
```

---

## Route Compilation Pipeline

When `setRoutes()` is called, the raw `RouteConfig[]` array goes through a three-step pipeline:

```text
RouteConfig[] ──► compileRoutes() ──► buildNamedRoutesMap() ──► buildRouteTree()
                     │                       │                        │
                     ▼                       ▼                        ▼
              CompiledRoute[]         Map<name, route>          RouteNode (trie)
```

### Step 1: `compileRoutes(routes, parentPath)`

Recursively processes each `RouteConfig`:

1. Resolves the full path by concatenating `parentPath + route.path`.
2. Normalizes the path (leading `/`, no trailing `/` unless root).
3. Prepends `basePath` to create the pattern path.
4. Constructs a `new URLPattern({ pathname: patternPath })`.
5. Scores the route's priority with `calculateRoutePriority()`.
6. Recursively compiles static `children`.
7. Returns a flat, priority-sorted array (`higher priority first`).

### Step 2: Priority Scoring

Each path segment contributes to the score:

| Segment Type | Score | Example |
| --- | --- | --- |
| Exact (literal) | +100 | `users`, `about` |
| Parameter (`:param`) | +10 | `:id`, `:slug` |
| Wildcard (`*`, `**`) | +1 | `*`, `(.*)` |

Multi-segment paths accumulate scores. For example:

- `/users/:id` → 100 + 10 = **110**
- `/users/:id/posts` → 100 + 10 + 100 = **210**
- `/*` → 1 (always matches last)

The compiled array is sorted descending by priority, so exact matches are always tried before parameter and wildcard matches.

### Step 3: `buildRouteTree(routes)`

Builds a trie from compiled routes. Each path segment maps to a child node:

```text
Root ("")
├── "users" (exact)
│   └── ":id" (param)
│       └── "posts" (exact)
├── "about" (exact)
└── "*" (wildcard)
```

Node selection priority during matching:

1. **Exact children** — `children.get(segment)` (highest priority)
2. **Param child** — `paramChild` (medium priority)
3. **Wildcard child** — `wildcardChild` (lowest priority)

### Step 4: `buildNamedRoutesMap(routes)`

Builds a `Map<string, CompiledRoute>` from all routes that have a `name` property.
Used by `navigateByName()` for O(1) route lookup by name.

---

## URL Matching Algorithm

Matching is performed by `matchURL(url: URL)`:

1. Iterates the flat `compiledRoutes` array (already sorted by priority).
2. For each route, calls `compiledRoute.pattern.exec(url)`.
3. The **first match wins** (priority sort ensures correctness).
4. Extracts `params` from `result.pathname.groups`.
5. Builds a `RouteMatch` with the extracted data.
6. Calls `buildChain()` to populate the nested `chain` array.
7. Handles lazy loading (see [Lazy Loading](#lazy-loading--code-splitting)).

If no route matches, returns `null`.

The `match()` method is the public API. It accepts an optional path string; if omitted,
it matches the current URL from the history adapter.

`matchAtDepth(depth, path?)` returns the `RouteMatch` at a specific index in the `chain` array,
used by `<router-outlet>` for nested routing.

---

## Navigation Lifecycle

The `navigate()` method orchestrates the full navigation lifecycle. Here is the complete
sequence of operations:

```text
navigate(path, options)
│
├─ 1. Increment navigationDepth
│     └─ If > MAX_NAVIGATION_DEPTH (10) → abort, return false
│
├─ 2. Save current scroll position (if scrollRestoration enabled)
│
├─ 3. Build URL
│     ├─ Parse path into URL object
│     ├─ Append options.query as search params
│     └─ Append options.hash as fragment
│
├─ 4. Match URL against route table
│     ├─ matchURL(url) → RouteMatch
│     └─ If no match and fallbackRoute exists → try fallback
│     └─ If still no match → warn and return false
│
├─ 5. Emit onBeforeNavigateStart (parallel)
│     └─ If any listener returns false → return false
│
├─ 6. Run guards (unless skipGuards)
│     ├─ canDeactivate on current route
│     │   └─ If returns false → return false
│     └─ beforeEnter on target route
│         └─ If returns false → return false
│
├─ 7. Handle declarative redirect
│     ├─ Increment redirectCount
│     ├─ If > MAX_REDIRECTS (10) → abort
│     └─ Recursively call navigate(redirect, { replace: true })
│
├─ 8. Emit onAfterNavigateStart (parallel)
│     └─ If any listener returns false → return false
│
├─ 9. doNavigation() closure
│     ├─ 9a. Update history (pushState or replaceState via adapter)
│     ├─ 9b. Run exit animation on [data-route-element] elements
│     ├─ 9c. Set this.currentMatch = nextMatch
│     ├─ 9d. Run enter animation (after requestAnimationFrame)
│     ├─ 9e. Scroll restoration (hash → scrollIntoView, else → scrollTo(0,0))
│     ├─ 9f. Emit onBeforeNavigateEnd (parallel)
│     │       └─ If any listener returns false → return false
│     └─ 9g. notifyControllers() → triggers host.requestUpdate()
│
├─ 10. View Transitions API wrapper
│      └─ If useViewTransitions && document.startViewTransition exists:
│           wrap doNavigation in startViewTransition
│         Else: call doNavigation directly
│
├─ 11. Record metrics (NavigationTiming)
│      ├─ Store in LRU cache (keyed by path)
│      ├─ Call reportPerformance callback (if configured)
│      └─ Send via navigator.sendBeacon (if analyticsEndpoint configured)
│
├─ 12. Emit onAfterNavigateEnd (parallel, non-blocking)
│
├─ 13. Reset navigationDepth to 0
│
└─ 14. Return true (navigation succeeded)

On error:
├─ Reset navigationDepth to 0
├─ Try error boundaries (handleRouteError)
├─ If handled → return true
├─ Else → emit onNavigateError, re-throw
│
Finally:
└─ Decrement navigationDepth (min 0) — handles guard navigate() calls
```

---

## Guard System

Guards are functions that can block navigation. There are two types:

### `beforeEnter`

Runs before navigating **to** a route:

```typescript
beforeEnter?: (to: RouteMatch, from: RouteMatch | null) => boolean | Promise<boolean>;
```

- Return `true` → allow navigation.
- Return `false` → block navigation. `navigate()` returns `false`.
- For redirects: call `router.navigate('/other-path')` + return `false`.

### `canDeactivate`

Runs before leaving the **current** route:

```typescript
canDeactivate?: (to: RouteMatch, from: RouteMatch | null) => boolean | Promise<boolean>;
```

- Return `true` → allow leaving.
- Return `false` → block navigation (user stays on current route).
- Common use case: "unsaved changes" confirmation dialogs.

### Guard execution order

1. `canDeactivate` on the **current** route (if exists)
2. `beforeEnter` on the **target** route (if exists)

Guards can be skipped by passing `{ skipGuards: true }` in `NavigationOptions`.
Error boundary retries can also skip guards via `retrySkipGuards: true`.

### Redirect pattern

Do **not** use the `redirect` property when guards are involved. Instead, use a `beforeEnter` guard
that calls `router.navigate()` to the correct destination and returns `false`:

```typescript
{
  path: '/(.*)',
  beforeEnter: async (to, from) => {
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
      router.navigate('/');
    } else {
      router.navigate('/login');
    }
    return false; // Always block — the navigate() call handles routing
  }
}
```

This avoids infinite redirect loops that can occur with declarative `redirect` combined with guards.

---

## Navigation Hooks

Five lifecycle hooks are available. The first four support **blocking** — return `false` to cancel navigation.

| Hook | When it fires | Can block? |
| --- | --- | --- |
| `onBeforeNavigateStart` | Before guards, before anything happens | ✅ |
| `onAfterNavigateStart` | After guards pass, before DOM update | ✅ |
| `onBeforeNavigateEnd` | After DOM update, before controllers notified | ✅ |
| `onAfterNavigateEnd` | After everything is complete | ⚠️ (awaited but navigation is done) |
| `onNavigateError` | When navigation throws an error | ❌ |

### Registration

Each hook method returns an unsubscribe function:

```typescript
const unsub = router.onBeforeNavigateStart((event) => {
  console.log(`${event.from?.path} → ${event.to.path}`);
  if (shouldBlock()) return false;
});

// Later:
unsub();
```

### Parallel execution

All listeners registered for a given hook are executed **in parallel** via `Promise.all()`.
This means:

- Registration order does not matter.
- All listeners are invoked, even if one returns `false`.
- Navigation is blocked if **any** listener returns `false`.

```typescript
// Implementation pattern:
protected async emitBeforeNavigateStart(event: NavigationEvent): Promise<boolean> {
  const results = await Promise.all(
    this.beforeNavigateStartListeners.map(listener => listener(event)),
  );
  return !results.includes(false);
}
```

### Listener signature

```typescript
type NavigationListener = (event: NavigationEvent) => boolean | Promise<boolean> | void;
```

- Return `false` or `Promise<false>` → blocks navigation.
- Return `true`, `void`, or `undefined` → allows navigation.

---

## Redirect Handling

### Declarative redirects

A route with a `redirect` property triggers a recursive `navigate()` call with `{ replace: true }`:

```typescript
{ path: '/old-path', redirect: '/new-path' }
```

The redirect replaces the current history entry (no back-button pollution).

### Redirect counter

A `redirectCount` counter prevents infinite redirect chains. It increments on each declarative
redirect and aborts at `MAX_REDIRECTS = 10`. It resets to 0 after a non-redirect navigation succeeds.

---

## Infinite Loop Protection

Two independent mechanisms protect against infinite loops:

### 1. Navigation depth tracking (`navigationDepth`)

Guards can call `router.navigate()` themselves (e.g., redirecting unauthenticated users).
This means `navigate()` can be re-entered. The `navigationDepth` counter tracks nesting:

- Incremented at the **start** of every `navigate()` call.
- If it exceeds `MAX_NAVIGATION_DEPTH = 10`, navigation aborts immediately.
- Reset to `0` on successful completion.
- Decremented in a `finally` block (via `Math.max(0, depth - 1)`) for all code paths.

### 2. Redirect counter (`redirectCount`)

Separate from navigation depth, this specifically tracks declarative `redirect` chains:

- Incremented each time a route's `redirect` property triggers a follow-up `navigate()`.
- Aborts at `MAX_REDIRECTS = 10`.
- Reset to `0` when a non-redirect navigation succeeds.

These two mechanisms are complementary. Navigation depth catches guard-initiated re-entry;
redirect count catches declarative redirect chains.

---

## Lazy Loading & Code Splitting

Routes can defer child loading via the `lazy` property:

```typescript
{
  path: '/dashboard',
  template: () => html`<dashboard-layout></dashboard-layout>`,
  lazy: () => import('./dashboard-routes.ts').then(m => m.routes)
}
```

### Loading lifecycle

1. `matchURL()` encounters a route with `lazy`.
2. Checks the `WeakMap<RouteConfig, RouteConfig[] | Promise<RouteConfig[]>>` lazy cache.
3. Three possible states:
   - **Cached array** — children already loaded. Record cache hit in stats. Return match.
   - **Cached Promise** — loading in progress. Set `match.loading = true`. Attach `.then(notifyControllers)`.
   - **Not cached** — start loading.
4. On first load:
   - Call `route.lazy()` to get a `Promise<RouteConfig[]>`.
   - Store the Promise in the cache (prevents duplicate loads).
   - On resolve: store the children, recompile routes, rebuild tree and named map.
   - On reject: delete from cache (allows retry).

### Why `WeakMap`?

The cache is keyed on `RouteConfig` **object references**. This means:

- No string key collisions.
- When a route config is removed (e.g., hot reload), its cache entry is GC'd automatically.
- Different route objects with the same `path` string get independent caches.

### Recompilation after lazy load

When lazy children resolve, the router:

1. Calls `compileRoutes(children, parentRoute.fullPath)` to create `CompiledRoute[]`.
2. Appends them to `this.compiledRoutes`.
3. Rebuilds the named routes map (`buildNamedRoutesMap`).
4. Rebuilds the entire trie (`buildRouteTree`).
5. Calls `notifyControllers()` to trigger a re-render (which will now match the children).

---

## History Adapters

The `HistoryAdapter` interface abstracts all navigation state management:

```typescript
interface HistoryAdapter {
  readonly origin: string;
  getCurrentPath(): string;
  getCurrentURL(): string;
  getScrollPosition(): { x: number; y: number };
  pushState(state: any, url: string): void;
  replaceState(state: any, url: string): void;
  back(): void;
  forward(): void;
  onPopState(listener: () => void): () => void;
  onLinkClick(listener: (e: MouseEvent) => void): () => void;
  scrollTo(x: number, y: number): void;
  scrollIntoView(elementId: string): void;
  dispose(): void;
}
```

### `BrowserHistoryAdapter` (default)

Wraps native browser APIs:

| Method | Browser API |
| --- | --- |
| `getCurrentPath()` | `window.location.pathname` |
| `getCurrentURL()` | `window.location.href` |
| `pushState()` | `window.history.pushState()` |
| `replaceState()` | `window.history.replaceState()` |
| `back()` / `forward()` | `window.history.back()` / `forward()` |
| `onPopState()` | `window.addEventListener('popstate')` |
| `onLinkClick()` | `document.addEventListener('click')` |
| `scrollTo()` | `window.scrollTo()` |
| `scrollIntoView()` | `element.scrollIntoView({ behavior: 'smooth' })` |

Event listeners are multiplexed: the adapter registers **one** global `popstate` and **one** global
`click` listener, then fans out to all registered callbacks.

### `MemoryHistoryAdapter`

In-memory history stack with no browser dependencies. Useful for:

- **Chrome extensions** (popup / side panel routing)
- **Service workers**
- **SSR / Node.js**
- **Unit testing**

Internal state:

- `stack: MemoryHistoryEntry[]` — array of `{ state, url }` entries.
- `index: number` — current position in the stack.

`pushState()` truncates forward entries (like the browser), then appends.
`back()` / `forward()` adjust the index and notify listeners.

#### Persistent storage

Accepts an optional `MemoryHistoryStorage` for persisting the current path:

```typescript
interface MemoryHistoryStorage {
  getPath(): string | null;
  setPath(path: string): void;
}
```

Use case: Chrome extension popups lose state when closed. Back the adapter with
`chrome.storage.local` so the user returns to the same route when reopening.

```typescript
const adapter = new MemoryHistoryAdapter({
  storage: {
    getPath: () => localStorage.getItem('route'),
    setPath: (p) => localStorage.setItem('route', p),
  }
});
```

---

## Scroll Restoration

Enabled by default (`scrollRestoration: true` in `RouterConfig`).

### Save

Before each navigation, the current scroll position is saved:

```typescript
this.scrollPositions.set(currentMatch.path, adapter.getScrollPosition());
```

Keyed by path string, stored in a `Map<string, { x, y }>`.

### Restore

After updating the DOM in `doNavigation()`:

1. If the URL has a **hash fragment**: `scrollIntoView(hash)` — smoothly scrolls to the element.
2. If no hash and **not a replace** navigation: `scrollTo(0, 0)` — scroll to top.
3. On `popstate` (back/forward): look up the saved position and `scrollTo(x, y)`.

---

## View Transitions API

Optional, controlled by `useViewTransitions: boolean` in `RouterConfig`.

When enabled and the browser supports `document.startViewTransition()`, the entire
`doNavigation()` closure is wrapped:

```typescript
await document.startViewTransition(doNavigation).finished;
```

This automatically animates between the old and new route views using CSS view transitions.
When not supported or not enabled, `doNavigation()` is called directly.

---

## Animations

Routes can define enter/exit animation callbacks:

```typescript
{
  path: '/dashboard',
  template: () => html`...`,
  animation: {
    enter: async (element) => { /* animate in */ },
    exit:  async (element) => { /* animate out */ }
  }
}
```

Targeted elements must have the `data-route-element` attribute. The router queries
`document.querySelectorAll('[data-route-element]')` and runs the animation callback on each.

### Execution order

1. **Exit animation** on the current route's elements (before setting `currentMatch`).
2. Set `currentMatch = nextMatch`.
3. Wait one animation frame (`requestAnimationFrame`) for the new elements to render.
4. **Enter animation** on the new route's elements.

All animations in each phase are run in parallel via `Promise.all()`.

---

## Prefetching Strategies

Configured via `prefetch: PrefetchConfig` in `RouterConfig`:

```typescript
interface PrefetchConfig {
  strategy:   'hover' | 'visible' | 'idle' | 'manual';
  delay?:     number;    // hover debounce (ms), default 50
  threshold?: number;    // IntersectionObserver threshold (0-1), default 0.1
}
```

### Strategy implementations

| Strategy | Trigger | API Used |
| --- | --- | --- |
| `hover` | Mouse enters an `<a>` tag | `document.addEventListener('mouseover')` with `setTimeout` debounce |
| `visible` | Link scrolls into viewport | `IntersectionObserver` + `MutationObserver` (re-observes on DOM changes) |
| `idle` | Browser is idle | `requestIdleCallback` (fallback: `setTimeout(1000)`) |
| `manual` | Explicit call | `router.preload(path)` or `router.preloadAll()` |

All strategies skip external links (different origin). The `hover` strategy debounces
by the configured `delay` to avoid prefetching during fast mouse movements.

### `preload(path)`

1. Matches the path to find the route.
2. Walks the match chain looking for routes with `lazy`.
3. For each lazy route not yet cached:
   - Loads via `route.lazy()`.
   - Stores in both `lazyCache` and `prefetchCache`.
   - Recompiles routes and rebuilds the tree.

### `preloadAll()`

Finds all compiled routes with a `lazy` property and calls `preload()` on each in parallel.

---

## Error Boundaries

Error boundaries provide graceful error handling with retry logic.

```typescript
interface ErrorBoundary {
  fallback:         RouteTemplate;    // Template to render on error
  onError?:         (error: Error, match: RouteMatch) => void;
  maxRetries?:      number;           // Default: 3
  retrySkipGuards?: boolean;          // Default: false
}
```

### Error handling flow (`handleRouteError`)

1. Match the failed path to find the `RouteMatch`.
2. Search the match `chain` from **innermost to outermost** for the nearest `errorBoundary`.
3. If found:
   - Call `onError` callback (if provided).
   - If `retryCount < maxRetries` (tracked via `options._retryCount`):
     - Retry navigation with `_retryCount + 1`.
     - If `retrySkipGuards` is true, add `skipGuards: true`.
   - If all retries exhausted:
     - Create an error `RouteMatch` with `template = fallback` and `error = Error`.
     - Set as `currentMatch` and notify controllers.
4. If no error boundary found: emit `onNavigateError` and re-throw.

### Cascading search

`findErrorBoundary(chain)` iterates the chain **in reverse** (leaf to root), returning the first
route with an `errorBoundary` property. This allows parent layouts to catch errors from children.

---

## Performance Metrics & Analytics

Enabled by default (`enableMetrics: true`).

### `NavigationTiming`

Recorded after each successful navigation:

```typescript
{
  total:             number;  // Total navigation time
  guards:            number;  // Time in guard execution
  templateRender:    number;  // Time rendering template/component
  animations:        number;  // Time on enter/exit animations
  scrollRestoration: number;  // Time scrolling
  redirect:          number;  // Time processing redirects
  path:              string;  // Target path
  timestamp:         number;  // Date.now()
}
```

Stored in an LRU cache keyed by path. Latest timing overwrites previous for the same path.

### `RouteStats`

Tracked for lazy-loaded routes:

```typescript
{
  path:        string;
  loadTime:    number;    // Bundle load duration (ms)
  bundleSize?: number;    // Bundle size (if available)
  cacheHit:    boolean;   // Whether served from cache
  timestamp:   number;
}
```

### Reporting

Two reporting mechanisms:

1. **Callback** — `reportPerformance: (timing: NavigationTiming) => void` in `RouterConfig`.
   Called after each navigation.
2. **Analytics beacon** — if `analyticsEndpoint` is set, sends JSON via `navigator.sendBeacon()`:

   ```json
   { "type": "navigation", "total": 42, "guards": 5, ... }
   ```

### Aggregation API

```typescript
router.getAggregatedStats()
// → { totalLoads: number, cacheHits: number, averageLoadTime: number }
```

---

## LRU Cache

The `LRUCache<K, V>` class provides bounded-memory caching for metrics and stats.

### Implementation

- Backed by a `Map<K, V>` (which preserves insertion order in JavaScript).
- **Get**: if key exists, delete and re-insert at the end (most recently used).
- **Set**: if at capacity, delete the first key (least recently used). Then insert.
- **Default capacity**: 100 entries (configurable via `maxMetricsEntries`).

### Usage

- `this.timings: LRUCache<string, NavigationTiming>` — navigation timing cache.
- `this.routeStats: LRUCache<string, RouteStats>` — lazy route loading stats.

---

## Lit Integration (RouterController)

`RouterController` implements Lit's `ReactiveController` interface, bridging the router
with Lit components.

```typescript
class RouterController implements ReactiveController {
  constructor(host: ReactiveControllerHost, router: Router, depth = 0);

  hostConnected(): void;     // Registers with router
  hostDisconnected(): void;  // Unregisters from router
  routeChanged(): void;      // Called by router → triggers host.requestUpdate()

  navigate(path, options?): Promise<boolean>;
  navigateByName(name, options?): Promise<boolean>;
  match(path?): RouteMatch | null;       // Delegates to matchAtDepth(this.depth)
  getCurrentPath(): string;
  getDepth(): number;
}
```

### How it works

1. Component creates a `RouterController` in `connectedCallback()`.
2. `hostConnected()` adds the controller to the router's `Set<RouterController>`.
3. After navigation, `notifyControllers()` calls `routeChanged()` on every controller.
4. `routeChanged()` calls `host.requestUpdate()` → Lit re-renders the component.
5. During render, `match()` calls `router.matchAtDepth(depth)` to get the view.

### Depth-based nesting

Each `RouterController` tracks a `depth` (0 = root, 1 = first nested, etc.).
`<router-outlet>` uses Lit context to track depth:

```typescript
// router-outlet.ts
@consume({ context: routerDepthContext })
parentDepth = -1;

@provide({ context: routerDepthContext })
currentDepth = 0;

connectedCallback() {
  this.currentDepth = this.parentDepth + 1;
  this.routerController = new RouterController(this, this.routerInstance, this.currentDepth);
}
```

This allows nested `<router-outlet>` elements to automatically resolve to the correct
depth in the route chain without manual configuration.

---

## Components

### `<router-outlet>`

Renders the matched route at its depth level.

Render priority:

1. Show loading state if `match.loading` is true.
2. Show error state if `match.error` exists.
3. Call `match.template(params)` if template exists.
4. Create `document.createElement(match.component)` if component exists, passing params as properties.
5. Render `<slot>` as fallback.

### `<router-link>`

Declarative navigation link. Properties:

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `to` | `string` | `''` | Target path |
| `name` | `string` | `''` | Target route name (used with navigateByName) |
| `replace` | `boolean` | `false` | Use replaceState |
| `activeClass` | `string` | `'active'` | CSS class when route matches |
| `query` | `Record<string, string>` | — | Query parameters |
| `hash` | `string` | — | Hash fragment |

Intercepts clicks via `@click`, calls `router.navigate()` or `router.navigateByName()`.
Applies the active class when `getCurrentPath() === to`.

### `<router-provider>`

Provides a custom `Router` instance via Lit context. Accepts a `RouterConfig` in its constructor.
Any `<router-outlet>` or `<router-link>` descendant will consume this router instance
instead of the global singleton.

---

## Global Singleton

A global router instance is exported for convenience:

```typescript
export const router: Router = new Router();
```

This uses `BrowserHistoryAdapter` by default. It's consumed by components via `@consume({ context: routerContext })`.
For custom configuration, create a `<router-provider>` or instantiate `new Router(config)` directly.

---

## Anchor Interception

The router automatically intercepts clicks on `<a>` tags (via the history adapter's `onLinkClick`).

Clicks are **ignored** when:

- Modifier keys are held (`meta`, `ctrl`, `shift`, `alt`) — allows "open in new tab".
- It's not a left click (`button !== 0`).
- The link has `target="_blank"`.
- The link has a `download` attribute.
- The link has `rel="external"`.
- The `href` is empty.
- The `href` starts with `http` or `//` (external link).

All other clicks are intercepted: `e.preventDefault()` is called and `navigate(href)` is invoked.
