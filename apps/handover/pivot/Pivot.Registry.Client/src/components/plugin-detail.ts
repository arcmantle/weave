import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';

import type { Plugin } from '../models/plugin.ts';
import { pluginApi } from '../services/plugin-api-service.ts';
import { dataAttrs } from '../utils/dom.ts';
import { formatDate, formatFileSize } from '../utils/format.ts';
import { getMarked } from '../utils/markdown.ts';


const readmeTabKeys = [ 'root', 'server', 'client' ] as const;
type ReadmeTabKey = typeof readmeTabKeys[number];

function isReadmeTabKey(value: string): value is ReadmeTabKey {
	return (readmeTabKeys as readonly string[]).includes(value);
}

interface ReadmeTab {
	key:     ReadmeTabKey;
	label:   string;
	content: string;
}


@customElement('plugin-detail')
export class PluginDetail extends LitElement {

	@property({ type: String }) name = '';

	@state() protected plugin:          Plugin | null = null;
	@state() protected loading:         boolean = false;
	@state() protected error:           string | null = null;
	@state() protected activeReadmeTab: ReadmeTabKey = 'root';
	@state() protected renderedReadme:  string = '';

	override connectedCallback(): void {
		super.connectedCallback();

		if (this.name)
			this.loadPlugin();
	}

	override willUpdate(changedProps: Map<PropertyKey, unknown>): void {
		if (changedProps.has('name') && this.name)
			this.loadPlugin();

		if (changedProps.has('activeReadmeTab') || changedProps.has('plugin'))
			this.parseReadme();
	}

	protected async loadPlugin(): Promise<void> {
		if (!this.name)
			return;

		this.loading = true;
		this.error = null;
		this.activeReadmeTab = 'root';
		this.renderedReadme = '';

		try {
			this.plugin = await pluginApi.getPlugin(this.name);
		}
		catch (err) {
			console.error('Failed to load plugin:', err);
			this.error = err instanceof Error ? err.message : 'Failed to load plugin details';
			this.plugin = null;
		}
		finally {
			this.loading = false;
		}
	}

	protected async parseReadme(): Promise<void> {
		const tabs = this.readmeTabs;
		const activeTab = tabs.find(t => t.key === this.activeReadmeTab) ?? tabs[0];
		if (!activeTab) {
			this.renderedReadme = '';

			return;
		}

		const md = await getMarked();
		this.renderedReadme = await md.parse(activeTab.content) as string;
	}

	protected async handleDownload(pluginName: string, version: string): Promise<void> {
		try {
			const blob = await pluginApi.downloadPlugin(pluginName, version);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${ pluginName }-${ version }.pivotpkg`;
			a.click();
			URL.revokeObjectURL(url);
		}
		catch (err) {
			console.error('Failed to download plugin:', err);
			alert('Failed to download plugin');
		}
	}

	protected handleDownloadClick(ev: Event): void {
		const { pluginName, version } = dataAttrs(ev, 'pluginName', 'version');
		if (pluginName && version)
			this.handleDownload(pluginName, version);
	}

	protected handleTabClick(ev: Event): void {
		const { tab } = dataAttrs(ev, 'tab');
		if (tab && isReadmeTabKey(tab))
			this.activeReadmeTab = tab;
	}

	protected renderVersionsTable(): unknown {
		const versions = this.plugin?.versions;
		if (!versions || versions.length === 0)
			return html`<p>No versions available.</p>`;

		return html`
		<table class="versions-table">
			<thead>
				<tr>
					<th>Version</th>
					<th>File Size</th>
					<th>Downloads</th>
					<th>Uploaded</th>
					<th>Dependencies</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				${ versions.map(version => html`
				<tr>
					<td><strong>${ version.version }</strong></td>
					<td>${ formatFileSize(version.fileSize) }</td>
					<td>${ version.downloadCount }</td>
					<td>${ formatDate(version.uploadedAt) }</td>
					<td>
					${ when(version.dependencies.length > 0, () => html`
					${ version.dependencies.map(dep => html`
						<span class="dependency-tag">
							${ dep.dependencyName } ${ dep.versionRange }
						</span>
					`) }
					`, () => html`
					<span class="no-deps">None</span>
					`) }
					</td>
					<td>
						<button
							class="btn-small btn-primary"
							data-plugin-name=${ this.plugin!.name }
							data-version=${ version.version }
							@click=${ this.handleDownloadClick }
						>
							Download
						</button>
					</td>
				</tr>
				`) }
			</tbody>
		</table>
		`;
	}

	protected renderTags(): unknown {
		const tags = this.plugin?.tags;
		if (!tags || tags.length === 0)
			return;

		return html`
		<div class="tags">
			${ tags.map(tag => html`<span class="tag">${ tag }</span>`) }
		</div>
		`;
	}

	protected get readmeTabs(): ReadmeTab[] {
		const tabs: ReadmeTab[] = [];

		if (this.plugin?.readme)
			tabs.push({ key: 'root', label: 'README', content: this.plugin.readme });
		if (this.plugin?.serverReadme)
			tabs.push({ key: 'server', label: 'Server', content: this.plugin.serverReadme });
		if (this.plugin?.clientReadme)
			tabs.push({ key: 'client', label: 'Client', content: this.plugin.clientReadme });

		return tabs;
	}

	protected renderReadme(): unknown {
		const tabs = this.readmeTabs;
		if (tabs.length === 0)
			return;

		// If active tab has no content, fall back to first available
		const activeTab = tabs.find(t => t.key === this.activeReadmeTab) ?? tabs[0]!;

		return html`
		<div class="readme-section">
			${ when(tabs.length > 1, () => html`
			<div class="readme-tabs">
				${ tabs.map(tab => html`
				<button
					class="readme-tab ${ tab.key === activeTab.key ? 'active' : '' }"
					data-tab=${ tab.key }
					@click=${ this.handleTabClick }
				>
					${ tab.label }
				</button>
				`) }
			</div>
			`, () => html`
			<h3>README</h3>
			`) }
			<div class="readme">${ unsafeHTML(this.renderedReadme) }</div>
		</div>
		`;
	}

	override render(): unknown {
		if (this.loading)
			return html`<div class="loading">Loading plugin details...</div>`;

		if (this.error)
			return html`<div class="alert alert-error">${ this.error }</div>`;

		if (!this.plugin)
			return html`<div class="empty-state">No plugin selected.</div>`;

		return html`
		<div class="plugin-header">
			<div class="plugin-title-row">
				<h2>${ this.plugin.name }</h2>
				${ when(this.plugin.latestVersion, () => html`
				<span class="version-badge">v${ this.plugin!.latestVersion }</span>
				`) }
			</div>
			${ when(this.plugin.author, () => html`
			<p class="author">by ${ this.plugin!.author }</p>
			`) }
			${ when(this.plugin.description, () => html`
			<p class="description">${ this.plugin!.description }</p>
			`) }
			${ this.renderTags() }
			<div class="meta-row">
				<span class="meta-item">
					${ this.plugin.totalDownloads ?? 0 } total downloads
				</span>
				<span class="meta-item">
					${ this.plugin.versionCount ?? this.plugin.versions?.length ?? 0 } versions
				</span>
			</div>
		</div>

		${ this.renderReadme() }

		<h3>Versions</h3>
		${ this.renderVersionsTable() }
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			--color-text: #333;
			--color-text-dark: #222;
			--color-text-body: #444;
			--color-text-muted: #666;
			--color-text-light: #555;
			--color-text-placeholder: #999;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-primary-bg: #e8ebf7;
			--color-border: #ddd;
			--color-border-light: #eee;
			--color-border-tabs: #e0e0e0;
			--color-bg-surface: white;
			--color-bg-muted: #f8f9fa;
			--color-bg-code: #f4f4f4;
			--color-bg-dep: #f0f0f0;
			--color-shadow: rgba(0, 0, 0, 0.1);
			--color-alert-error-bg: #f8d7da;
			--color-alert-error-text: #721c24;
			--color-alert-error-border: #f5c6cb;
			--spacing-xs: 2px;
			--spacing-sm: 4px;
			--spacing-md: 6px;
			--spacing-lg: 8px;
			--spacing-xl: 10px;
			--spacing-2xl: 12px;
			--spacing-3xl: 16px;
			--spacing-4xl: 20px;
			--spacing-5xl: 24px;
			--spacing-6xl: 32px;
			--spacing-7xl: 40px;
			--font-size-xs: 0.9em;
			--font-size-sm: 12px;
			--font-size-base: 13px;
			--font-size-md: 14px;
			--font-family-mono: 'Cascadia Code', 'Fira Code', monospace;
			--radius-xs: 3px;
			--radius-sm: 4px;
			--radius-md: 6px;
			--radius-lg: 8px;
			--radius-pill: 12px;
			--transition-speed: 0.3s;
			contain: strict;
			overflow: hidden;
			overflow-y: auto;
			display: grid;
			grid-auto-rows: max-content;
			padding: var(--spacing-4xl);
		}
		h2 {
			margin: 0;
			color: var(--color-text);
		}
		h3 {
			color: var(--color-text);
			margin: var(--spacing-5xl) 0 var(--spacing-2xl);
		}
		.plugin-header {
			background: var(--color-bg-surface);
			padding: var(--spacing-5xl);
			border-radius: var(--radius-lg);
			box-shadow: 0 2px 8px var(--color-shadow);
		}
		.plugin-title-row {
			display: flex;
			align-items: center;
			gap: var(--spacing-2xl);
		}
		.version-badge {
			background: var(--color-primary);
			color: white;
			padding: var(--spacing-sm) var(--spacing-xl);
			border-radius: var(--radius-pill);
			font-size: var(--font-size-base);
			font-weight: 500;
		}
		.author {
			margin: var(--spacing-sm) 0 0;
			color: var(--color-text-muted);
			font-size: var(--font-size-md);
		}
		.description {
			margin: var(--spacing-2xl) 0 0;
			color: var(--color-text-body);
			line-height: 1.5;
		}
		.tags {
			display: flex;
			gap: var(--spacing-md);
			flex-wrap: wrap;
			margin-top: var(--spacing-2xl);
		}
		.tag {
			background: var(--color-primary-bg);
			color: var(--color-primary);
			padding: var(--spacing-sm) var(--spacing-xl);
			border-radius: var(--radius-sm);
			font-size: var(--font-size-sm);
			font-weight: 500;
		}
		.meta-row {
			display: flex;
			gap: var(--spacing-4xl);
			margin-top: var(--spacing-3xl);
			padding-top: var(--spacing-3xl);
			border-top: 1px solid var(--color-border-light);
		}
		.meta-item {
			font-size: var(--font-size-base);
			color: var(--color-text-muted);
		}
		.versions-table {
			width: 100%;
			border-collapse: collapse;
			background: var(--color-bg-surface);
			box-shadow: 0 2px 8px var(--color-shadow);
			border-radius: var(--radius-lg);
			& thead {
				background: var(--color-bg-muted);
			}
			& th {
				padding: var(--spacing-2xl);
				text-align: left;
				font-weight: 600;
				color: var(--color-text);
				border-bottom: 2px solid var(--color-border-light);
			}
			& td {
				padding: var(--spacing-2xl);
				border-bottom: 1px solid var(--color-border-light);
			}
			& tbody tr:hover {
				background: var(--color-bg-muted);
			}
		}
		.dependency-tag {
			display: inline-block;
			background: var(--color-bg-dep);
			padding: var(--spacing-xs) var(--spacing-lg);
			border-radius: var(--radius-xs);
			font-size: var(--font-size-sm);
			margin: var(--spacing-xs) var(--spacing-sm) var(--spacing-xs) 0;
		}
		.no-deps {
			color: var(--color-text-placeholder);
			font-size: var(--font-size-base);
		}
		.loading {
			text-align: center;
			padding: var(--spacing-7xl);
			color: var(--color-text-muted);
		}
		.empty-state {
			text-align: center;
			padding: var(--spacing-7xl);
			color: var(--color-text-placeholder);
		}
		.alert {
			padding: var(--spacing-3xl);
			border-radius: var(--radius-sm);
			margin-bottom: var(--spacing-4xl);
		}
		.alert-error {
			background: var(--color-alert-error-bg);
			color: var(--color-alert-error-text);
			border: 1px solid var(--color-alert-error-border);
		}
		.btn-small {
			padding: var(--spacing-md) var(--spacing-2xl);
			font-size: var(--font-size-sm);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			transition: all var(--transition-speed);
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;
			&:hover:not(:disabled) {
				background: var(--color-primary-hover);
			}
		}
		.readme-section {
			margin-top: var(--spacing-5xl);
		}
		.readme-tabs {
			display: flex;
			gap: 0;
			border-bottom: 2px solid var(--color-border-tabs);
			margin-bottom: 0;
		}
		.readme-tab {
			padding: var(--spacing-xl) var(--spacing-4xl);
			background: none;
			border: none;
			border-bottom: 2px solid transparent;
			margin-bottom: -2px;
			cursor: pointer;
			font-size: var(--font-size-md);
			font-weight: 500;
			color: var(--color-text-muted);
			transition: all 0.2s;
			&:hover {
				color: var(--color-text);
				background: var(--color-bg-muted);
			}
			&.active {
				color: var(--color-primary);
				border-bottom-color: var(--color-primary);
			}
		}
		.readme-tabs + .readme {
			border-radius: 0 0 var(--radius-lg) var(--radius-lg);
		}
		.readme {
			background: var(--color-bg-surface);
			padding: var(--spacing-5xl) var(--spacing-6xl);
			border-radius: var(--radius-lg);
			box-shadow: 0 2px 8px var(--color-shadow);
			line-height: 1.6;
			color: var(--color-text);
			word-wrap: break-word;
			overflow-wrap: break-word;
			& h1,
			& h2,
			& h3,
			& h4 {
				margin: 1.5em 0 0.5em;
				color: var(--color-text-dark);
			}
			& h1:first-child,
			& h2:first-child {
				margin-top: 0;
			}
			& p {
				margin: 0.75em 0;
			}
			& code {
				background: var(--color-bg-code);
				padding: var(--spacing-xs) var(--spacing-md);
				border-radius: var(--radius-xs);
				font-size: var(--font-size-xs);
				font-family: var(--font-family-mono);
			}
			& pre {
				padding: var(--spacing-3xl);
				border-radius: var(--radius-md);
				overflow-x: auto;
				font-size: var(--font-size-base);
				line-height: 1.5;
				& code {
					background: none;
					padding: 0;
					color: inherit;
				}
			}
			& .shiki {
				padding: var(--spacing-3xl);
				border-radius: var(--radius-md);
				overflow-x: auto;
				font-size: var(--font-size-base);
				line-height: 1.5;
				font-family: var(--font-family-mono);
			}
			& ul,
			& ol {
				padding-left: 1.5em;
			}
			& li {
				margin: 0.25em 0;
			}
			& blockquote {
				border-left: 3px solid var(--color-primary);
				margin: 1em 0;
				padding: 0.5em 1em;
				color: var(--color-text-light);
				background: var(--color-bg-muted);
				border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
			}
			& a {
				color: var(--color-primary);
				text-decoration: none;
				&:hover {
					text-decoration: underline;
				}
			}
			& table {
				width: 100%;
				border-collapse: collapse;
				margin: 1em 0;
			}
			& th,
			& td {
				border: 1px solid var(--color-border);
				padding: var(--spacing-lg) var(--spacing-2xl);
				text-align: left;
			}
			& th {
				background: var(--color-bg-muted);
				font-weight: 600;
			}
			& hr {
				border: none;
				border-top: 1px solid var(--color-border-light);
				margin: 1.5em 0;
			}
			& img {
				max-width: 100%;
				height: auto;
				border-radius: var(--radius-sm);
			}
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'plugin-detail': PluginDetail;
	}
}
