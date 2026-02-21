import { router } from '@arcmantle/pivot-client-router';
import { css, type CSSResultGroup, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import type { Plugin } from '../models/plugin.ts';
import { pluginApi } from '../services/plugin-api-service.ts';
import { dataAttrs } from '../utils/dom.ts';


@customElement('plugin-browse')
export class PluginBrowse extends LitElement {

	@state() protected plugins:    Plugin[] = [];
	@state() protected loading:    boolean = false;
	@state() protected search:     string = '';
	@state() protected page:       number = 1;
	@state() protected totalPages: number = 1;

	override connectedCallback(): void {
		super.connectedCallback();
		this.initialize();
	}

	protected async initialize(): Promise<void> {
		await this.loadPlugins();
	}

	protected async loadPlugins(): Promise<void> {
		this.loading = true;
		try {
			const response = await pluginApi.getPlugins({
				search:   this.search || undefined,
				page:     this.page,
				pageSize: 20,
			});
			this.plugins = response.plugins;
			this.totalPages = response.totalPages;
		}
		catch (err) {
			console.error('Failed to load plugins:', err);
		}
		finally {
			this.loading = false;
		}
	}

	protected handleSearchInput(e: Event): void {
		this.search = (e.target as HTMLInputElement).value;
	}

	protected async handleSearch(e?: Event): Promise<void> {
		e?.preventDefault();
		this.page = 1;
		await this.loadPlugins();
	}

	protected handlePreviousPage(): void {
		if (this.page > 1) {
			this.page--;
			this.loadPlugins();
		}
	}

	protected handleNextPage(): void {
		if (this.page < this.totalPages) {
			this.page++;
			this.loadPlugins();
		}
	}

	protected handleViewDetails(ev: Event): void {
		const { pluginName } = dataAttrs(ev, 'pluginName');
		if (pluginName)
			router.navigate(`/plugin/${ encodeURIComponent(pluginName) }`);
	}

	protected renderPagination(): unknown {
		if (this.totalPages <= 1)
			return nothing;

		return html`
		<div class="pagination">
			<button
				class="btn btn-secondary btn-small"
				?disabled=${ this.page <= 1 }
				@click=${ this.handlePreviousPage }
			>
				Previous
			</button>
			<span class="page-info">Page ${ this.page } of ${ this.totalPages }</span>
			<button
				class="btn btn-secondary btn-small"
				?disabled=${ this.page >= this.totalPages }
				@click=${ this.handleNextPage }
			>
				Next
			</button>
		</div>
		`;
	}

	override render(): unknown {
		return html`
		<div class="header-bar">
			<h1>Browse Plugins</h1>
		</div>

		<form class="search-bar" @submit=${ this.handleSearch }>
			<input
				type="text"
				class="search-input"
				placeholder="Search plugins..."
				.value=${ this.search }
				@input=${ this.handleSearchInput }
			/>
			<button type="submit" class="btn btn-primary">Search</button>
		</form>

		${ when(this.loading, () => html`
		<div class="loading">Loading...</div>
		`, () => when(this.plugins.length === 0, () => html`
		<p class="empty-state">No plugins found.</p>
		`, () => html`
		<table class="plugins-table">
			<thead>
				<tr>
					<th>Name</th>
					<th>Latest Version</th>
					<th>Author</th>
					<th>Description</th>
					<th>Downloads</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				${ this.plugins.map(plugin => html`
				<tr>
					<td><strong>${ plugin.name }</strong></td>
					<td>${ plugin.latestVersion ?? 'N/A' }</td>
					<td>${ plugin.author ?? '' }</td>
					<td>${ plugin.description ?? '' }</td>
					<td>${ plugin.totalDownloads ?? 0 }</td>
					<td>
						<button
							class="btn-small btn-primary"
							data-plugin-name="${ plugin.name }"
							@click=${ this.handleViewDetails }
						>
							View Details
						</button>
					</td>
				</tr>
				`) }
			</tbody>
		</table>
		${ this.renderPagination() }
		`)) }
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			--color-text: #333;
			--color-text-muted: #666;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-secondary: #6c757d;
			--color-secondary-hover: #5a6268;
			--color-border: #ddd;
			--color-border-light: #eee;
			--color-bg-surface: white;
			--color-bg-muted: #f8f9fa;
			--color-shadow: rgba(0, 0, 0, 0.1);
			--spacing-sm: 8px;
			--spacing-md: 12px;
			--spacing-lg: 16px;
			--spacing-xl: 20px;
			--spacing-2xl: 40px;
			--font-size-sm: 12px;
			--font-size-base: 14px;
			--radius-sm: 4px;
			--radius-md: 8px;
			--transition-speed: 0.3s;
			display: block;
			padding: var(--spacing-xl);
			max-width: 1400px;
		}
		h1 {
			margin: 0;
			color: var(--color-text);
		}
		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--spacing-xl);
		}
		.header-actions {
			display: flex;
			gap: var(--spacing-sm);
			align-items: center;
		}
		.search-bar {
			display: flex;
			gap: 10px;
			margin-bottom: var(--spacing-xl);
		}
		.search-input {
			flex: 1;
			padding: 10px var(--spacing-lg);
			border: 1px solid var(--color-border);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-base);
			transition: border-color var(--transition-speed);
			&:focus {
				outline: none;
				border-color: var(--color-primary);
			}
		}
		.loading {
			text-align: center;
			padding: var(--spacing-2xl);
			color: var(--color-text-muted);
		}
		.empty-state {
			text-align: center;
			padding: var(--spacing-2xl);
			color: var(--color-text-muted);
		}
		.plugins-table {
			width: 100%;
			border-collapse: collapse;
			background: var(--color-bg-surface);
			box-shadow: 0 2px 8px var(--color-shadow);
			border-radius: var(--radius-md);
			overflow: hidden;
			& thead {
				background: var(--color-bg-muted);
			}
			& th {
				padding: var(--spacing-md);
				text-align: left;
				font-weight: 600;
				color: var(--color-text);
				border-bottom: 2px solid var(--color-border-light);
			}
			& td {
				padding: var(--spacing-md);
				border-bottom: 1px solid var(--color-border-light);
			}
			& tbody tr:hover {
				background: var(--color-bg-muted);
			}
		}
		.pagination {
			display: flex;
			justify-content: center;
			align-items: center;
			gap: var(--spacing-lg);
			margin-top: var(--spacing-xl);
			padding: var(--spacing-lg) 0;
		}
		.page-info {
			font-size: var(--font-size-base);
			color: var(--color-text-muted);
		}
		.btn {
			padding: var(--spacing-sm) var(--spacing-lg);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			font-size: var(--font-size-base);
			transition: all var(--transition-speed);
			text-decoration: none;
			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;
			&:hover:not(:disabled) {
				background: var(--color-primary-hover);
			}
		}
		.btn-secondary {
			background: var(--color-secondary);
			color: white;
			&:hover:not(:disabled) {
				background: var(--color-secondary-hover);
			}
		}
		.btn-small {
			padding: 6px var(--spacing-md);
			font-size: var(--font-size-sm);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			transition: all var(--transition-speed);
			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'plugin-browse': PluginBrowse;
	}
}
