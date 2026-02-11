import './plugin-detail.ts';

import { css, type CSSResultGroup, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { router } from '../features/router/index.ts';
import type { Plugin } from '../models/plugin.ts';
import { authService } from '../services/auth-service.ts';
import { type AccessMode, configService } from '../services/config-service.ts';
import { pluginApi } from '../services/plugin-api-service.ts';


@customElement('plugin-explorer')
export class PluginExplorer extends LitElement {

	@property({ type: String }) name = '';

	@state() private plugins:     Plugin[] = [];
	@state() private loading:     boolean = false;
	@state() private currentUser: string | null = null;
	@state() private accessMode:  AccessMode = 'private';
	@state() private search:      string = '';

	override connectedCallback(): void {
		super.connectedCallback();
		this.initialize();
	}

	private async initialize(): Promise<void> {
		const config = await configService.getConfig();
		this.accessMode = config.accessMode;
		this.currentUser = await authService.getCurrentUser();
		await this.loadPlugins();
	}

	private async loadPlugins(): Promise<void> {
		this.loading = true;
		try {
			const response = await pluginApi.getPlugins({
				search:   this.search || undefined,
				pageSize: 100,
			});
			this.plugins = response.plugins;
		}
		catch (err) {
			console.error('Failed to load plugins:', err);
		}
		finally {
			this.loading = false;
		}
	}

	private get isAuthenticated(): boolean {
		return !!this.currentUser;
	}

	private async handleLogin(): Promise<void> {
		await router.navigate('/login');
	}

	private async handleLogout(): Promise<void> {
		await authService.logout();
		if (this.accessMode === 'private')
			await router.navigate('/login');
		else
			this.currentUser = null;
	}

	private handleSearchInput(e: Event): void {
		this.search = (e.target as HTMLInputElement).value;
	}

	private async handleSearch(e?: Event): Promise<void> {
		e?.preventDefault();
		await this.loadPlugins();
	}

	private async selectPlugin(name: string): Promise<void> {
		await router.navigate(`/explore/${ encodeURIComponent(name) }`);
	}

	private renderPluginList() {
		if (this.loading)
			return html`<div class="loading">Loading...</div>`;

		if (this.plugins.length === 0)
			return html`<div class="empty-state">No plugins found.</div>`;

		return html`
			<ul class="plugin-list">
				${ this.plugins.map(plugin => html`
					<li
						class="plugin-list-item ${ this.name === plugin.name ? 'selected' : '' }"
						@click=${ () => this.selectPlugin(plugin.name) }
					>
						<div class="plugin-name">${ plugin.name }</div>
						<div class="plugin-meta">
							${ plugin.latestVersion
								? html`<span class="plugin-version">v${ plugin.latestVersion }</span>`
								: nothing }
							${ plugin.author
								? html`<span class="plugin-author">${ plugin.author }</span>`
								: nothing }
						</div>
					</li>
				`) }
			</ul>
		`;
	}

	override render(): unknown {
		return html`
			<div class="header-bar">
				<h1>Plugin Explorer</h1>
				<div class="header-actions">
					<router-link to="/" class="btn btn-secondary">Dashboard</router-link>
					${ this.isAuthenticated
						? html`
							<button class="btn btn-secondary" @click=${ this.handleLogout }>
								Logout (${ this.currentUser })
							</button>
						`
						: this.accessMode === 'public'
							? html`
								<button class="btn btn-primary" @click=${ this.handleLogin }>
									Login
								</button>
							`
							: nothing }
				</div>
			</div>

			<div class="explorer-layout">
				<div class="list-pane">
					<form class="search-bar" @submit=${ this.handleSearch }>
						<input
							type="text"
							class="search-input"
							placeholder="Filter plugins..."
							.value=${ this.search }
							@input=${ this.handleSearchInput }
						/>
					</form>
					${ this.renderPluginList() }
				</div>

				<div class="detail-pane">
					${ this.name
						? html`<plugin-detail .name=${ this.name }></plugin-detail>`
						: html`
							<div class="empty-detail">
								<p>Select a plugin from the list to view its details.</p>
							</div>
						` }
				</div>
			</div>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: block;
			padding: 20px;
			max-width: 1400px;
			margin: 0 auto;
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

		.explorer-layout {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 20px;
			min-height: 600px;
		}

		.list-pane {
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			overflow: hidden;
			display: flex;
			flex-direction: column;
		}

		.search-bar {
			padding: 12px;
			border-bottom: 1px solid #eee;
		}

		.search-input {
			width: 100%;
			padding: 8px 12px;
			border: 1px solid #ddd;
			border-radius: 4px;
			font-size: 14px;
			box-sizing: border-box;
			transition: border-color 0.3s;
		}

		.search-input:focus {
			outline: none;
			border-color: #667eea;
		}

		.plugin-list {
			list-style: none;
			margin: 0;
			padding: 0;
			overflow-y: auto;
			flex: 1;
		}

		.plugin-list-item {
			padding: 12px 16px;
			border-bottom: 1px solid #f0f0f0;
			cursor: pointer;
			transition: background 0.2s;
		}

		.plugin-list-item:hover {
			background: #f8f9fa;
		}

		.plugin-list-item.selected {
			background: #e8ebf7;
			border-left: 3px solid #667eea;
		}

		.plugin-name {
			font-weight: 600;
			color: #333;
			margin-bottom: 4px;
		}

		.plugin-meta {
			display: flex;
			gap: 12px;
			font-size: 12px;
			color: #888;
		}

		.plugin-version {
			color: #667eea;
			font-weight: 500;
		}

		.detail-pane {
			overflow-y: auto;
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

		.empty-detail {
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 400px;
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			color: #999;
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
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'plugin-explorer': PluginExplorer;
	}
}
