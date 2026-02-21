import './registry-plugin-list.ts';

import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { dataAttrs } from '../../../utils/dom.ts';
import type { RegistryConnection } from '../models/registry.ts';
import { registryConnectionService } from '../services/registry-connection-service.ts';
import type { RegistryPluginList } from './registry-plugin-list.ts';


@customElement('registry-browser')
export class RegistryBrowser extends LitElement {

	@state() protected connections:        RegistryConnection[] = [];
	@state() protected selectedRegistryId: string | null = null;
	@state() protected showAddForm = false;

	@query('registry-plugin-list') protected pluginList!: RegistryPluginList;

	protected unsubscribe?: () => void;

	override connectedCallback(): void {
		super.connectedCallback();
		this.connections = registryConnectionService.getConnections();
		this.unsubscribe = registryConnectionService.onChange(() => {
			this.connections = registryConnectionService.getConnections();
		});
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
	}

	protected handleAddRegistry(ev: Event): void {
		ev.preventDefault();
		const form = ev.target as HTMLFormElement;
		const formData = new FormData(form);
		const name = formData.get('name') as string;
		const url = formData.get('url') as string;

		if (name && url) {
			registryConnectionService.addConnection(name, url);
			form.reset();
			this.showAddForm = false;
		}
	}

	protected handleRemoveClick(ev: Event): void {
		ev.stopPropagation();
		const { connectionId } = dataAttrs(ev, 'connectionId');
		if (!connectionId)
			return;

		registryConnectionService.removeConnection(connectionId);
		if (this.selectedRegistryId === connectionId)
			this.selectedRegistryId = null;
	}

	protected handleSelectClick(ev: Event): void {
		const { connectionId } = dataAttrs(ev, 'connectionId');
		if (!connectionId)
			return;

		const connection = this.connections.find(c => c.id === connectionId);
		if (!connection)
			return;

		this.selectedRegistryId = connection.id;
		this.updateComplete.then(() => {
			this.pluginList?.setRegistry(connection.name, connection.url);
		});
	}

	protected handleToggleAddForm(): void {
		this.showAddForm = !this.showAddForm;
	}

	override render(): unknown {
		return html`
		<div class="registry-browser">
			<div class="sidebar">
				<div class="sidebar-header">
					<h2>Registries</h2>
					<button class="btn btn-sm btn-primary" @click=${ this.handleToggleAddForm }>
						${ this.showAddForm ? '✕' : '+ Add' }
					</button>
				</div>

				${ when(this.showAddForm, () => html`
				<form class="add-form" @submit=${ this.handleAddRegistry }>
					<input type="text" name="name" placeholder="Registry name" required />
					<input type="url" name="url" placeholder="https://registry.example.com" required />
					<button class="btn btn-primary" type="submit">Connect</button>
				</form>
				`) }

				<div class="connection-list">
					${ when(this.connections.length === 0, () => html`
					<div class="empty-connections">No registries connected. Click "+ Add" to connect one.</div>
					`) }

					${ this.connections.map(conn => html`
					<div
						class="connection-item ${ this.selectedRegistryId === conn.id ? 'selected' : '' }"
						data-connection-id="${ conn.id }"
						@click=${ this.handleSelectClick }
					>
						<div class="connection-info">
							<span class="connection-name">${ conn.name }</span>
							<span class="connection-url">${ conn.url }</span>
						</div>
						<button
							class="btn-remove"
							data-connection-id="${ conn.id }"
							@click=${ this.handleRemoveClick }
							title="Remove registry"
						>
							✕
						</button>
					</div>
					`) }
				</div>
			</div>

			<div class="content">
				<registry-plugin-list></registry-plugin-list>
			</div>
		</div>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			--color-heading: #1a1a2e;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-selected-bg: #e8ecff;
			--color-hover-bg: #f8f9fa;
			--color-form-bg: #f8f9fa;
			--color-content-bg: #f8f9fa;
			--color-muted: #888;
			--color-remove: #ccc;
			--color-remove-hover: #dc3545;
			--color-border: #eee;
			--color-border-light: #f0f0f0;
			--color-input-border: #ddd;
			--font-size-xs: 12px;
			--font-size-sm: 13px;
			--font-size-md: 14px;
			--font-size-heading: 18px;
			--font-size-remove: 16px;
			--spacing-xs: 2px;
			--spacing-sm: 4px;
			--spacing-md: 8px;
			--spacing-lg: 12px;
			--spacing-xl: 16px;
			--spacing-2xl: 24px;
			--radius-sm: 6px;
			--radius-md: 8px;
			--sidebar-width: 320px;
			display: block;
			padding: var(--spacing-2xl);
			height: 100%;
			box-sizing: border-box;
		}
		.registry-browser {
			display: grid;
			grid-template-columns: var(--sidebar-width) 1fr;
			gap: var(--spacing-2xl);
			height: 100%;
		}
		.sidebar {
			display: flex;
			flex-direction: column;
			border-radius: var(--radius-md);
			background: white;
			overflow: hidden;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		}
		.sidebar-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: var(--spacing-xl);
			border-bottom: 1px solid var(--color-border);

			& h2 {
				margin: 0;
				font-size: var(--font-size-heading);
				color: var(--color-heading);
			}
		}
		.add-form {
			display: flex;
			flex-direction: column;
			gap: var(--spacing-md);
			padding: var(--spacing-xl);
			border-bottom: 1px solid var(--color-border);
			background: var(--color-form-bg);

			& input {
				padding: var(--spacing-md) var(--spacing-lg);
				border: 1px solid var(--color-input-border);
				border-radius: var(--radius-sm);
				font-size: var(--font-size-md);

				&:focus {
					border-color: var(--color-primary);
					outline: none;
				}
			}
		}
		.connection-list {
			flex: 1;
			overflow-y: auto;
		}
		.connection-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: var(--spacing-lg) var(--spacing-xl);
			border-bottom: 1px solid var(--color-border-light);
			cursor: pointer;
			transition: background 0.15s;

			&:hover { background: var(--color-hover-bg); }

			&.selected {
				border-left: 3px solid var(--color-primary);
				background: var(--color-selected-bg);
			}
		}
		.connection-info {
			display: flex;
			flex-direction: column;
			gap: var(--spacing-xs);
			min-width: 0;
		}
		.connection-name {
			font-size: var(--font-size-md);
			font-weight: 600;
		}
		.connection-url {
			overflow: hidden;
			font-size: var(--font-size-xs);
			color: var(--color-muted);
			white-space: nowrap;
			text-overflow: ellipsis;
		}
		.btn-remove {
			padding: var(--spacing-sm);
			border: none;
			font-size: var(--font-size-remove);
			line-height: 1;
			color: var(--color-remove);
			background: none;
			cursor: pointer;

			&:hover { color: var(--color-remove-hover); }
		}
		.content {
			padding: var(--spacing-xl);
			border-radius: var(--radius-md);
			background: var(--color-content-bg);
		}
		.empty-connections {
			padding: var(--spacing-2xl) var(--spacing-xl);
			font-size: var(--font-size-md);
			color: var(--color-muted);
			text-align: center;
		}
		.btn {
			padding: var(--spacing-md) var(--spacing-xl);
			border: none;
			border-radius: var(--radius-sm);
			font-size: var(--font-size-md);
			font-weight: 500;
			cursor: pointer;
		}
		.btn-sm {
			padding: var(--spacing-sm) var(--spacing-lg);
			font-size: var(--font-size-sm);
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;

			&:hover { background: var(--color-primary-hover); }
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'registry-browser': RegistryBrowser;
	}
}
