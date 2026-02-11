import './components/login-page.ts';
import './components/registry-manager.ts';

import { html } from 'lit';

import type { RouteConfig } from './features/router/index.ts';
import { router } from './features/router/index.ts';
import { authService } from './services/auth-service.ts';


export const routes: RouteConfig[] = [
	{
		path:        '/login',
		name:        'login',
		template:    () => html`<login-page></login-page>`,
		beforeEnter: async (): Promise<boolean> => {
			// Allow access to login if not authenticated
			const isAuth = await authService.isAuthenticated();

			// If already authenticated, redirect to dashboard
			if (isAuth) {
				await router.navigate('/');

				return false;
			}

			return true;
		},
	},
	{
		path:        '/',
		name:        'dashboard',
		template:    () => html`<registry-manager></registry-manager>`,
		beforeEnter: async (): Promise<boolean> => {
			// Require authentication for dashboard
			const isAuth = await authService.isAuthenticated();
			if (!isAuth) {
				// Redirect to login
				await router.navigate('/login');

				return false;
			}

			return true;
		},
	},
	{
		path:        '/(.*)',
		name:        'fallback',
		beforeEnter: async (): Promise<boolean> => {
			// Check auth and redirect to appropriate route
			const isAuth = await authService.isAuthenticated();
			await router.navigate(isAuth ? '/' : '/login', { replace: true });

			return false;
		},
	},
];
