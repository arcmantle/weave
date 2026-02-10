# Pivot Router

A production-grade client-side router for Lit web component applications. Built on the native [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) API with trie-based route matching, navigation guards, lazy loading, performance metrics, prefetching, and more.

> **147 tests** across 10 test suites. Zero external routing dependencies.

---

## Quick Start

### 1. Import

```typescript
import { router, type RouteConfig } from './features/router';
```

### 2. Define Routes

```typescript
import { html } from 'lit';

router.setRoutes([
  { path: '/',          template: () => html`<app-home></app-home>` },
  { path: '/users/:id', template: (params) => html`<user-page .userId=${params['id']}></user-page>` },
  { path: '/about',     template: () => html`<about-page></about-page>` },
]);
```

### 3. Render

```html
<router-outlet></router-outlet>
```

That's it. The global `router` instance handles anchor interception, popstate events, and scroll restoration automatically.

---

## Table of Contents

- [Installation](#installation)
- [Architecture](#architecture)
- [Route Configuration](#route-configuration)
- [Navigation](#navigation)
- [Components](#components)
- [Route Guards](#route-guards)
- [Lazy Loading & Code Splitting](#lazy-loading--code-splitting)
- [Nested Routes](#nested-routes)
- [Named Routes](#named-routes)
- [Redirects](#redirects)
- [Animations & Transitions](#animations--transitions)
- [Navigation Events](#navigation-events)
- [Error Boundaries](#error-boundaries)
- [Multiple Router Instances](#multiple-router-instances)
- [Performance Metrics](#performance-metrics)
- [Prefetching](#prefetching)
- [Code Splitting Statistics](#code-splitting-statistics)
- [RouterController](#routercontroller)
- [API Reference](#api-reference)
- [File Structure](#file-structure)

---

## Installation

No separate install required — the router is part of the Pivot feature set. Import from the barrel export:

```typescript
import {
  router,           // Global singleton instance
  Router,           // Class (for creating additional instances)
  RouterController, // Lit ReactiveController
  type RouteConfig,
  type RouteMatch,
  type RouterConfig,
  type NavigationOptions,
  type NavigationTiming,
  type RouteStats,
} from './features/router';
```

**Peer dependencies:** `lit` (3.x), `@lit/context`

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  router.ts          Core engine, all routing logic   │
│    ├─ Router             Main class                  │
│    ├─ RouterController   Lit ReactiveController      │
│    ├─ LRUCache           Memory-bounded cache        │
│    └─ router             Global singleton            │
├──────────────────────────────────────────────────────┤
│  router-outlet.ts   <router-outlet> component        │
│  router-link.ts     <router-link> component          │
│  router-provider.ts <router-provider> component      │
│  index.ts           Barrel export                    │
├──────────────────────────────────────────────────────┤
│  tests/             10 test files, 147 tests         │
└──────────────────────────────────────────────────────┘
```

Key design decisions:
- **`URLPattern` native API** — no `path-to-regexp` dependency.
- **Trie-based route tree** with priority scoring (exact > param > wildcard).
- **`WeakMap` lazy caches** — garbage-collected when route configs are removed.
- **LRU caches** for metrics and stats — bounded memory with configurable max size.
- **Lit Context** for dependency injection across component trees.

---

## Route Configuration

A route is defined with the `RouteConfig` interface:

```typescript
interface RouteConfig {
  path:           string;                   // URLPattern path string
  template?:      (params) => TemplateResult; // Lit template renderer
  component?:     string;                   // Custom element tag name (alternative to template)
  children?:      RouteConfig[];            // Static nested routes
  lazy?:          () => Promise<RouteConfig[]>; // Dynamic nested routes
  name?:          string;                   // Route name for navigateByName()
  redirect?:      string;                   // Redirect target path
  beforeEnter?:   RouteGuard;               // Enter guard
  canDeactivate?: RouteGuard;               // Leave guard
  metadata?:      Record<string, any>;      // Arbitrary route data
  animation?:     RouteAnimation;           // Enter/exit animations
  errorBoundary?: ErrorBoundary;            // Error handling config
}
```

### Template vs Component

You can render routes with either a template function or a component tag name:

```typescript
// Template function — receives matched params, returns TemplateResult
{ path: '/users/:id', template: (params) => html`<user-page .userId=${params['id']}></user-page>` }

// Component tag name — element is created and params are set as properties
{ path: '/users/:id', component: 'user-page' }
```

Template functions are preferred as they give you full control over property binding.

### Path Patterns

Paths use the native [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) syntax:

```typescript
{ path: '/' }                // Exact match
{ path: '/users/:id' }      // Named parameter
{ path: '/files/*' }        // Wildcard
{ path: '/docs/:section/*' } // Mixed
```

---

## Navigation

### Programmatic

```typescript
// Basic navigation
await router.navigate('/users/42');

// With query parameters
await router.navigate('/search', { query: { q: 'hello', page: '1' } });

// With hash fragment
await router.navigate('/docs', { hash: 'section-3' });

// Replace history (no back button entry)
await router.navigate('/login', { replace: true });

// Pass state data
await router.navigate('/checkout', { state: { cartId: 'abc' } });

// Skip guards
await router.navigate('/admin', { skipGuards: true });

// By route name
await router.navigateByName('user-profile');
```

`navigate()` returns a `Promise<boolean>` — `true` if navigation succeeded, `false` if blocked by a guard or no match was found.

### Anchor Interception

The router automatically intercepts clicks on `<a>` elements for internal links. The following are **not** intercepted:
- External links (`http://...`, `//...`)
- Links with `target="_blank"`
- Links with `download` attribute
- Links with `rel="external"`
- Clicks with modifier keys (Ctrl, Meta, Shift, Alt)
- Non-left-button clicks

### Popstate

Back/forward browser navigation is handled automatically via the `popstate` event, with scroll position restoration if enabled.

---

## Components

### `<router-outlet>`

Renders the matched route's template at the current depth. Falls back to slot content when no route matches.

```html
<router-outlet>
  <p>No page found.</p> <!-- Fallback content -->
</router-outlet>
```

Built-in states:
- **Loading** — shown while lazy routes are loading.
- **Error** — shown when a route match has an error.
- **Slot fallback** — rendered when no route matches.

### `<router-link>`

Declarative navigation link with active state tracking.

```html
<!-- Path-based -->
<router-link to="/about">About</router-link>

<!-- Named route -->
<router-link name="user-profile">Profile</router-link>

<!-- With query and hash -->
<router-link to="/search" .query=${{ q: 'hello' }} hash="results">Search</router-link>

<!-- Replace instead of push -->
<router-link to="/login" replace>Login</router-link>

<!-- Custom active class -->
<router-link to="/about" activeClass="nav-active">About</router-link>
```

When the link's `to` path matches the current path, the anchor element receives the `activeClass` (default: `"active"`).

### `<router-provider>`

Creates a scoped router instance and provides it to all child components via Lit Context. See [Multiple Router Instances](#multiple-router-instances).

```html
<router-provider>
  <router-outlet></router-outlet>
</router-provider>
```

---

## Route Guards

Guards run before navigation completes. Return `false` (or a `Promise<false>`) to block.

```typescript
type RouteGuard = (to: RouteMatch, from: RouteMatch | null) => boolean | Promise<boolean>;
```

### `beforeEnter`

Runs before entering a route. Use for authentication, permission checks, or data validation.

```typescript
{
  path: '/admin',
  template: () => html`<admin-panel></admin-panel>`,
  beforeEnter: async (to, from) => {
    const user = await getUser();
    return user.isAdmin;
  },
}
```

### `canDeactivate`

Runs before leaving a route. Use for unsaved-changes warnings.

```typescript
{
  path: '/editor',
  template: () => html`<doc-editor></doc-editor>`,
  canDeactivate: (to, from) => {
    if (hasUnsavedChanges()) {
      return confirm('Discard unsaved changes?');
    }
    return true;
  },
}
```

Guards are skipped when `{ skipGuards: true }` is passed in navigation options.

---

## Lazy Loading & Code Splitting

Load child routes on demand with the `lazy` property. Results are cached using a `WeakMap` keyed on the route config object.

```typescript
{
  path: '/dashboard',
  template: () => html`<dashboard-shell></dashboard-shell>`,
  lazy: async () => {
    const module = await import('./dashboard-routes.ts');
    return module.routes;
  },
}
```

While the lazy function is pending, the `RouteMatch` will have `loading: true`, and `<router-outlet>` will display its loading state.

---

## Nested Routes

Define child routes with `children` for multi-level layouts. Each `<router-outlet>` tracks its depth automatically via Lit Context.

```typescript
router.setRoutes([
  {
    path: '/app',
    template: () => html`
      <app-shell>
        <router-outlet></router-outlet>  <!-- Depth 1 -->
      </app-shell>
    `,
    children: [
      { path: '/dashboard', template: () => html`<dashboard-page></dashboard-page>` },
      { path: '/settings',  template: () => html`<settings-page></settings-page>` },
    ],
  },
]);
```

The outer `<router-outlet>` renders at depth 0, any nested outlet inside the matched template renders at depth 1, and so on.

---

## Named Routes

Assign names to routes for decoupled navigation:

```typescript
router.setRoutes([
  { path: '/',          template: () => html`<home></home>`,    name: 'home' },
  { path: '/users/:id', template: (p) => html`<user></user>`, name: 'user' },
]);

// Navigate by name
await router.navigateByName('home');
```

`<router-link>` also supports the `name` attribute:

```html
<router-link name="home">Home</router-link>
```

---

## Redirects

Declarative redirects with loop protection (max 10 redirects):

```typescript
router.setRoutes([
  { path: '/old-path', redirect: '/new-path' },
  { path: '/new-path', template: () => html`<new-page></new-page>` },
]);
```

Redirects use `replace` history by default to avoid polluting the back stack.

---

## Animations & Transitions

### JavaScript Animations

Attach enter/exit animation callbacks to individual routes:

```typescript
{
  path: '/gallery',
  template: () => html`<gallery-page data-route-element></gallery-page>`,
  animation: {
    enter: async (el) => {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }).finished;
    },
    exit: async (el) => {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished;
    },
  },
}
```

Elements must have the `data-route-element` attribute to be targeted by animation callbacks.

### View Transitions API

Enable the native [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) for cross-route transitions:

```typescript
const router = new Router({
  useViewTransitions: true,
});
```

Falls back to instant navigation in browsers that don't support it.

---

## Navigation Events

Subscribe to lifecycle events for logging, analytics, loading indicators, etc. Each listener returns an unsubscribe function.

```typescript
// Before guards run
const off1 = router.onBeforeNavigate((event) => {
  console.log(`Navigating from ${event.from?.path} to ${event.to.path}`);
});

// After guards pass, before DOM update
const off2 = router.onNavigateStart((event) => {
  showLoadingBar();
});

// After navigation completes
const off3 = router.onNavigateEnd((event) => {
  hideLoadingBar();
  analytics.track('pageview', { path: event.to.path });
});

// On navigation error
const off4 = router.onNavigateError((event) => {
  reportError(event.error);
});

// Unsubscribe when done
off1();
```

---

## Error Boundaries

Attach error handling config to routes. When a navigation error occurs, the router walks up the route chain looking for the nearest error boundary.

```typescript
{
  path: '/app',
  template: () => html`<app-shell><router-outlet></router-outlet></app-shell>`,
  errorBoundary: {
    fallback: (params) => html`<error-page></error-page>`,
    onError: (error, match) => reportError(error),
    maxRetries: 3,
    retrySkipGuards: false,
  },
}
```

| Property | Type | Default | Description |
|---|---|---|---|
| `fallback` | `RouteTemplate` | — | Template rendered on error |
| `onError` | `(error, match) => void` | — | Error callback |
| `maxRetries` | `number` | `3` | Retry attempts before showing fallback |
| `retrySkipGuards` | `boolean` | `false` | Skip guards on retry |

---

## Multiple Router Instances

The default export `router` is a global singleton. For scoped routing (micro-frontends, isolated widgets), use `<router-provider>`:

```html
<!-- Each provider creates an independent Router instance -->
<router-provider id="main">
  <nav>
    <router-link to="/home">Home</router-link>
  </nav>
  <router-outlet></router-outlet>
</router-provider>

<router-provider id="sidebar">
  <router-outlet></router-outlet>
</router-provider>
```

All child `<router-outlet>` and `<router-link>` components automatically consume the nearest ancestor's router via Lit Context. No manual wiring needed.

You can also create a `Router` instance programmatically:

```typescript
const myRouter = new Router({ basePath: '/widget' });
myRouter.setRoutes([...]);
```

---

## Performance Metrics

When `enableMetrics` is `true` (the default), every navigation records detailed timing breakdowns.

### Configuration

```typescript
const router = new Router({
  enableMetrics: true,
  maxMetricsEntries: 100, // LRU cache size

  // Callback for each navigation
  reportPerformance: (timing) => {
    console.log(`Navigation to ${timing.path}: ${timing.total.toFixed(1)}ms`);
  },

  // Send via navigator.sendBeacon()
  analyticsEndpoint: '/api/analytics',
});
```

### NavigationTiming

Each recorded timing contains:

| Field | Description |
|---|---|
| `total` | Total navigation time (ms) |
| `guards` | Time spent running guards |
| `templateRender` | Template rendering time |
| `animations` | Animation/transition time |
| `scrollRestoration` | Scroll restoration time |
| `redirect` | Redirect processing time |
| `path` | Route path |
| `timestamp` | When navigation occurred |

### API

```typescript
router.getTimings();      // All NavigationTiming[]
router.getLastTiming();   // Most recent NavigationTiming
router.clearTimings();    // Clear all
```

---

## Prefetching

Preload lazy route bundles before the user navigates, for faster page transitions.

### Configuration

```typescript
const router = new Router({
  prefetch: {
    strategy: 'hover',  // 'hover' | 'visible' | 'idle' | 'manual'
    delay: 50,          // Hover delay in ms (hover strategy only)
    threshold: 0.1,     // IntersectionObserver threshold (visible strategy only)
  },
});
```

### Strategies

| Strategy | Behavior |
|---|---|
| `hover` | Prefetch when user hovers a link. Debounced by `delay` ms. |
| `visible` | Prefetch when a link enters the viewport via `IntersectionObserver`. Re-observes on DOM mutations. |
| `idle` | Prefetch all lazy routes during browser idle time via `requestIdleCallback` (falls back to `setTimeout`). |
| `manual` | No automatic prefetching. Call `router.preload(path)` explicitly. |

### Manual Prefetch API

```typescript
await router.preload('/dashboard');  // Preload a specific path
await router.preloadAll();           // Preload all lazy routes
```

---

## Code Splitting Statistics

Track load performance of lazy routes. Stats are stored in a bounded LRU cache alongside metrics.

```typescript
router.getRouteStats();          // All RouteStats[]
router.getStats('/dashboard');   // Most recent stats for a path
router.clearStats();             // Clear all

router.getAggregatedStats();
// → { totalLoads: 12, cacheHits: 4, averageLoadTime: 45.2 }
```

### RouteStats

| Field | Description |
|---|---|
| `path` | Route path |
| `loadTime` | Time to load in ms |
| `bundleSize` | Bundle size in bytes (if available) |
| `cacheHit` | Whether served from cache |
| `timestamp` | When loaded |

---

## RouterController

`RouterController` is a Lit `ReactiveController` that binds a component to the router. It handles subscription/unsubscription in `hostConnected` / `hostDisconnected` and triggers `requestUpdate()` when the route changes.

```typescript
import { LitElement, html } from 'lit';
import { Router, RouterController } from './features/router';

class MyView extends LitElement {
  private ctrl = new RouterController(this, router, /* depth */ 0);

  render() {
    const match = this.ctrl.match();
    if (!match) return html`<p>Not found</p>`;
    return match.template?.(match.params) ?? html``;
  }
}
```

### Methods

| Method | Returns | Description |
|---|---|---|
| `navigate(path, options?)` | `Promise<boolean>` | Navigate programmatically |
| `navigateByName(name, options?)` | `Promise<boolean>` | Navigate by route name |
| `match(path?)` | `RouteMatch \| null` | Get the match at this controller's depth |
| `getCurrentPath()` | `string` | Current `window.location.pathname` |
| `getDepth()` | `number` | This controller's depth level |

---

## API Reference

### `Router`

#### Constructor

```typescript
new Router(config?: RouterConfig)
```

| Option | Type | Default | Description |
|---|---|---|---|
| `basePath` | `string` | `''` | URL prefix for all routes |
| `scrollRestoration` | `boolean` | `true` | Save/restore scroll positions |
| `useViewTransitions` | `boolean` | `false` | Use View Transitions API |
| `fallbackRoute` | `RouteConfig` | — | 404 fallback route |
| `enableMetrics` | `boolean` | `true` | Record navigation timings |
| `reportPerformance` | `(timing) => void` | — | Callback per navigation |
| `analyticsEndpoint` | `string` | — | `sendBeacon` URL |
| `maxMetricsEntries` | `number` | `100` | LRU cache capacity |
| `prefetch` | `PrefetchConfig` | — | Prefetch strategy |

#### Route Management

| Method | Description |
|---|---|
| `setRoutes(routes: RouteConfig[])` | Set the route table (replaces existing) |
| `match(path?: string)` | Match a path (or current URL) against routes |
| `matchAtDepth(depth, path?)` | Match at a specific nesting depth |

#### Navigation

| Method | Description |
|---|---|
| `navigate(path, options?)` | Navigate to a path |
| `navigateByName(name, options?)` | Navigate by route name |
| `getCurrentPath()` | Get `window.location.pathname` |

#### Events

| Method | Description |
|---|---|
| `onBeforeNavigate(listener)` | Before guards run |
| `onNavigateStart(listener)` | After guards, before DOM update |
| `onNavigateEnd(listener)` | After navigation completes |
| `onNavigateError(listener)` | On navigation error |

All return `() => void` (unsubscribe function).

#### Metrics & Stats

| Method | Description |
|---|---|
| `getTimings()` | All recorded `NavigationTiming[]` |
| `getLastTiming()` | Most recent timing |
| `clearTimings()` | Clear timing data |
| `getRouteStats()` | All recorded `RouteStats[]` |
| `getStats(path)` | Most recent stats for a path |
| `getAggregatedStats()` | `{ totalLoads, cacheHits, averageLoadTime }` |
| `clearStats()` | Clear stats data |

#### Prefetch

| Method | Description |
|---|---|
| `preload(path)` | Preload lazy routes for a path |
| `preloadAll()` | Preload all lazy routes |

---

## File Structure

```
features/router/
├── index.ts              Barrel export
├── router.ts             Core: Router, RouterController, LRUCache, types
├── router-outlet.ts      <router-outlet> web component
├── router-link.ts        <router-link> web component
├── router-provider.ts    <router-provider> web component
├── README.md             This file
└── tests/
    ├── router.test.ts             Core routing (matching, params, navigation)
    ├── router-basepath.test.ts    Base path handling
    ├── router-context.test.ts     Lit Context integration
    ├── router-controller.test.ts  RouterController lifecycle
    ├── router-errors.test.ts      Error handling & guards
    ├── router-guards.test.ts      beforeEnter & canDeactivate
    ├── router-lazy.test.ts        Lazy loading & code splitting
    ├── router-link.test.ts        <router-link> component
    ├── router-metrics.test.ts     Performance metrics & analytics
    ├── router-outlet.test.ts      <router-outlet> component
    ├── router-prefetch.test.ts    Prefetching strategies
    ├── router-provider.test.ts    <router-provider> & multi-instance
    └── router-stats.test.ts       Code splitting statistics
```
