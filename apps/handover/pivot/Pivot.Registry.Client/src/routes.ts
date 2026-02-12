import './components/app-layout.ts';
import './components/login-page.ts';
import './components/plugin-admin.ts';
import './components/plugin-browse.ts';
import './components/plugin-detail.ts';
import './components/plugin-explorer.ts';
import './components/registry-manager.ts';

import { html } from 'lit';

import type { RouteAnimation, RouteConfig } from './features/router/index.ts';
import { defineRoute, router } from './features/router/index.ts';
import { authService } from './services/auth-service.ts';
import { configService } from './services/config-service.ts';


/** Slide animation used for child route transitions. */
const slideTransition: RouteAnimation = {
	enter: (el) => {
		return new Promise<void>((resolve) => {
			const anim = el.animate(
				[
					{ transform: 'translateX(-30px)', opacity: 0 },
					{ transform: 'translateX(0)',     opacity: 1 },
				],
				{
					duration: 200,
					easing:   'ease-out',
					fill:     'forwards',
				},
			);
			anim.onfinish = () => resolve();
		});
	},
	exit: (el) => {
		return new Promise<void>((resolve) => {
			const anim = el.animate(
				[
					{ transform: 'translateX(0)',    opacity: 1 },
					{ transform: 'translateX(30px)', opacity: 0 },
				],
				{
					duration: 150,
					easing:   'ease-in',
				},
			);
			anim.onfinish = () => resolve();
		});
	},
};


/** Allow access in public mode or when authenticated; redirect to /login otherwise. */
const requireAccessGuard = async (): Promise<boolean> => {
	const isPublic = await configService.isPublic();
	if (isPublic)
		return true;

	const isAuth = await authService.isAuthenticated();
	if (!isAuth) {
		await router.navigate('/login');

		return false;
	}

	return true;
};

/** Require authentication regardless of public/private mode. */
const requireAuthGuard = async (): Promise<boolean> => {
	const isAuth = await authService.isAuthenticated();
	if (!isAuth) {
		await router.navigate('/login');

		return false;
	}

	return true;
};


export const routes: RouteConfig[] = [
	defineRoute({
		path:        '/login',
		name:        'login',
		template:    () => html`<login-page></login-page>`,
		beforeEnter: async (): Promise<boolean> => {
			const isAuth = await authService.isAuthenticated();
			if (isAuth) {
				await router.navigate('/');

				return false;
			}

			return true;
		},
	}),
	{
		path:        '/',
		name:        'layout',
		template:    () => html`<app-layout></app-layout>`,
		beforeEnter: requireAccessGuard,
		children:    [
			defineRoute({
				path:      '',
				name:      'dashboard',
				template:  () => html`<registry-manager></registry-manager>`,
				animation: slideTransition,
			}),
			defineRoute({
				path:      'browse',
				name:      'browse',
				template:  () => html`<plugin-browse></plugin-browse>`,
				animation: slideTransition,
			}),
			defineRoute({
				path:      'plugin/:name',
				name:      'plugin-detail',
				template:  (params) => html`<plugin-detail .name=${ params.name }></plugin-detail>`,
				animation: slideTransition,
			}),
			defineRoute({
				path:      'explore/:name?',
				name:      'explore',
				template:  (params) => html`<plugin-explorer .name=${ params.name ?? '' }></plugin-explorer>`,
				animation: slideTransition,
			}),
			defineRoute({
				path:        'admin',
				name:        'admin',
				template:    () => html`<plugin-admin></plugin-admin>`,
				beforeEnter: requireAuthGuard,
				animation:   slideTransition,
			}),
			defineRoute({
				path:     '(.*)',
				name:     'fallback',
				redirect: '/',
			}),
		],
	},
];
