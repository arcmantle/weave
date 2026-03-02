import type { RouteConfig } from '@arcmantle/pivot-client-router';
import { defineRoute } from '@arcmantle/pivot-client-router';
import { html } from 'lit';

import './components/food-guru-layout.ts';
import './pages/ingredients-page.ts';
import './pages/planner-page.ts';
import './pages/settings-page.ts';
import './pages/stats-page.ts';


export const routes: RouteConfig[] = [
	{
		path:     '/',
		name:     'layout',
		template: () => html`<food-guru-layout></food-guru-layout>`,
		children: [
			defineRoute({
				path:     '',
				name:     'home',
				redirect: '/planner',
			}),
			defineRoute({
				path:     'planner',
				name:     'planner',
				template: () => html`<planner-page></planner-page>`,
			}),
			defineRoute({
				path:     'stats',
				name:     'stats',
				template: () => html`<stats-page></stats-page>`,
			}),
			defineRoute({
				path:     'ingredients',
				name:     'ingredients',
				template: () => html`<ingredients-page></ingredients-page>`,
			}),
			defineRoute({
				path:     'settings',
				name:     'settings',
				template: () => html`<settings-page></settings-page>`,
			}),
			defineRoute({
				path:     '(.*)',
				name:     'fallback',
				redirect: '/planner',
			}),
		],
	},
];
