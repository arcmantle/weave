import { html } from 'lit';
import { authService, createAuthGuard } from '@arcmantle/pivot-client-auth';
import { type RouteConfig, router } from '@arcmantle/pivot-client-router';

import { moduleRegistry } from './modules/module-registry.ts';


const requireAuth = createAuthGuard(authService, router, '/login');


export function getRoutes(): RouteConfig[] {
	const moduleRoutes: RouteConfig[] = moduleRegistry.getModules().map(mod => ({
		path:        `/${ mod.route }`,
		component:   mod.component,
		template:    mod.template,
		beforeEnter: requireAuth,
	}));

	return [
		{
			path:        '/login',
			component:   'login-page',
			template:    () => html`<login-page></login-page>`,
			beforeEnter: async (): Promise<boolean> => {
				const isAuth = await authService.isAuthenticated();
				if (isAuth) {
					await router.navigate('/');

					return false;
				}

				return true;
			},
		},
		...moduleRoutes,
		{
			path:     '/',
			redirect: '/registries',
		},
	];
}
