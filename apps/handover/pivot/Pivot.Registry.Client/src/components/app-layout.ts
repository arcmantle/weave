import '@arcmantle/pivot-client-router';

import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { router } from '@arcmantle/pivot-client-router';
import { authService } from '@arcmantle/pivot-client-auth';
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

	protected handleLogoClick(): void {
		router.navigate('/');
	}

	protected async handleLogout(): Promise<void> {
		await authService.logout();
		await router.navigate('/login');
	}

	override render(): unknown {
		return html`
		<header>
			<div class="header-left">
				<span class="logo" @click=${ this.handleLogoClick }>
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
			--color-header-bg: #1a1a2e;
			--color-header-text: #fff;
			--color-header-text-muted: rgba(255, 255, 255, 0.7);
			--color-header-text-dim: rgba(255, 255, 255, 0.8);
			--color-header-border: rgba(255, 255, 255, 0.3);
			--color-header-border-hover: rgba(255, 255, 255, 0.6);
			--color-header-hover-bg: rgba(255, 255, 255, 0.1);
			--color-header-active-bg: rgba(255, 255, 255, 0.15);
			--color-shadow: rgba(0, 0, 0, 0.15);
			--font-size-sm: 13px;
			--font-size-base: 14px;
			--font-size-lg: 18px;
			--spacing-xs: 4px;
			--spacing-sm: 6px;
			--spacing-md: 8px;
			--spacing-lg: 14px;
			--spacing-xl: 16px;
			--spacing-2xl: 24px;
			--radius-md: 6px;
			--transition-speed: 0.15s;
			display: flex;
			flex-direction: column;
			min-height: 100vh;
		}
		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 var(--spacing-2xl);
			height: 56px;
			background: var(--color-header-bg);
			color: var(--color-header-text);
			box-shadow: 0 2px 4px var(--color-shadow);
			z-index: 10;
		}
		.header-left {
			display: flex;
			align-items: center;
			gap: var(--spacing-2xl);
		}
		.logo {
			font-size: var(--font-size-lg);
			font-weight: 700;
			letter-spacing: 0.5px;
			cursor: pointer;
			user-select: none;
		}
		nav {
			display: flex;
			gap: var(--spacing-xs);
			& a {
				color: var(--color-header-text-muted);
				text-decoration: none;
				padding: var(--spacing-md) var(--spacing-lg);
				border-radius: var(--radius-md);
				font-size: var(--font-size-base);
				font-weight: 500;
				transition: color var(--transition-speed), background var(--transition-speed);
				cursor: pointer;
				&:hover {
					color: var(--color-header-text);
					background: var(--color-header-hover-bg);
				}
				&[data-active] {
					color: var(--color-header-text);
					background: var(--color-header-active-bg);
				}
			}
		}
		.header-right {
			display: flex;
			align-items: center;
			gap: var(--spacing-xl);
		}
		.user-info {
			font-size: var(--font-size-sm);
			color: var(--color-header-text-muted);
		}
		.logout-btn {
			background: none;
			border: 1px solid var(--color-header-border);
			color: var(--color-header-text-dim);
			padding: var(--spacing-sm) var(--spacing-lg);
			border-radius: var(--radius-md);
			font-size: var(--font-size-sm);
			cursor: pointer;
			transition: border-color var(--transition-speed), color var(--transition-speed);
			&:hover {
				border-color: var(--color-header-border-hover);
				color: var(--color-header-text);
			}
		}
		.login-btn {
			border: 1px solid var(--color-header-border);
			color: var(--color-header-text-dim);
			padding: var(--spacing-sm) var(--spacing-lg);
			border-radius: var(--radius-md);
			font-size: var(--font-size-sm);
			text-decoration: none;
			cursor: pointer;
			transition: border-color var(--transition-speed), color var(--transition-speed), background var(--transition-speed);
			&:hover {
				border-color: var(--color-header-border-hover);
				color: var(--color-header-text);
				background: var(--color-header-hover-bg);
			}
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
