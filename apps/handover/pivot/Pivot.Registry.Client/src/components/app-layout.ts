import '../features/router/router-outlet.ts';

import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { router } from '../features/router/index.ts';
import { authService } from '../services/auth-service.ts';
import { type AccessMode, configService } from '../services/config-service.ts';


@customElement('app-layout')
export class AppLayout extends LitElement {

	@state() protected currentUser: string | null = null;
	@state() protected accessMode:  AccessMode = 'private';

	override connectedCallback(): void {
		super.connectedCallback();
		this.initialize();

		router.onAfterNavigateStart(() => {
			this.requestUpdate();
		});
	}

	protected async initialize(): Promise<void> {
		const config = await configService.getConfig();
		this.accessMode = config.accessMode;
		this.currentUser = await authService.getCurrentUser();
	}

	protected async handleLogout(): Promise<void> {
		await authService.logout();
		await router.navigate('/login');
	}

	override render(): unknown {
		return html`
		<header>
			<div class="header-left">
				<span class="logo" @click=${ () => router.navigate('/') }>
					Pivot Registry
				</span>

				<nav>
					<a ?data-active=${ router.isActive('/') }        href="/">Dashboard</a>
					<a ?data-active=${ router.isActive('/browse') }  href="/browse">Browse</a>
					<a ?data-active=${ router.isActive('/explore') } href="/explore">Explorer</a>
					${ when(this.currentUser, () => html`
					<a ?data-active=${ router.isActive('/admin') } href="/admin">Admin</a>
					`) }
				</nav>
			</div>

			<div class="header-right">
				${ when(this.currentUser, () => html`
				<span class="user-info">${ this.currentUser }</span>
				<button class="logout-btn" @click=${ this.handleLogout }>
					Logout
				</button>
				`, () => html`
				<a class="login-btn" href="/login">Login</a>
				`) }
			</div>
		</header>

		<main>
			<router-outlet></router-outlet>
		</main>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: flex;
			flex-direction: column;
			min-height: 100vh;
		}

		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 24px;
			height: 56px;
			background: #1a1a2e;
			color: #fff;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
			z-index: 10;
		}

		.header-left {
			display: flex;
			align-items: center;
			gap: 24px;
		}

		.logo {
			font-size: 18px;
			font-weight: 700;
			letter-spacing: 0.5px;
			cursor: pointer;
			user-select: none;
		}

		nav {
			display: flex;
			gap: 4px;
		}

		nav a {
			color: rgba(255, 255, 255, 0.7);
			text-decoration: none;
			padding: 8px 14px;
			border-radius: 6px;
			font-size: 14px;
			font-weight: 500;
			transition: color 0.15s, background 0.15s;
			cursor: pointer;
		}

		nav a:hover {
			color: #fff;
			background: rgba(255, 255, 255, 0.1);
		}

		nav a[data-active] {
			color: #fff;
			background: rgba(255, 255, 255, 0.15);
		}

		.header-right {
			display: flex;
			align-items: center;
			gap: 16px;
		}

		.user-info {
			font-size: 13px;
			color: rgba(255, 255, 255, 0.7);
		}

		.logout-btn {
			background: none;
			border: 1px solid rgba(255, 255, 255, 0.3);
			color: rgba(255, 255, 255, 0.8);
			padding: 6px 14px;
			border-radius: 6px;
			font-size: 13px;
			cursor: pointer;
			transition: border-color 0.15s, color 0.15s;
		}

		.logout-btn:hover {
			border-color: rgba(255, 255, 255, 0.6);
			color: #fff;
		}

		.login-btn {
			border: 1px solid rgba(255, 255, 255, 0.3);
			color: rgba(255, 255, 255, 0.8);
			padding: 6px 14px;
			border-radius: 6px;
			font-size: 13px;
			text-decoration: none;
			cursor: pointer;
			transition: border-color 0.15s, color 0.15s, background 0.15s;
		}

		.login-btn:hover {
			border-color: rgba(255, 255, 255, 0.6);
			color: #fff;
			background: rgba(255, 255, 255, 0.1);
		}

		main {
			flex: 1;
			display: grid;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'app-layout': AppLayout;
	}
}
