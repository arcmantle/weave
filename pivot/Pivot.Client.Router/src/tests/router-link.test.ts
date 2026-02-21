import '../router-link.js';
import '../router-provider.js';

import { html } from 'lit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Router } from '../router.js';
import type { RouterLink } from '../router-link.js';
import type { RouterProvider } from '../router-provider.js';


describe('RouterLink Component', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();

		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>`, name: 'home' },
			{ path: '/about', template: () => html`<div>About</div>`, name: 'about' },
			{ path: '/contact', template: () => html`<div>Contact</div>`, name: 'contact' },
		]);
	});

	it('should render router-link element', () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link');
		provider.appendChild(el);
		document.body.appendChild(provider);

		expect(el).toBeDefined();
		expect(el.tagName.toLowerCase()).toBe('router-link');
	});

	it('should render with href attribute', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/about';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');

		expect(anchor).toBeDefined();
		expect(anchor?.getAttribute('href')).toBe('/about');
	});

	it('should navigate on click', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/about';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');
		const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

		anchor?.dispatchEvent(clickEvent);

		// Wait for async navigation
		await new Promise(resolve => setTimeout(resolve, 50));

		expect(window.location.pathname).toBe('/about');
	});

	it('should support named routes', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.name = 'contact';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');
		const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

		anchor?.dispatchEvent(clickEvent);

		await new Promise(resolve => setTimeout(resolve, 50));

		expect(window.location.pathname).toBe('/contact');
	});

	it('should add active class when route matches', async () => {
		await router.navigate('/about');

		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/about';
		el.activeClass = 'active';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');

		expect(anchor?.classList.contains('active')).toBe(true);
	});

	it('should not have active class when route does not match', async () => {
		await router.navigate('/');

		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/about';
		el.activeClass = 'active';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');

		expect(anchor?.classList.contains('active')).toBe(false);
	});

	it('should support custom active class name', async () => {
		await router.navigate('/about');

		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/about';
		el.activeClass = 'custom-active';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');

		expect(anchor?.classList.contains('custom-active')).toBe(true);
	});

	it('should render slot content', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/about';
		el.innerHTML = '<span class="link-text">About Page</span>';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const slotContent = el.querySelector('.link-text');

		expect(slotContent).toBeDefined();
		expect(slotContent?.textContent).toBe('About Page');
	});

	it('should support query parameters', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/about';
		el.query = { foo: 'bar', baz: 'qux' };
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');
		const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

		anchor?.dispatchEvent(clickEvent);

		await new Promise(resolve => setTimeout(resolve, 50));

		expect(window.location.search).toContain('foo=bar');
		expect(window.location.search).toContain('baz=qux');
	});

	it('should support hash fragments', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/about';
		el.hash = 'section1';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');
		const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

		anchor?.dispatchEvent(clickEvent);

		await new Promise(resolve => setTimeout(resolve, 50));

		expect(window.location.hash).toBe('#section1');
	});

	it('should support replace navigation', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/about';
		el.replace = true;
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const historyLength = window.history.length;

		const anchor = el.shadowRoot?.querySelector('a');
		const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

		anchor?.dispatchEvent(clickEvent);

		await new Promise(resolve => setTimeout(resolve, 50));

		expect(window.history.length).toBeLessThanOrEqual(historyLength);
	});

	it('should prevent default click behavior', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/about';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');
		const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
		const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

		anchor?.dispatchEvent(clickEvent);

		expect(preventDefaultSpy).toHaveBeenCalled();
	});
});

describe('RouterLink - Context Integration', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();

		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/test', template: () => html`<div>Test</div>` },
		]);
	});

	it('should consume router context', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/test';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		expect(el.routerInstance).toBeDefined();
	});

	it('should use provided router instance', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/test';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		expect(el.routerInstance).toBe(router);
	});
});

describe('RouterLink - Edge Cases', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.history.replaceState(null, '', '/');
		router = new Router();

		router.setRoutes([
			{ path: '/', template: () => html`<div>Home</div>` },
			{ path: '/test', template: () => html`<div>Test</div>` },
		]);
	});

	it('should handle empty to attribute', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');

		expect(anchor?.getAttribute('href')).toBe('');
	});

	it('should handle both query and hash together', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		el.to = '/test';
		el.query = { page: '1' };
		el.hash = 'top';
		provider.appendChild(el);
		document.body.appendChild(provider);

		await el.updateComplete;

		const anchor = el.shadowRoot?.querySelector('a');
		const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

		anchor?.dispatchEvent(clickEvent);

		await new Promise(resolve => setTimeout(resolve, 50));

		expect(window.location.search).toContain('page=1');
		expect(window.location.hash).toBe('#top');
	});

	it('should render without router controller initially', async () => {
		const provider = document.createElement('router-provider') as RouterProvider;
		provider.router = router;
		const el = document.createElement('router-link') as RouterLink;
		provider.appendChild(el);
		document.body.appendChild(provider);

		// Before connectedCallback
		await el.updateComplete;

		expect(el).toBeDefined();
	});
});
