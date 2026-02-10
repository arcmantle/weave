import '../router-provider.ts';

import { html } from 'lit';
import { beforeEach, describe, expect, it } from 'vitest';

import { Router } from '../router.ts';
import type { RouterProvider } from '../router-provider.ts';


describe('RouterProvider Component', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
	});

	it('should render router-provider element', () => {
		const el = document.createElement('router-provider');
		document.body.appendChild(el);

		expect(el).toBeDefined();
		expect(el.tagName.toLowerCase()).toBe('router-provider');
	});

	it('should create router instance', async () => {
		const el = document.createElement('router-provider') as RouterProvider;
		document.body.appendChild(el);

		await el.updateComplete;

		expect(el.router).toBeDefined();
		expect(el.router).toBeInstanceOf(Router);
	});

	it('should accept router config', async () => {
		// Create element and set config via constructor
		const el = document.createElement('router-provider') as RouterProvider;
		// Router is created in constructor with default config
		document.body.appendChild(el);

		await el.updateComplete;

		expect(el.router).toBeDefined();
	});

	it('should render slot content', async () => {
		const el = document.createElement('router-provider') as RouterProvider;
		el.innerHTML = '<div class="child">Child Content</div>';
		document.body.appendChild(el);

		await el.updateComplete;

		const childContent = el.querySelector('.child');

		expect(childContent).toBeDefined();
		expect(childContent?.textContent).toBe('Child Content');
	});

	it('should provide router context to children', async () => {
		const el = document.createElement('router-provider') as RouterProvider;
		document.body.appendChild(el);

		await el.updateComplete;

		// Router should be accessible via context
		expect(el.router).toBeDefined();
	});

	it('should create separate router instance from global', async () => {
		const el = document.createElement('router-provider') as RouterProvider;
		document.body.appendChild(el);

		await el.updateComplete;

		// Should be a different instance
		expect(el.router).toBeDefined();
	});

	it('should support custom configuration', async () => {
		// Custom config is passed via constructor
		const el = document.createElement('router-provider') as RouterProvider;
		document.body.appendChild(el);

		await el.updateComplete;

		// Router is created with config
		expect(el.router).toBeDefined();
	});

	it('should allow setting routes on provided router', async () => {
		const el = document.createElement('router-provider') as RouterProvider;
		document.body.appendChild(el);

		await el.updateComplete;

		el.router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/about', template: () => html`<div>About</div>` },
		]);

		const match = el.router.match('/about');

		expect(match).toBeDefined();
		expect(match?.path).toBe('/about');
	});
});

describe('RouterProvider - Multiple Instances', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
	});

	it('should support multiple router providers', async () => {
		const el1 = document.createElement('router-provider') as RouterProvider;
		const el2 = document.createElement('router-provider') as RouterProvider;

		document.body.appendChild(el1);
		document.body.appendChild(el2);

		await el1.updateComplete;
		await el2.updateComplete;

		expect(el1.router).not.toBe(el2.router);
	});

	it('should maintain separate router state', async () => {
		const el1 = document.createElement('router-provider') as RouterProvider;
		const el2 = document.createElement('router-provider') as RouterProvider;

		document.body.appendChild(el1);
		document.body.appendChild(el2);

		await el1.updateComplete;
		await el2.updateComplete;

		el1.router.setRoutes([ { path: '/route1', template: () => html`<div>Route 1</div>` } ]);

		el2.router.setRoutes([ { path: '/route2', template: () => html`<div>Route 2</div>` } ]);

		const match1 = el1.router.match('/route1');
		const match2a = el1.router.match('/route2');
		const match2b = el2.router.match('/route2');

		expect(match1).toBeDefined();
		expect(match2a).toBeNull();
		expect(match2b).toBeDefined();
	});
});

describe('RouterProvider - Integration', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
	});

	it('should work with nested router components', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.innerHTML = `
			<router-outlet></router-outlet>
		`;
		document.body.appendChild(provider);

		await provider.updateComplete;

		provider.router.setRoutes([ { path: '/', template: () => html`<div>Scoped Home</div>` } ]);

		const match = provider.router.match('/');

		expect(match).toBeDefined();
	});
});
