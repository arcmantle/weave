import { html } from 'lit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type RouteConfig, Router } from '../router.ts';


describe('Router - Basic Navigation', () => {
	let router: Router;

	beforeEach(() => {
		// Reset DOM
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');

		router = new Router();
	});

	it('should create a router instance', () => {
		expect(router).toBeDefined();
		expect(router).toBeInstanceOf(Router);
	});

	it('should set and compile routes', () => {
		const routes: RouteConfig[] = [
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/about', template: () => html`<div>About</div>` },
		];

		router.setRoutes(routes);
		const match = router.match('/');

		expect(match).toBeDefined();
		expect(match?.path).toBe('/');
	});

	it('should match exact routes', () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/about', template: () => html`<div>About</div>` },
		]);

		const homeMatch = router.match('/');
		const aboutMatch = router.match('/about');

		expect(homeMatch?.path).toBe('/');
		expect(aboutMatch?.path).toBe('/about');
	});

	it('should return null for non-matching routes', () => {
		router.setRoutes([ { path: '/', template: () => html`<div>Home</div>` } ]);

		const match = router.match('/nonexistent');

		expect(match).toBeNull();
	});

	it('should navigate to a route', async () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/about', template: () => html`<div>About</div>` },
		]);

		const result = await router.navigate('/about');

		expect(result).toBe(true);
		expect(window.location.pathname).toBe('/about');
	});

	it('should update history on navigation', async () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/test', template: () => html`<div>Test</div>` },
		]);

		await router.navigate('/test');

		expect(window.location.pathname).toBe('/test');
	});

	it('should support replace navigation', async () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/about', template: () => html`<div>About</div>` },
		]);

		const historyLength = window.history.length;
		await router.navigate('/about', { replace: true });

		expect(window.location.pathname).toBe('/about');
		expect(window.history.length).toBe(historyLength);
	});

	it('should normalize paths', () => {
		router.setRoutes([ { path: '/users/', template: () => html`<div>Users</div>` } ]);

		const match = router.match('/users');

		expect(match).toBeDefined();
		expect(match?.path).toBe('/users');
	});

	it('should get current path', async () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/test', template: () => html`<div>Test</div>` },
		]);

		await router.navigate('/test');

		expect(router.getCurrentPath()).toBe('/test');
	});
});

describe('Router - Route Parameters', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();
	});

	it('should match routes with parameters', () => {
		router.setRoutes([ { path: '/users/:id', template: () => html`<div>User</div>` } ]);

		const match = router.match('/users/123');

		expect(match).toBeDefined();
		expect(match?.params['id']).toBe('123');
	});

	it('should match routes with multiple parameters', () => {
		router.setRoutes([ { path: '/posts/:postId/comments/:commentId', template: () => html`<div>Comment</div>` } ]);

		const match = router.match('/posts/456/comments/789');

		expect(match).toBeDefined();
		expect(match?.params['postId']).toBe('456');
		expect(match?.params['commentId']).toBe('789');
	});

	it('should pass parameters to template function', () => {
		const templateFn = vi.fn(() => html`<div>Test</div>`);
		router.setRoutes([ { path: '/users/:id', template: templateFn } ]);

		const match = router.match('/users/123');
		if (match?.template)
			match.template(match.params);


		expect(templateFn).toHaveBeenCalledWith({ id: '123' });
	});
});

describe('Router - Query Parameters and Hash', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();
	});

	it('should parse query parameters', () => {
		router.setRoutes([ { path: '/', template: () => html`<div>Home</div>` } ]);

		const match = router.match('/?page=1&sort=asc');

		expect(match).toBeDefined();
		expect(match?.query.get('page')).toBe('1');
		expect(match?.query.get('sort')).toBe('asc');
	});

	it('should parse hash fragments', () => {
		router.setRoutes([ { path: '/', template: () => html`<div>Home</div>` } ]);

		const match = router.match('/#section1');

		expect(match).toBeDefined();
		expect(match?.hash).toBe('#section1');
	});

	it('should navigate with query parameters', async () => {
		router.setRoutes([ { path: '/search', template: () => html`<div>Search</div>` } ]);

		await router.navigate('/search', { query: { q: 'test', filter: 'active' } });

		expect(window.location.pathname).toBe('/search');
		expect(window.location.search).toContain('q=test');
		expect(window.location.search).toContain('filter=active');
	});

	it('should navigate with hash', async () => {
		router.setRoutes([ { path: '/docs', template: () => html`<div>Docs</div>` } ]);

		await router.navigate('/docs', { hash: 'section2' });

		expect(window.location.pathname).toBe('/docs');
		expect(window.location.hash).toBe('#section2');
	});
});

describe('Router - Nested Routes', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();
	});

	it('should support nested routes', () => {
		router.setRoutes([
			{
				path:     '/users',
				template: () => html`<div>Users Layout</div>`,
				children: [
					{ path: ':id', template: () => html`<div>User Detail</div>` },
					{ path: ':id/posts', template: () => html`<div>User Posts</div>` },
				],
			},
		]);

		const match = router.match('/users/123');

		expect(match).toBeDefined();
		expect(match?.params['id']).toBe('123');
	});

	it('should build route chain for nested routes', () => {
		router.setRoutes([
			{
				path:     '/users',
				template: () => html`<div>Users</div>`,
				children: [ { path: ':id', template: () => html`<div>User</div>` } ],
			},
		]);

		const match = router.match('/users/123');

		expect(match?.chain).toBeDefined();
		expect(match?.chain.length).toBeGreaterThan(0);
	});

	it('should match at specific depth', () => {
		router.setRoutes([
			{
				path:     '/dashboard',
				template: () => html`<div>Dashboard</div>`,
				children: [
					{
						path:     'settings',
						template: () => html`<div>Settings</div>`,
						children: [ { path: 'profile', template: () => html`<div>Profile</div>` } ],
					},
				],
			},
		]);

		const match = router.matchAtDepth(0, '/dashboard/settings/profile');

		expect(match).toBeDefined();
	});
});

describe('Router - Wildcards', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();
	});

	it('should match wildcard routes', () => {
		router.setRoutes([ { path: '/files/*', template: () => html`<div>Files</div>` } ]);

		const match = router.match('/files/documents/report.pdf');

		expect(match).toBeDefined();
	});

	it('should prioritize exact matches over wildcards', () => {
		router.setRoutes([
			{ path: '/users/new', template: () => html`<div>New User</div>`, name: 'new-user' },
			{ path: '/users/*', template: () => html`<div>User Files</div>`, name: 'user-files' },
		]);

		const exactMatch = router.match('/users/new');
		const wildcardMatch = router.match('/users/123/profile');

		expect(exactMatch?.name).toBe('new-user');
		expect(wildcardMatch?.name).toBe('user-files');
	});

	it('should prioritize params over wildcards', () => {
		router.setRoutes([
			{ path: '/posts/:id', template: () => html`<div>Post</div>`, name: 'post' },
			{ path: '/posts/*', template: () => html`<div>Posts Catch All</div>`, name: 'posts-all' },
		]);

		const paramMatch = router.match('/posts/123');

		expect(paramMatch?.name).toBe('post');
	});
});

describe('Router - Named Routes', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();
	});

	it('should support named routes', () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>`, name: 'home' },
			{ path: '/about', template: () => html`<div>About</div>`, name: 'about' },
		]);

		const match = router.match('/about');

		expect(match?.name).toBe('about');
	});

	it('should navigate by route name', async () => {
		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>`, name: 'home' },
			{ path: '/profile', template: () => html`<div>Profile</div>`, name: 'profile' },
		]);

		const result = await router.navigateByName('profile');

		expect(result).toBe(true);
		expect(window.location.pathname).toBe('/profile');
	});

	it('should return false for non-existent named route', async () => {
		router.setRoutes([ { path: '/', template: () => html`<div>Home</div>`, name: 'home' } ]);

		const result = await router.navigateByName('nonexistent');

		expect(result).toBe(false);
	});
});

describe('Router - Route Metadata', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();
	});

	it('should attach metadata to routes', () => {
		router.setRoutes([
			{
				path:     '/admin',
				template: () => html`<div>Admin</div>`,
				metadata: { requiresAuth: true, role: 'admin' },
			},
		]);

		const match = router.match('/admin');

		expect(match?.metadata).toBeDefined();
		expect(match?.metadata?.['requiresAuth']).toBe(true);
		expect(match?.metadata?.['role']).toBe('admin');
	});

	it('should preserve metadata through navigation', async () => {
		router.setRoutes([
			{
				path:     '/dashboard',
				template: () => html`<div>Dashboard</div>`,
				metadata: { title: 'Dashboard', icon: 'chart' },
			},
		]);

		await router.navigate('/dashboard');
		const match = router.match('/dashboard');

		expect(match?.metadata?.['title']).toBe('Dashboard');
		expect(match?.metadata?.['icon']).toBe('chart');
	});
});


describe('Router - isActive', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');

		router = new Router();
		router.setRoutes([
			{ path: '/',         template: () => html`<div>Home</div>` },
			{ path: '/browse',   template: () => html`<div>Browse</div>` },
			{ path: '/browse/:id', template: () => html`<div>Detail</div>` },
			{ path: '/admin',    template: () => html`<div>Admin</div>` },
		]);
	});

	it('should return true for exact root match', async () => {
		await router.navigate('/');
		expect(router.isActive('/')).toBe(true);
	});

	it('should return false for root when on another path', async () => {
		await router.navigate('/browse');
		expect(router.isActive('/')).toBe(false);
	});

	it('should return true for exact path match', async () => {
		await router.navigate('/browse');
		expect(router.isActive('/browse')).toBe(true);
	});

	it('should return true for prefix match on child routes', async () => {
		await router.navigate('/browse/123');
		expect(router.isActive('/browse')).toBe(true);
	});

	it('should return false for unrelated paths', async () => {
		await router.navigate('/browse');
		expect(router.isActive('/admin')).toBe(false);
	});

	it('should not false-positive on partial path segments', async () => {
		await router.navigate('/browse');
		expect(router.isActive('/bro')).toBe(false);
	});
});
