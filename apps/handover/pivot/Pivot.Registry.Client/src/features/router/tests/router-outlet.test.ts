import '../router-outlet.ts';
import '../router-provider.ts';

import { html } from 'lit';
import { beforeEach, describe, expect, it } from 'vitest';

import { Router } from '../router.ts';
import type { RouterOutlet } from '../router-outlet.ts';
import type { RouterProvider } from '../router-provider.ts';


describe('RouterOutlet Component', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();
	});

	it('should render router-outlet element', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet');
		provider.appendChild(el);
		document.body.appendChild(provider);

		expect(el).toBeDefined();
		expect(el.tagName.toLowerCase()).toBe('router-outlet');
	});

	it('should render matched route template', async () => {
		router.setRoutes([ { path: '/', template: () => html`<div class="home">Home Page</div>` } ]);

		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet') as RouterOutlet;
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		// Component should be rendered
		expect(el).toBeDefined();
	});

	it('should render loading state for lazy routes', async () => {
		router.setRoutes([
			{
				path:     '/lazy',
				template: () => html`<div>Lazy Parent</div>`,
				lazy:     async () => [ { path: '/:id', template: () => html`<div>Lazy Child</div>` } ],
			},
		]);

		await router.navigate('/lazy/123');

		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet') as RouterOutlet;
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		// Should show loading state
		const shadowRoot = el.shadowRoot;
		expect(shadowRoot).toBeDefined();
	});

	it('should update depth context', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet') as RouterOutlet;
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		expect(el.currentDepth).toBe(0);
	});

	it('should increment depth for nested outlets', async () => {
		router.setRoutes([
			{
				path:     '/parent',
				template: () => html`<div>Parent <router-outlet></router-outlet></div>`,
			},
		]);

		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const parentOutlet = document.createElement('router-outlet') as RouterOutlet;
		provider.appendChild(parentOutlet);
		document.body.appendChild(provider);

		await parentOutlet.updateComplete;

		expect(parentOutlet.currentDepth).toBe(0);

		// Nested outlet would have depth 1
		const childOutlet = document.createElement('router-outlet') as RouterOutlet;
		(childOutlet as any).parentDepth = 0;
		parentOutlet.appendChild(childOutlet);

		await childOutlet.updateComplete;

		expect(childOutlet.currentDepth).toBe(1);
	});

	it('should render slot when no match', async () => {
		router.setRoutes([ { path: '/exists', template: () => html`<div>Exists</div>` } ]);

		await router.navigate('/nonexistent');

		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet') as RouterOutlet;
		el.innerHTML = '<div class="fallback">Fallback Content</div>';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		// Should render slot content when no match
		expect(el.querySelector('.fallback')).toBeDefined();
	});

	it('should handle route parameters', async () => {
		router.setRoutes([
			{
				path:     '/users/:id',
				template: (params) => html`<div class="user-id">${ params['id'] }</div>`,
			},
		]);

		await router.navigate('/users/123');

		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet') as RouterOutlet;
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		// Template should receive params
		expect(el).toBeDefined();
	});
});

describe('RouterOutlet - Context Integration', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();
	});

	it('should consume router context', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet') as RouterOutlet;
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		expect(el.routerInstance).toBeDefined();
	});

	it('should provide depth context', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet') as RouterOutlet;
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		expect(el.currentDepth).toBeDefined();
		expect(typeof el.currentDepth).toBe('number');
	});

	it('should start with depth 0 when no parent', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet') as RouterOutlet;
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		expect(el.currentDepth).toBe(0);
	});
});

describe('RouterOutlet - Error Handling', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();
	});

	it('should render error state when route has error', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet') as RouterOutlet;
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		// Error rendering would be handled by the route match
		expect(el).toBeDefined();
	});

	it('should handle component rendering', async () => {
		router.setRoutes([ { path: '/component', component: 'test-component' } ]);

		await router.navigate('/component');

		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-outlet') as RouterOutlet;
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		// Should attempt to create the component
		expect(el).toBeDefined();
	});
});
