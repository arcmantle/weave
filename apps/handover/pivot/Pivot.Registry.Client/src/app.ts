import './components/login-page.ts';
import './components/registry-manager.ts';

import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { authService } from './services/auth-service.ts';

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
	@state() private isAuthenticated = false;
	@state() private currentPath = '';

	override connectedCallback(): void {
		super.connectedCallback();

		// Listen to popstate for browser back/forward
		window.addEventListener('popstate', this.handlePopState);

		this.currentPath = this.getPath();

		// Subscribe to auth changes
		authService.onAuthenticationStateChanged(() => this.handleAuthChange());

		// Initialize async operations
		this.initialize();
	}

	private async initialize(): Promise<void> {
		this.isAuthenticated = await authService.isAuthenticated();
		this.isInitialized = true;

		// Redirect to login if not authenticated
		if (!this.isAuthenticated && this.currentPath !== '/login')
			this.navigate('/login');
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener('popstate', this.handlePopState);
	}

	private getPath(): string {
		return window.location.pathname;
	}

	private navigate(path: string): void {
		window.history.pushState({}, '', path);
		this.currentPath = path;
	}

	private handlePopState = () => {
		this.currentPath = this.getPath();
	};

	private async handleAuthChange() {
		this.isAuthenticated = await authService.isAuthenticated();

		if (!this.isAuthenticated && this.currentPath !== '/login')
			this.navigate('/login');
	}

	private handleLoginSuccess() {
		this.isAuthenticated = true;
		this.navigate('/');
	}

	private handleLogout() {
		this.isAuthenticated = false;
		this.navigate('/login');
	}

	override render(): unknown {
		if (!this.isInitialized)
			return html`<div class="loading-screen">Loading...</div>`;


		if (!this.isAuthenticated || this.currentPath === '/login')
			return html`<login-page @login-success=${ this.handleLoginSuccess }></login-page>`;


		return html`<registry-manager @logout=${ this.handleLogout }></registry-manager>`;
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'app-root': AppRoot;
	}
}
