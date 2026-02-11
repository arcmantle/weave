import './components/login-page.ts';
import './components/plugin-admin.ts';
import './components/plugin-browse.ts';
import './components/plugin-detail.ts';
import './components/plugin-explorer.ts';
import './components/registry-manager.ts';

import { html } from 'lit';

import type { RouteConfig } from './features/router/index.ts';
import { router } from './features/router/index.ts';
import { authService } from './services/auth-service.ts';
import { configService } from './services/config-service.ts';


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
		/** Allow access in public mode or when authenticated; redirect to /login otherwise. */
		beforeEnter: async (): Promise<boolean> => {
			const isPublic = await configService.isPublic();
			if (isPublic)
				return true;

			const isAuth = await authService.isAuthenticated();
			if (!isAuth) {
				await router.navigate('/login');

				return false;
			}

			return true;
		},
	},
	{
		path:      '/browse',
		name:      'browse',
		template:  () => html`<plugin-browse></plugin-browse>`,
		reuseFrom: {
			name:       'dashboard',
			properties: [ 'beforeEnter' ],
		},
	},
	{
		path:      '/plugin/:name',
		name:      'plugin-detail',
		template:  (params) => html`<plugin-detail .name=${ params['name'] ?? '' }></plugin-detail>`,
		reuseFrom: {
			name:       'dashboard',
			properties: [ 'beforeEnter' ],
		},
	},
	{
		path:      '/explore',
		name:      'explore',
		template:  (params) => html`<plugin-explorer .name=${ params['name'] ?? '' }></plugin-explorer>`,
		reuseFrom: {
			name:       'dashboard',
			properties: [ 'beforeEnter' ],
		},
	},
	{
		path:      '/explore/:name',
		name:      'explore-detail',
		reuseFrom: [
			{
				name:       'dashboard',
				properties: [ 'beforeEnter' ],
			},
			{
				name:       'explore',
				properties: [ 'template' ],
			},
		],
	},
	{
		path:        '/admin',
		name:        'admin',
		template:    () => html`<plugin-admin></plugin-admin>`,
		/** Require authentication regardless of public/private mode. */
		beforeEnter: async (): Promise<boolean> => {
			const isAuth = await authService.isAuthenticated();
			if (!isAuth) {
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
			const isPublic = await configService.isPublic();
			const isAuth = await authService.isAuthenticated();

			// In public mode, always go to dashboard
			if (isPublic) {
				await router.navigate('/', { replace: true });

				return false;
			}

			// In private mode, redirect based on auth state
			await router.navigate(isAuth ? '/' : '/login', { replace: true });

			return false;
		},
	},
];
