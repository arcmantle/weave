import { css, type CSSResultGroup, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { router } from '../features/router/index.ts';
import type { Plugin } from '../models/plugin.ts';
import { pluginApi } from '../services/plugin-api-service.ts';


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

	private async initialize(): Promise<void> {
		await this.loadPlugins();
	}

	private async loadPlugins(): Promise<void> {
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

	private handleSearchInput(e: Event): void {
		this.search = (e.target as HTMLInputElement).value;
	}

	private async handleSearch(e?: Event): Promise<void> {
		e?.preventDefault();
		this.page = 1;
		await this.loadPlugins();
	}

	private async handlePageChange(newPage: number): Promise<void> {
		this.page = newPage;
		await this.loadPlugins();
	}

	private async viewPluginDetails(name: string): Promise<void> {
		await router.navigate(`/plugin/${ encodeURIComponent(name) }`);
	}

	private renderPagination() {
		if (this.totalPages <= 1)
			return nothing;

		return html`
			<div class="pagination">
				<button
					class="btn btn-secondary btn-small"
					?disabled=${ this.page <= 1 }
					@click=${ () => this.handlePageChange(this.page - 1) }
				>
					Previous
				</button>
				<span class="page-info">Page ${ this.page } of ${ this.totalPages }</span>
				<button
					class="btn btn-secondary btn-small"
					?disabled=${ this.page >= this.totalPages }
					@click=${ () => this.handlePageChange(this.page + 1) }
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
										@click=${ () => this.viewPluginDetails(plugin.name) }
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
			display: block;
			padding: 20px;
			max-width: 1400px;
		}

		h1 {
			margin: 0;
			color: #333;
		}

		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20px;
		}

		.header-actions {
			display: flex;
			gap: 8px;
			align-items: center;
		}

		.search-bar {
			display: flex;
			gap: 10px;
			margin-bottom: 20px;
		}

		.search-input {
			flex: 1;
			padding: 10px 16px;
			border: 1px solid #ddd;
			border-radius: 4px;
			font-size: 14px;
			transition: border-color 0.3s;
		}

		.search-input:focus {
			outline: none;
			border-color: #667eea;
		}

		.loading {
			text-align: center;
			padding: 40px;
			color: #666;
		}

		.empty-state {
			text-align: center;
			padding: 40px;
			color: #666;
		}

		.plugins-table {
			width: 100%;
			border-collapse: collapse;
			background: white;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			border-radius: 8px;
			overflow: hidden;
		}

		.plugins-table thead {
			background: #f8f9fa;
		}

		.plugins-table th {
			padding: 12px;
			text-align: left;
			font-weight: 600;
			color: #333;
			border-bottom: 2px solid #eee;
		}

		.plugins-table td {
			padding: 12px;
			border-bottom: 1px solid #eee;
		}

		.plugins-table tbody tr:hover {
			background: #f8f9fa;
		}

		.pagination {
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 16px;
			margin-top: 20px;
			padding: 16px 0;
		}

		.page-info {
			font-size: 14px;
			color: #666;
		}

		.btn {
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			transition: all 0.3s;
			text-decoration: none;
		}

		.btn-primary {
			background: #667eea;
			color: white;
		}

		.btn-primary:hover:not(:disabled) {
			background: #5568d3;
		}

		.btn-secondary {
			background: #6c757d;
			color: white;
		}

		.btn-secondary:hover {
			background: #5a6268;
		}

		.btn-small {
			padding: 6px 12px;
			font-size: 12px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.3s;
		}

		.btn:disabled,
		.btn-small:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'plugin-browse': PluginBrowse;
	}
}
