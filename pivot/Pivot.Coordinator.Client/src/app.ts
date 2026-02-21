import '@arcmantle/pivot-client-router';
// Register all modules
import './modules/registry-browser/registry-browser-module.ts';
import './modules/plugin-manager/plugin-manager-module.ts';
import './modules/backend-monitor/backend-monitor-module.ts';
import './components/coordinator-layout.ts';

import { authService } from '@arcmantle/pivot-client-auth';
import { type RouteConfig, router } from '@arcmantle/pivot-client-router';
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { getRoutes } from './routes.ts';


@customElement('coordinator-app')
export class CoordinatorApp extends LitElement {

	@state() protected initialized = false;

	override connectedCallback(): void {
		super.connectedCallback();

		const routes: RouteConfig[] = getRoutes();
		router.setRoutes(routes);

		authService.onAuthenticationStateChanged(() => this.handleAuthChange());
		this.initialize();
	}

	protected async initialize(): Promise<void> {
		this.initialized = true;
		await router.navigate(window.location.pathname);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		router.dispose();
	}

	protected async handleAuthChange(): Promise<void> {
		await router.navigate(window.location.pathname);
	}

	override render(): unknown {
		return when(this.initialized, () => html`
		<coordinator-layout>
			<router-outlet></router-outlet>
		</coordinator-layout>
		`);
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'coordinator-app': CoordinatorApp;
	}
}
