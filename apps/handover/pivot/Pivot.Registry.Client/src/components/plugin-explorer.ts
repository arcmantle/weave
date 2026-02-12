import './plugin-detail.ts';

import { css, type CSSResultGroup, html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { router } from '../features/router/index.ts';
import type { Plugin } from '../models/plugin.ts';
import { pluginApi } from '../services/plugin-api-service.ts';


@customElement('plugin-explorer')
export class PluginExplorer extends LitElement {

	@property({ type: String }) name = '';

	@state() protected plugins: Plugin[] = [];
	@state() protected loading: boolean = false;
	@state() protected search:  string = '';

	protected previousName = '';

	override connectedCallback(): void {
		super.connectedCallback();
		this.previousName = this.name;
		this.initialize();
	}

	protected override scheduleUpdate(): void | Promise<unknown> {
		// If the name changed, play exit animation on old content before Lit renders.
		if (this.previousName && this.name !== this.previousName) {
			const pane = this.shadowRoot?.querySelector('.detail-pane') as HTMLElement | null;

			if (pane) {
				pane.getAnimations().forEach(a => a.cancel());

				// Slide old content down while fading out.
				return pane.animate(
					[
						{ transform: 'translateY(0)',    opacity: 1 },
						{ transform: 'translateY(20px)', opacity: 0 },
					],
					{
						duration: 180,
						easing:   'ease-in',
						fill:     'forwards',
					},
				).finished.then(() => super.scheduleUpdate());
			}
		}

		super.scheduleUpdate();
	}

	override updated(changed: PropertyValues<this>): void {
		if (!changed.has('name'))
			return;

		const oldName = changed.get('name');

		// Skip entrance animation on first render.
		if (oldName === undefined && !this.previousName)
			return;

		this.previousName = this.name;

		const pane = this.shadowRoot?.querySelector('.detail-pane') as HTMLElement | null;
		if (!pane)
			return;

		// Slide new content in from the top.
		pane.animate(
			[
				{ transform: 'translateY(-12px)', opacity: 0 },
				{ transform: 'translateY(0)',     opacity: 1 },
			],
			{
				duration: 200,
				easing:   'ease-out',
				fill:     'forwards',
			},
		);
	}

	protected async initialize(): Promise<void> {
		await this.loadPlugins();
	}

	protected async loadPlugins(): Promise<void> {
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

	protected handleSearchInput(e: Event): void {
		this.search = (e.target as HTMLInputElement).value;
	}

	protected async handleSearch(e?: Event): Promise<void> {
		e?.preventDefault();
		await this.loadPlugins();
	}

	protected async selectPlugin(name: string): Promise<void> {
		await router.navigate(`/explore/${ encodeURIComponent(name) }`);
	}

	protected renderPluginList(): unknown {
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
							${ when(plugin.latestVersion, () => html`
								<span class="plugin-version">v${ plugin.latestVersion }</span>
							`) }
							${ when(plugin.author, () => html`
								<span class="plugin-author">${ plugin.author }</span>
							`) }
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
					${ when(this.name, () => html`
						<plugin-detail .name=${ this.name }></plugin-detail>
					`, () => html`
						<div class="empty-detail">
							<p>Select a plugin from the list to view its details.</p>
						</div>
					`) }
				</div>
			</div>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			contain: strict;
			overflow: hidden;
			display: grid;
			grid-template-rows: auto 1fr;
			padding: 12px 20px;
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

		.explorer-layout {
			contain: strict;
			overflow: hidden;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 20px;
		}

		.list-pane {
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			overflow: hidden;
			display: flex;
			flex-direction: column;
			margin: 8px;
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
			display: grid;
			overflow-y: auto;
			margin: 8px;
		}

		.detail-pane plugin-detail {
			padding: 0;
			max-width: none;
			margin: 0;
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
