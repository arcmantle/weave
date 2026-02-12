import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';

import type { Plugin } from '../models/plugin.ts';
import { pluginApi } from '../services/plugin-api-service.ts';
import { formatDate, formatFileSize } from '../utils/format.ts';
import { getMarked } from '../utils/markdown.ts';


type ReadmeTabKey = 'root' | 'server' | 'client';

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
									@click=${ () => this.handleDownload(this.plugin!.name, version.version) }
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
								@click=${ () => { this.activeReadmeTab = tab.key; } }
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
			contain: strict;
			overflow: hidden;
			overflow-y: auto;
			display: grid;
			grid-auto-rows: max-content;
			padding: 20px;
		}

		h2 {
			margin: 0;
			color: #333;
		}

		h3 {
			color: #333;
			margin: 24px 0 12px;
		}

		.plugin-header {
			background: white;
			padding: 24px;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		}

		.plugin-title-row {
			display: flex;
			align-items: center;
			gap: 12px;
		}

		.version-badge {
			background: #667eea;
			color: white;
			padding: 4px 10px;
			border-radius: 12px;
			font-size: 13px;
			font-weight: 500;
		}

		.author {
			margin: 4px 0 0;
			color: #666;
			font-size: 14px;
		}

		.description {
			margin: 12px 0 0;
			color: #444;
			line-height: 1.5;
		}

		.tags {
			display: flex;
			gap: 6px;
			flex-wrap: wrap;
			margin-top: 12px;
		}

		.tag {
			background: #e8ebf7;
			color: #667eea;
			padding: 4px 10px;
			border-radius: 4px;
			font-size: 12px;
			font-weight: 500;
		}

		.meta-row {
			display: flex;
			gap: 20px;
			margin-top: 16px;
			padding-top: 16px;
			border-top: 1px solid #eee;
		}

		.meta-item {
			font-size: 13px;
			color: #666;
		}

		.versions-table {
			width: 100%;
			border-collapse: collapse;
			background: white;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			border-radius: 8px;
		}

		.versions-table thead {
			background: #f8f9fa;
		}

		.versions-table th {
			padding: 12px;
			text-align: left;
			font-weight: 600;
			color: #333;
			border-bottom: 2px solid #eee;
		}

		.versions-table td {
			padding: 12px;
			border-bottom: 1px solid #eee;
		}

		.versions-table tbody tr:hover {
			background: #f8f9fa;
		}

		.dependency-tag {
			display: inline-block;
			background: #f0f0f0;
			padding: 2px 8px;
			border-radius: 3px;
			font-size: 12px;
			margin: 2px 4px 2px 0;
		}

		.no-deps {
			color: #999;
			font-size: 13px;
		}

		.loading {
			text-align: center;
			padding: 40px;
			color: #666;
		}

		.empty-state {
			text-align: center;
			padding: 40px;
			color: #999;
		}

		.alert {
			padding: 16px;
			border-radius: 4px;
			margin-bottom: 20px;
		}

		.alert-error {
			background: #f8d7da;
			color: #721c24;
			border: 1px solid #f5c6cb;
		}

		.btn-small {
			padding: 6px 12px;
			font-size: 12px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.3s;
		}

		.btn-primary {
			background: #667eea;
			color: white;
		}

		.btn-primary:hover:not(:disabled) {
			background: #5568d3;
		}

		.readme-section {
			margin-top: 24px;
		}

		.readme-tabs {
			display: flex;
			gap: 0;
			border-bottom: 2px solid #e0e0e0;
			margin-bottom: 0;
		}

		.readme-tab {
			padding: 10px 20px;
			background: none;
			border: none;
			border-bottom: 2px solid transparent;
			margin-bottom: -2px;
			cursor: pointer;
			font-size: 14px;
			font-weight: 500;
			color: #666;
			transition: all 0.2s;
		}

		.readme-tab:hover {
			color: #333;
			background: #f8f9fa;
		}

		.readme-tab.active {
			color: #667eea;
			border-bottom-color: #667eea;
		}

		.readme-tabs + .readme {
			border-radius: 0 0 8px 8px;
		}

		.readme {
			background: white;
			padding: 24px 32px;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			line-height: 1.6;
			color: #333;
			word-wrap: break-word;
			overflow-wrap: break-word;
		}

		.readme h1,
		.readme h2,
		.readme h3,
		.readme h4 {
			margin: 1.5em 0 0.5em;
			color: #222;
		}

		.readme h1:first-child,
		.readme h2:first-child {
			margin-top: 0;
		}

		.readme p {
			margin: 0.75em 0;
		}

		.readme code {
			background: #f4f4f4;
			padding: 2px 6px;
			border-radius: 3px;
			font-size: 0.9em;
			font-family: 'Cascadia Code', 'Fira Code', monospace;
		}

		.readme pre {
			padding: 16px;
			border-radius: 6px;
			overflow-x: auto;
			font-size: 13px;
			line-height: 1.5;
		}

		.readme pre code {
			background: none;
			padding: 0;
			color: inherit;
		}

		/* Shiki generates its own <pre> with inline background/color styles */
		.readme .shiki {
			padding: 16px;
			border-radius: 6px;
			overflow-x: auto;
			font-size: 13px;
			line-height: 1.5;
			font-family: 'Cascadia Code', 'Fira Code', monospace;
		}

		.readme ul,
		.readme ol {
			padding-left: 1.5em;
		}

		.readme li {
			margin: 0.25em 0;
		}

		.readme blockquote {
			border-left: 3px solid #667eea;
			margin: 1em 0;
			padding: 0.5em 1em;
			color: #555;
			background: #f8f9fa;
			border-radius: 0 4px 4px 0;
		}

		.readme a {
			color: #667eea;
			text-decoration: none;
		}

		.readme a:hover {
			text-decoration: underline;
		}

		.readme table {
			width: 100%;
			border-collapse: collapse;
			margin: 1em 0;
		}

		.readme th,
		.readme td {
			border: 1px solid #ddd;
			padding: 8px 12px;
			text-align: left;
		}

		.readme th {
			background: #f8f9fa;
			font-weight: 600;
		}

		.readme hr {
			border: none;
			border-top: 1px solid #eee;
			margin: 1.5em 0;
		}

		.readme img {
			max-width: 100%;
			height: auto;
			border-radius: 4px;
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'plugin-detail': PluginDetail;
	}
}
