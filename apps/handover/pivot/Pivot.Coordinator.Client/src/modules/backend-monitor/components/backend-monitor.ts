import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import type { BackendInstance } from '../services/backend-service.ts';
import { backendService } from '../services/backend-service.ts';


@customElement('backend-monitor')
export class BackendMonitor extends LitElement {

	@state() protected backends:     BackendInstance[] = [];
	@state() protected loading = false;
	@state() protected reloading = false;
	@state() protected healthStatus: string | null = null;
	@state() protected errorMessage: string | null = null;

	override connectedCallback(): void {
		super.connectedCallback();
		this.loadBackends();
		this.checkHealth();
		backendService.connectEventStream(() => this.loadBackends());
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		backendService.disconnectEventStream();
	}

	protected async loadBackends(): Promise<void> {
		try {
			this.loading = true;
			this.backends = await backendService.getBackends();
		}
		catch (err) {
			this.errorMessage = `Failed to load backends: ${ err instanceof Error ? err.message : 'Unknown error' }`;
		}
		finally {
			this.loading = false;
		}
	}

	protected async checkHealth(): Promise<void> {
		try {
			this.healthStatus = await backendService.checkHealth();
		}
		catch {
			this.healthStatus = 'unhealthy';
		}
	}

	protected async handleReload(): Promise<void> {
		try {
			this.reloading = true;
			this.errorMessage = null;
			await backendService.reload();
			await this.loadBackends();
		}
		catch (err) {
			this.errorMessage = `Reload failed: ${ err instanceof Error ? err.message : 'Unknown error' }`;
		}
		finally {
			this.reloading = false;
		}
	}

	override render(): unknown {
		return html`
		<div class="backend-monitor">
			<div class="header">
				<h2>Backend Monitor</h2>
				<div class="actions">
					${ when(this.healthStatus, () => html`
					<span class="health-badge ${ this.healthStatus === 'Healthy' ? 'healthy' : 'unhealthy' }">
						${ this.healthStatus }
					</span>
					`) }
					<button class="btn btn-primary" @click=${ this.handleReload } ?disabled=${ this.reloading }>
						${ this.reloading ? 'Reloading...' : 'Reload Backends' }
					</button>
					<button class="btn btn-secondary" @click=${ this.loadBackends } ?disabled=${ this.loading }>
						Refresh
					</button>
				</div>
			</div>

			${ when(this.errorMessage, () => html`
			<div class="alert alert-danger">${ this.errorMessage }</div>
			`) }

			${ when(this.loading && this.backends.length === 0,
				() => html`<div class="loading">Loading backends...</div>`,
				() => this.renderBackendCards()) }
		</div>
		`;
	}

	protected renderBackendCards(): unknown {
		if (this.backends.length === 0)
			return html`<div class="empty">No backend instances registered.</div>`;

		return html`
		<div class="backend-grid">
			${ this.backends.map(backend => html`
			<div class="backend-card ${ backend.status }">
				<div class="card-header">
					<span class="status-dot ${ backend.status }"></span>
					<h3>${ backend.name }</h3>
				</div>
				<div class="card-body">
					<div class="field">
						<span class="label">URL</span>
						<span class="value">${ backend.url }</span>
					</div>
					<div class="field">
						<span class="label">Status</span>
						<span class="value">${ backend.status }</span>
					</div>
					${ when(backend.lastSeen, () => html`
					<div class="field">
						<span class="label">Last Seen</span>
						<span class="value">${ backend.lastSeen }</span>
					</div>
					`) }
				</div>
			</div>
			`) }
		</div>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			--color-heading: #1a1a2e;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-secondary-bg: #e9ecef;
			--color-secondary-hover: #dee2e6;
			--color-secondary-text: #333;
			--color-danger-bg: #f8d7da;
			--color-danger-text: #721c24;
			--color-danger-border: #f5c6cb;
			--color-healthy-bg: #d4edda;
			--color-healthy-text: #155724;
			--color-online: #28a745;
			--color-offline: #dc3545;
			--color-degraded: #ffc107;
			--color-muted: #888;
			--color-text: #333;
			--color-border: #eee;
			--color-card-border: #ccc;
			--font-size-sm: 13px;
			--font-size-md: 14px;
			--font-size-lg: 15px;
			--font-size-heading: 16px;
			--spacing-xs: 4px;
			--spacing-sm: 8px;
			--spacing-md: 10px;
			--spacing-lg: 16px;
			--spacing-xl: 20px;
			--spacing-2xl: 24px;
			--spacing-3xl: 40px;
			--radius-sm: 6px;
			--radius-md: 8px;
			--radius-pill: 12px;
			--dot-size: 10px;
			display: block;
			padding: var(--spacing-2xl);
		}
		.header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--spacing-xl);
		}
		h2 {
			margin: 0;
			color: var(--color-heading);
		}
		.actions {
			display: flex;
			gap: var(--spacing-sm);
			align-items: center;
		}
		.health-badge {
			padding: var(--spacing-xs) var(--spacing-md);
			border-radius: var(--radius-pill);
			font-size: var(--font-size-sm);
			font-weight: 600;

			&.healthy {
				background: var(--color-healthy-bg);
				color: var(--color-healthy-text);
			}

			&.unhealthy {
				background: var(--color-danger-bg);
				color: var(--color-danger-text);
			}
		}
		.alert {
			padding: var(--spacing-md) var(--spacing-lg);
			margin-bottom: var(--spacing-lg);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-md);
		}
		.alert-danger {
			border: 1px solid var(--color-danger-border);
			background: var(--color-danger-bg);
			color: var(--color-danger-text);
		}
		.backend-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
			gap: var(--spacing-lg);
		}
		.backend-card {
			border-left: 4px solid var(--color-card-border);
			border-radius: var(--radius-md);
			background: white;
			overflow: hidden;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

			&.online { border-left-color: var(--color-online); }
			&.offline { border-left-color: var(--color-offline); }
			&.degraded { border-left-color: var(--color-degraded); }
		}
		.card-header {
			display: flex;
			align-items: center;
			gap: var(--spacing-md);
			padding: var(--spacing-lg);
			border-bottom: 1px solid var(--color-border);

			& h3 {
				margin: 0;
				font-size: var(--font-size-heading);
			}
		}
		.status-dot {
			width: var(--dot-size);
			height: var(--dot-size);
			flex-shrink: 0;
			border-radius: 50%;
			background: var(--color-card-border);

			&.online { background: var(--color-online); }
			&.offline { background: var(--color-offline); }
			&.degraded { background: var(--color-degraded); }
		}
		.card-body {
			padding: var(--spacing-lg);
		}
		.field {
			display: flex;
			justify-content: space-between;
			margin-bottom: var(--spacing-sm);
			font-size: var(--font-size-md);

			&:last-child { margin-bottom: 0; }
		}
		.label {
			font-weight: 500;
			color: var(--color-muted);
		}
		.value {
			color: var(--color-text);
		}
		.btn {
			padding: var(--spacing-sm) var(--spacing-lg);
			border: none;
			border-radius: var(--radius-sm);
			font-size: var(--font-size-md);
			font-weight: 500;
			cursor: pointer;
			transition: background 0.15s;

			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;

			&:hover:not(:disabled) { background: var(--color-primary-hover); }
		}
		.btn-secondary {
			background: var(--color-secondary-bg);
			color: var(--color-secondary-text);

			&:hover:not(:disabled) { background: var(--color-secondary-hover); }
		}
		.loading, .empty {
			padding: var(--spacing-3xl);
			font-size: var(--font-size-lg);
			color: var(--color-muted);
			text-align: center;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'backend-monitor': BackendMonitor;
	}
}
