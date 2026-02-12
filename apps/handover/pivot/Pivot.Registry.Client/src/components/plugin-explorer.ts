import './plugin-detail.ts';

import { router } from '@arcmantle/pivot-client-router';
import { css, type CSSResultGroup, html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import type { Plugin } from '../models/plugin.ts';
import { pluginApi } from '../services/plugin-api-service.ts';
import { dataAttrs } from '../utils/dom.ts';


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

	protected handleSelectPluginClick(ev: Event): void {
		const { pluginName } = dataAttrs(ev, 'pluginName');
		if (pluginName)
			this.selectPlugin(pluginName);
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
				data-plugin-name=${ plugin.name }
				@click=${ this.handleSelectPluginClick }
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
			--color-text: #333;
			--color-text-muted: #666;
			--color-text-light: #888;
			--color-text-placeholder: #999;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-primary-bg: #e8ebf7;
			--color-secondary: #6c757d;
			--color-secondary-hover: #5a6268;
			--color-border: #ddd;
			--color-border-light: #eee;
			--color-border-subtle: #f0f0f0;
			--color-bg-surface: white;
			--color-bg-muted: #f8f9fa;
			--color-shadow: rgba(0, 0, 0, 0.1);
			--spacing-xs: 4px;
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
			contain: strict;
			overflow: hidden;
			display: grid;
			grid-template-rows: auto 1fr;
			padding: var(--spacing-md) var(--spacing-xl);
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
		.explorer-layout {
			contain: strict;
			overflow: hidden;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: var(--spacing-xl);
		}
		.list-pane {
			background: var(--color-bg-surface);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			overflow: hidden;
			display: flex;
			flex-direction: column;
			margin: var(--spacing-sm);
		}
		.search-bar {
			padding: var(--spacing-md);
			border-bottom: 1px solid var(--color-border-light);
		}
		.search-input {
			width: 100%;
			padding: var(--spacing-sm) var(--spacing-md);
			border: 1px solid var(--color-border);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-base);
			box-sizing: border-box;
			transition: border-color var(--transition-speed);
			&:focus {
				outline: none;
				border-color: var(--color-primary);
			}
		}
		.plugin-list {
			list-style: none;
			margin: 0;
			padding: 0;
			overflow-y: auto;
			flex: 1;
		}
		.plugin-list-item {
			padding: var(--spacing-md) var(--spacing-lg);
			border-bottom: 1px solid var(--color-border-subtle);
			cursor: pointer;
			transition: background 0.2s;
			&:hover {
				background: var(--color-bg-muted);
			}
			&.selected {
				background: var(--color-primary-bg);
				border-left: 3px solid var(--color-primary);
			}
		}
		.plugin-name {
			font-weight: 600;
			color: var(--color-text);
			margin-bottom: var(--spacing-xs);
		}
		.plugin-meta {
			display: flex;
			gap: var(--spacing-md);
			font-size: var(--font-size-sm);
			color: var(--color-text-light);
		}
		.plugin-version {
			color: var(--color-primary);
			font-weight: 500;
		}
		.detail-pane {
			display: grid;
			overflow-y: auto;
			margin: var(--spacing-sm);
			& plugin-detail {
				padding: 0;
				max-width: none;
				margin: 0;
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
		.empty-detail {
			display: flex;
			align-items: center;
			justify-content: center;
			min-height: 400px;
			background: var(--color-bg-surface);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			color: var(--color-text-placeholder);
		}
		.btn {
			padding: var(--spacing-sm) var(--spacing-lg);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			font-size: var(--font-size-base);
			transition: all var(--transition-speed);
			text-decoration: none;
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
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'plugin-explorer': PluginExplorer;
	}
}
