import './features/router/router-outlet.ts';

import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { router } from './features/router/index.ts';
import { routes } from './routes.ts';
import { authService } from './services/auth-service.ts';
import { configService } from './services/config-service.ts';


@customElement('app-root')
export class AppRoot extends LitElement {

	static override styles: ReturnType<typeof css> = css`
		:host {
			display: block;
			min-height: 100vh;
		}

		.loading-screen {
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			font-size: 18px;
			color: #666;
		}
	`;

	@state() private isInitialized = false;

	override connectedCallback(): void {
		super.connectedCallback();

		// Configure the router
		router.setRoutes(routes);

		// Subscribe to auth changes and re-navigate to trigger guards
		authService.onAuthenticationStateChanged(() => this.handleAuthChange());

		// Initialize async operations
		this.initialize();
	}

	private async initialize(): Promise<void> {
		// Pre-fetch config so routes can use it synchronously from cache
		await configService.getConfig();

		this.isInitialized = true;

		// Navigate to current path (will trigger guards)
		await router.navigate(window.location.pathname);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		router.dispose();
	}

	private async handleAuthChange(): Promise<void> {
		// Re-navigate to current path to re-evaluate guards
		await router.navigate(window.location.pathname);
	}

	override render(): unknown {
		if (!this.isInitialized)
			return html`<div class="loading-screen">Loading...</div>`;

		return html`<router-outlet></router-outlet>`;
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'app-root': AppRoot;
	}
}
