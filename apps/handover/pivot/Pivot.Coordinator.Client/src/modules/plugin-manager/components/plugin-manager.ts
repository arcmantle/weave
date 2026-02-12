import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { dataAttrs } from '../../../utils/dom.ts';
import type { PluginInfo } from '../services/plugin-service.ts';
import { pluginService } from '../services/plugin-service.ts';


@customElement('plugin-manager')
export class PluginManager extends LitElement {

	@state() protected plugins:       PluginInfo[] = [];
	@state() protected loading:       boolean = false;
	@state() protected deploying:     boolean = false;
	@state() protected statusMessage: string | null = null;
	@state() protected errorMessage:  string | null = null;

	override connectedCallback(): void {
		super.connectedCallback();
		this.loadPlugins();
		pluginService.connectEventStream(() => this.loadPlugins());
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		pluginService.disconnectEventStream();
	}

	protected async loadPlugins(): Promise<void> {
		try {
			this.loading = true;
			this.plugins = await pluginService.getPlugins();
		}
		catch (err) {
			this.errorMessage = `Failed to load plugins: ${ err instanceof Error ? err.message : 'Unknown error' }`;
		}
		finally {
			this.loading = false;
		}
	}

	protected async handleToggle(name: string): Promise<void> {
		try {
			await pluginService.togglePlugin(name);
			await this.loadPlugins();
			this.statusMessage = `Plugin '${ name }' toggled`;
		}
		catch (err) {
			this.errorMessage = `Failed to toggle plugin: ${ err instanceof Error ? err.message : 'Unknown error' }`;
		}
	}

	protected handleToggleClick(ev: Event): void {
		const { plugin } = dataAttrs(ev, 'plugin');
		if (plugin)
			this.handleToggle(plugin);
	}

	protected async handleDeploy(): Promise<void> {
		try {
			this.deploying = true;
			this.statusMessage = null;
			const result = await pluginService.deployPlugins();
			this.statusMessage = result.message;
		}
		catch (err) {
			this.errorMessage = `Deploy failed: ${ err instanceof Error ? err.message : 'Unknown error' }`;
		}
		finally {
			this.deploying = false;
		}
	}

	override render(): unknown {
		return html`
		<div class="plugin-manager">
			<div class="header">
				<h2>Plugin Manager</h2>
				<div class="actions">
					<button class="btn btn-primary" @click=${ this.handleDeploy } ?disabled=${ this.deploying }>
						${ this.deploying ? 'Deploying...' : 'Deploy Plugins' }
					</button>
					<button class="btn btn-secondary" @click=${ this.loadPlugins } ?disabled=${ this.loading }>
						Refresh
					</button>
				</div>
			</div>

			${ when(this.statusMessage, () => html`
			<div class="alert alert-success">${ this.statusMessage }</div>
			`) }

			${ when(this.errorMessage, () => html`
			<div class="alert alert-danger">${ this.errorMessage }</div>
			`) }

			${ when(this.loading && this.plugins.length === 0,
				() => html`<div class="loading">Loading plugins...</div>`,
				() => this.renderPluginTable()) }
		</div>
		`;
	}

	protected renderPluginTable(): unknown {
		if (this.plugins.length === 0)
			return html`<div class="empty">No plugins found in the repository.</div>`;

		return html`
		<table class="plugin-table">
			<thead>
				<tr>
					<th>Plugin</th>
					<th>Version</th>
					<th>Registry</th>
					<th>Status</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
			${ this.plugins.map(plugin => html`
			<tr>
				<td class="plugin-name">${ plugin.name }</td>
				<td>${ plugin.version ?? '—' }</td>
				<td class="registry-url">${ plugin.registryUrl ?? 'local' }</td>
				<td>
					<span class="badge ${ plugin.enabled ? 'badge-enabled' : 'badge-disabled' }">
						${ plugin.enabled ? 'Enabled' : 'Disabled' }
					</span>
				</td>
				<td>
					<button
						class="btn btn-sm ${ plugin.enabled ? 'btn-warning' : 'btn-success' }"
						data-plugin="${ plugin.name }"
						@click=${ this.handleToggleClick }
					>
						${ plugin.enabled ? 'Disable' : 'Enable' }
					</button>
				</td>
			</tr>
			`) }
			</tbody>
		</table>
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
			--color-success-bg: #d4edda;
			--color-success-text: #155724;
			--color-success-border: #c3e6cb;
			--color-success-btn: #28a745;
			--color-success-btn-hover: #218838;
			--color-danger-bg: #f8d7da;
			--color-danger-text: #721c24;
			--color-danger-border: #f5c6cb;
			--color-warning-btn: #ffc107;
			--color-warning-btn-hover: #e0a800;
			--color-warning-text: #333;
			--color-table-header-bg: #f8f9fa;
			--color-table-header-text: #666;
			--color-muted: #888;
			--color-border: #eee;
			--font-size-xs: 12px;
			--font-size-sm: 13px;
			--font-size-md: 14px;
			--font-size-lg: 15px;
			--spacing-xs: 4px;
			--spacing-sm: 8px;
			--spacing-md: 12px;
			--spacing-lg: 16px;
			--spacing-xl: 20px;
			--spacing-2xl: 24px;
			--spacing-3xl: 40px;
			--radius-sm: 6px;
			--radius-md: 8px;
			--radius-lg: 12px;
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
		}
		.alert {
			padding: var(--spacing-md) var(--spacing-lg);
			margin-bottom: var(--spacing-lg);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-md);
		}
		.alert-success {
			border: 1px solid var(--color-success-border);
			background: var(--color-success-bg);
			color: var(--color-success-text);
		}
		.alert-danger {
			border: 1px solid var(--color-danger-border);
			background: var(--color-danger-bg);
			color: var(--color-danger-text);
		}
		.plugin-table {
			width: 100%;
			border-collapse: collapse;
			border-radius: var(--radius-md);
			background: white;
			overflow: hidden;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

			& th,
			& td {
				padding: var(--spacing-md) var(--spacing-lg);
				border-bottom: 1px solid var(--color-border);
				text-align: left;
			}

			& th {
				background: var(--color-table-header-bg);
				font-size: var(--font-size-sm);
				font-weight: 600;
				color: var(--color-table-header-text);
				text-transform: uppercase;
				letter-spacing: 0.5px;
			}
		}
		.plugin-name {
			font-weight: 600;
		}
		.registry-url {
			max-width: 200px;
			overflow: hidden;
			font-size: var(--font-size-sm);
			color: var(--color-muted);
			white-space: nowrap;
			text-overflow: ellipsis;
		}
		.badge {
			display: inline-block;
			padding: var(--spacing-xs) 10px;
			border-radius: var(--radius-lg);
			font-size: var(--font-size-xs);
			font-weight: 600;
		}
		.badge-enabled {
			background: var(--color-success-bg);
			color: var(--color-success-text);
		}
		.badge-disabled {
			background: var(--color-danger-bg);
			color: var(--color-danger-text);
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
		.btn-sm {
			padding: var(--spacing-xs) var(--spacing-md);
			font-size: var(--font-size-sm);
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
		.btn-success {
			background: var(--color-success-btn);
			color: white;

			&:hover { background: var(--color-success-btn-hover); }
		}
		.btn-warning {
			background: var(--color-warning-btn);
			color: var(--color-warning-text);

			&:hover { background: var(--color-warning-btn-hover); }
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
		'plugin-manager': PluginManager;
	}
}
