import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { dataAttrs } from '../../../utils/dom.ts';
import type { RegistryPluginInfo } from '../models/registry.ts';
import { registryConnectionService } from '../services/registry-connection-service.ts';


@customElement('registry-plugin-list')
export class RegistryPluginList extends LitElement {

	@state() protected registryUrl = '';
	@state() protected registryName = '';
	@state() protected plugins:          RegistryPluginInfo[] = [];
	@state() protected loading = false;
	@state() protected errorMessage:     string | null = null;
	@state() protected installingPlugin: string | null = null;
	@state() protected statusMessage:    string | null = null;

	setRegistry(name: string, url: string): void {
		this.registryName = name;
		this.registryUrl = url;
		this.loadPlugins();
	}

	protected async loadPlugins(): Promise<void> {
		if (!this.registryUrl)
			return;

		try {
			this.loading = true;
			this.errorMessage = null;
			this.plugins = await registryConnectionService.fetchPlugins(this.registryUrl);
		}
		catch (err) {
			this.errorMessage = err instanceof Error ? err.message : 'Failed to load plugins';
			this.plugins = [];
		}
		finally {
			this.loading = false;
		}
	}

	protected async handleInstall(plugin: RegistryPluginInfo): Promise<void> {
		try {
			this.installingPlugin = plugin.name;
			this.statusMessage = null;
			const result = await registryConnectionService.installFromRegistry(
				this.registryUrl, plugin.name, plugin.version,
			);
			this.statusMessage = result.message;
		}
		catch (err) {
			this.errorMessage = `Install failed: ${ err instanceof Error ? err.message : 'Unknown error' }`;
		}
		finally {
			this.installingPlugin = null;
		}
	}

	protected handleInstallClick(ev: Event): void {
		const { pluginName } = dataAttrs(ev, 'pluginName');
		if (!pluginName)
			return;

		const plugin = this.plugins.find(p => p.name === pluginName);
		if (plugin)
			this.handleInstall(plugin);
	}

	override render(): unknown {
		if (!this.registryUrl)
			return html`<div class="empty">Select a registry to browse plugins.</div>`;

		return html`
		<div class="plugin-list">
			<div class="list-header">
				<h3>Plugins from ${ this.registryName }</h3>
				<button class="btn btn-sm btn-secondary" @click=${ this.loadPlugins }>Refresh</button>
			</div>

			${ when(this.statusMessage, () => html`
			<div class="alert alert-success">${ this.statusMessage }</div>
			`) }

			${ when(this.errorMessage, () => html`
			<div class="alert alert-danger">${ this.errorMessage }</div>
			`) }

			${ when(this.loading, () => html`
			<div class="loading">Loading plugins...</div>
			`) }

			${ when(!this.loading && this.plugins.length === 0 && !this.errorMessage, () => html`
			<div class="empty">No plugins found in this registry.</div>
			`) }

			${ when(!this.loading && this.plugins.length > 0, () => html`
			<div class="plugin-cards">
				${ this.plugins.map(plugin => html`
				<div class="plugin-card">
					<div class="plugin-info">
						<span class="plugin-name">${ plugin.name }</span>
						<span class="plugin-version">v${ plugin.version }</span>
						${ when(plugin.description, () => html`
						<p class="plugin-description">${ plugin.description }</p>
						`) }
					</div>
					<button
						class="btn btn-sm btn-primary"
						data-plugin-name="${ plugin.name }"
						@click=${ this.handleInstallClick }
						?disabled=${ this.installingPlugin === plugin.name }
					>
						${ this.installingPlugin === plugin.name ? 'Installing...' : 'Install' }
					</button>
				</div>
				`) }
			</div>
			`) }
		</div>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-secondary-bg: #e9ecef;
			--color-secondary-text: #333;
			--color-heading: #333;
			--color-success-bg: #d4edda;
			--color-success-text: #155724;
			--color-danger-bg: #f8d7da;
			--color-danger-text: #721c24;
			--color-muted: #888;
			--color-description: #666;
			--color-border: #eee;
			--font-size-xs: 12px;
			--font-size-sm: 13px;
			--font-size-md: 14px;
			--font-size-heading: 16px;
			--spacing-xs: 2px;
			--spacing-sm: 4px;
			--spacing-md: 8px;
			--spacing-lg: 12px;
			--spacing-xl: 16px;
			--spacing-2xl: 24px;
			--radius-sm: 6px;
			display: block;
		}
		.list-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--spacing-lg);
		}
		h3 {
			margin: 0;
			font-size: var(--font-size-heading);
			color: var(--color-heading);
		}
		.alert {
			padding: var(--spacing-md) var(--spacing-lg);
			margin-bottom: var(--spacing-lg);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-sm);
		}
		.alert-success {
			background: var(--color-success-bg);
			color: var(--color-success-text);
		}
		.alert-danger {
			background: var(--color-danger-bg);
			color: var(--color-danger-text);
		}
		.plugin-cards {
			display: flex;
			flex-direction: column;
			gap: var(--spacing-md);
		}
		.plugin-card {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: var(--spacing-lg) var(--spacing-xl);
			border: 1px solid var(--color-border);
			border-radius: var(--radius-sm);
			background: white;
		}
		.plugin-info {
			display: flex;
			flex-direction: column;
			gap: var(--spacing-xs);
		}
		.plugin-name {
			font-size: var(--font-size-md);
			font-weight: 600;
		}
		.plugin-version {
			font-size: var(--font-size-xs);
			color: var(--color-muted);
		}
		.plugin-description {
			margin: var(--spacing-sm) 0 0;
			font-size: var(--font-size-sm);
			color: var(--color-description);
		}
		.btn {
			padding: var(--spacing-md) var(--spacing-xl);
			border: none;
			border-radius: var(--radius-sm);
			font-size: var(--font-size-md);
			font-weight: 500;
			cursor: pointer;

			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
		.btn-sm {
			padding: var(--spacing-sm) var(--spacing-lg);
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
		}
		.loading, .empty {
			padding: var(--spacing-2xl);
			font-size: var(--font-size-md);
			color: var(--color-muted);
			text-align: center;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'registry-plugin-list': RegistryPluginList;
	}
}
