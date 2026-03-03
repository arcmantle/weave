import { router } from '@arcmantle/pivot-client-router';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';

import type { UpdateStatus } from '../types.ts';


interface NavItem {
	path: string;
	label: string;
}

@customElement('food-guru-layout')
export class FoodGuruLayout extends LitElement {

	protected navItems: NavItem[] = [
		{ path: '/planner',     label: 'Meal Planner' },
		{ path: '/stats',       label: 'Stats' },
		{ path: '/ingredients', label: 'Ingredients' },
		{ path: '/settings',    label: 'Settings' },
	];

	@state() protected updateStatus: UpdateStatus | null = null;
	@state() protected isCheckingUpdate = false;
	@state() protected isApplyingUpdate = false;

	override connectedCallback(): void {
		super.connectedCallback();

		router.onAfterNavigateStart(() => {
			this.requestUpdate();
		});

		this.checkForUpdates();
	}

	protected async checkForUpdates(): Promise<void> {
		if (this.isCheckingUpdate)
			return;

		this.isCheckingUpdate = true;
		try {
			const response = await fetch('/api/update', { method: 'GET' });
			if (!response.ok)
				return;

			this.updateStatus = await response.json() as UpdateStatus;
		}
		catch {
			return;
		}
		finally {
			this.isCheckingUpdate = false;
		}
	}

	protected async applyUpdate(): Promise<void> {
		if (this.isApplyingUpdate)
			return;

		if (!this.updateStatus?.available || !this.updateStatus.canApply)
			return;

		this.isApplyingUpdate = true;
		try {
			const response = await fetch('/api/update/apply', {
				method: 'POST',
			});

			if (!response.ok) {
				this.isApplyingUpdate = false;
				await this.checkForUpdates();
				return;
			}
		}
		catch {
			this.isApplyingUpdate = false;
			return;
		}
	}

	protected onUpdateClick = (): void => {
		void this.applyUpdate();
	};

	protected getUpdateButtonLabel(): string {
		if (this.isApplyingUpdate)
			return 'Updating...';

		if (this.isCheckingUpdate)
			return 'Checking...';

		if (!this.updateStatus?.enabled)
			return 'Updates Off';

		if (this.updateStatus.available && this.updateStatus.canApply)
			return 'Update Available';

		return 'Up To Date';
	}

	protected isUpdateButtonEnabled(): boolean {
		if (!this.updateStatus)
			return false;

		if (this.isApplyingUpdate || this.isCheckingUpdate)
			return false;

		return this.updateStatus.available && this.updateStatus.canApply;
	}

	override render(): unknown {
		return html`
		<header>
			<div class="brand">
				Food Guru
			</div>

			<div class="header-right">
				<nav>
					${ repeat(this.navItems, (item) => item.path, (item) => html`
					<a
						href=${ item.path }
						?data-active=${ router.isActive(item.path) }
					>
						${ item.label }
					</a>
					`) }
				</nav>

				<button
					class="update-btn"
					?disabled=${ !this.isUpdateButtonEnabled() }
					@click=${ this.onUpdateClick }
				>
					${ this.getUpdateButtonLabel() }
				</button>
			</div>
		</header>

		${ when(this.updateStatus?.available && !!this.updateStatus.latestVersion, () => html`
		<div class="update-note">
			Version ${ this.updateStatus.latestVersion } is available.
		</div>
		`, () => html``) }

		<main>
			<router-outlet></router-outlet>
		</main>
		`;
	}

	static override styles = css`
		:host {
			--fg-bg: #0f131a;
			--fg-surface: #161d27;
			--fg-surface-soft: #1c2430;
			--fg-border: #2a3645;
			--fg-text: #e7edf5;
			--fg-text-muted: #9cb0c6;
			--fg-primary: #6ea8ff;
			--fg-primary-soft: #223754;
			color-scheme: dark;
			display: flex;
			flex-direction: column;
			min-height: 100vh;
			background: var(--fg-bg);
			color: var(--fg-text);
			font-family: Inter, Segoe UI, Arial, sans-serif;
		}
		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 20px;
			height: 60px;
			border-bottom: 1px solid var(--fg-border);
			background: var(--fg-surface);
		}
		.brand {
			font-size: 18px;
			font-weight: 700;
		}
		.header-right {
			display: flex;
			align-items: center;
			gap: 10px;
		}
		nav {
			display: flex;
			gap: 8px;
			& a {
				display: inline-flex;
				align-items: center;
				height: 34px;
				padding: 0 12px;
				border-radius: 8px;
				text-decoration: none;
				color: var(--fg-text-muted);
				font-size: 14px;
				font-weight: 500;
				&:hover {
					background: var(--fg-surface-soft);
					color: var(--fg-primary);
				}
				&[data-active] {
					background: var(--fg-primary-soft);
					color: var(--fg-primary);
				}
			}
		}
		.update-btn {
			height: 34px;
			padding: 0 12px;
			border: 1px solid var(--fg-border);
			border-radius: 8px;
			background: var(--fg-surface);
			color: var(--fg-text-muted);
			font: inherit;
			font-size: 13px;
			font-weight: 600;
			cursor: pointer;
			&:disabled {
				cursor: default;
				opacity: 0.65;
			}
			&:not(:disabled) {
				border-color: var(--fg-primary);
				color: var(--fg-primary);
			}
		}
		.update-note {
			padding: 8px 16px;
			font-size: 13px;
			color: var(--fg-primary);
			background: var(--fg-primary-soft);
			border-bottom: 1px solid var(--fg-border);
		}
		main {
			flex: 1;
			display: grid;
			padding: 0;
			min-height: 0;
			overflow: hidden;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'food-guru-layout': FoodGuruLayout;
	}
}
