import { authService } from '@arcmantle/pivot-client-auth';
import { router } from '@arcmantle/pivot-client-router';
import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { type ModuleDefinition, moduleRegistry } from '../modules/module-registry.ts';


@customElement('coordinator-layout')
export class CoordinatorLayout extends LitElement {

	@state() protected user:    string | null = null;
	@state() protected modules: ModuleDefinition[] = [];

	override connectedCallback(): void {
		super.connectedCallback();
		this.modules = moduleRegistry.getModules();
		this.loadUser();
		authService.onAuthenticationStateChanged(() => this.loadUser());
	}

	protected async loadUser(): Promise<void> {
		this.user = await authService.getCurrentUser();
	}

	protected async handleLogout(): Promise<void> {
		await authService.logout();
		router.navigate('/login');
	}

	protected handleNavClick(ev: Event): void {
		ev.preventDefault();
		const anchor = (ev.currentTarget as HTMLAnchorElement);
		const route = anchor.getAttribute('href');
		if (route)
			router.navigate(route);
	}

	override render(): unknown {
		return html`
		<div class="layout">
			<nav class="sidebar">
				<div class="brand">
					<span class="brand-icon">⚡</span>
					<span class="brand-text">Pivot Coordinator</span>
				</div>

				<div class="nav-items">
					${ this.modules.map(mod => html`
					<a
						class="nav-item"
						href="/${ mod.route }"
						@click=${ this.handleNavClick }
					>
						<span class="nav-icon">${ mod.icon }</span>
						<span class="nav-label">${ mod.name }</span>
					</a>
					`) }
				</div>

				<div class="sidebar-footer">
					${ when(this.user, () => html`
					<div class="user-info">
						<span class="user-name">${ this.user }</span>
						<button class="btn-logout" @click=${ this.handleLogout }>Logout</button>
					</div>
					`) }
				</div>
			</nav>

			<main class="content">
				<slot></slot>
			</main>
		</div>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			--color-sidebar-bg: #1a1a2e;
			--color-sidebar-text: rgba(255, 255, 255, 0.7);
			--color-sidebar-text-hover: white;
			--color-sidebar-border: rgba(255, 255, 255, 0.1);
			--color-sidebar-hover-bg: rgba(255, 255, 255, 0.08);
			--color-content-bg: #f0f2f5;
			--font-size-xs: 12px;
			--font-size-sm: 13px;
			--font-size-md: 14px;
			--font-size-brand: 16px;
			--font-size-icon: 18px;
			--font-size-brand-icon: 24px;
			--spacing-xs: 4px;
			--spacing-sm: 10px;
			--spacing-md: 12px;
			--spacing-lg: 16px;
			--spacing-xl: 20px;
			--sidebar-width: 240px;
			display: block;
			height: 100vh;
		}
		.layout {
			display: grid;
			grid-template-columns: var(--sidebar-width) 1fr;
			height: 100%;
		}
		.sidebar {
			display: flex;
			flex-direction: column;
			padding: 0;
			background: var(--color-sidebar-bg);
			color: white;
		}
		.brand {
			display: flex;
			align-items: center;
			gap: var(--spacing-sm);
			padding: var(--spacing-xl) var(--spacing-lg);
			border-bottom: 1px solid var(--color-sidebar-border);
		}
		.brand-icon { font-size: var(--font-size-brand-icon); }
		.brand-text {
			font-size: var(--font-size-brand);
			font-weight: 700;
			letter-spacing: 0.5px;
		}
		.nav-items { flex: 1; padding: var(--spacing-md) 0; }
		.nav-item {
			display: flex;
			align-items: center;
			gap: var(--spacing-md);
			padding: var(--spacing-md) var(--spacing-xl);
			font-size: var(--font-size-md);
			font-weight: 500;
			color: var(--color-sidebar-text);
			text-decoration: none;
			cursor: pointer;
			transition: all 0.15s;

			&:hover {
				background: var(--color-sidebar-hover-bg);
				color: var(--color-sidebar-text-hover);
			}
		}
		.nav-icon { font-size: var(--font-size-icon); }
		.sidebar-footer {
			padding: var(--spacing-lg);
			border-top: 1px solid var(--color-sidebar-border);
		}
		.user-info {
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
		.user-name {
			font-size: var(--font-size-sm);
			color: var(--color-sidebar-text);
		}
		.btn-logout {
			padding: var(--spacing-xs) var(--spacing-sm);
			border: 1px solid rgba(255, 255, 255, 0.2);
			border-radius: var(--spacing-xs);
			font-size: var(--font-size-xs);
			color: var(--color-sidebar-text);
			background: none;
			cursor: pointer;
			transition: all 0.15s;

			&:hover {
				background: var(--color-sidebar-hover-bg);
				color: var(--color-sidebar-text-hover);
			}
		}
		.content {
			background: var(--color-content-bg);
			overflow-y: auto;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'coordinator-layout': CoordinatorLayout;
	}
}
