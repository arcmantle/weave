import { html } from 'lit';
import { beforeEach, describe, expect, it } from 'vitest';

import type { RouteConfig } from '../router';
import { Router } from '../router';


describe('Router - Error Handling', () => {
	let router: Router;

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>';
		window.history.replaceState(null, '', '/');
	});

	describe('Guard Errors', () => {
		it('should throw errors during navigation guards', async () => {
			router = new Router();
			const routes: RouteConfig[] = [
				{
					path:        '/',
					template:    () => html`<div>Home</div>`,
					beforeEnter: async () => {
						throw new Error('Guard error');
					},
				},
			];
			router.setRoutes(routes);

			await expect(router.navigate('/')).rejects.toThrow('Guard error');
		});

		it('should propagate guard errors to caller', async () => {
			router = new Router();
			const routes: RouteConfig[] = [
				{
					path:        '/protected',
					template:    () => html`<div>Protected</div>`,
					beforeEnter: async () => {
						throw new Error('Access denied');
					},
				},
			];
			router.setRoutes(routes);

			await expect(router.navigate('/protected')).rejects.toThrow('Access denied');
		});
	});
});
