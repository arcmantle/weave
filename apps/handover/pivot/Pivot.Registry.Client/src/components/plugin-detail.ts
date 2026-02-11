import { css, type CSSResultGroup, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { Plugin } from '../models/plugin.ts';
import { pluginApi } from '../services/plugin-api-service.ts';
import { formatDate, formatFileSize } from '../utils/format.ts';


@customElement('plugin-detail')
export class PluginDetail extends LitElement {

	@property({ type: String }) name = '';

	@state() private plugin:  Plugin | null = null;
	@state() private loading: boolean = false;
	@state() private error:   string | null = null;

	override connectedCallback(): void {
		super.connectedCallback();

		if (this.name)
			this.loadPlugin();
	}

	override willUpdate(changedProps: Map<PropertyKey, unknown>): void {
		if (changedProps.has('name') && this.name)
			this.loadPlugin();
	}

	private async loadPlugin(): Promise<void> {
		if (!this.name)
			return;

		this.loading = true;
		this.error = null;

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

	private async handleDownload(pluginName: string, version: string): Promise<void> {
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

	private renderVersionsTable() {
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
								${ version.dependencies.length > 0
									? version.dependencies.map(dep => html`
										<span class="dependency-tag">
											${ dep.dependencyName } ${ dep.versionRange }
										</span>
									`)
									: html`<span class="no-deps">None</span>` }
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

	private renderTags() {
		const tags = this.plugin?.tags;
		if (!tags || tags.length === 0)
			return nothing;

		return html`
			<div class="tags">
				${ tags.map(tag => html`<span class="tag">${ tag }</span>`) }
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
					${ this.plugin.latestVersion
						? html`<span class="version-badge">v${ this.plugin.latestVersion }</span>`
						: nothing }
				</div>
				${ this.plugin.author
					? html`<p class="author">by ${ this.plugin.author }</p>`
					: nothing }
				${ this.plugin.description
					? html`<p class="description">${ this.plugin.description }</p>`
					: nothing }
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

			<h3>Versions</h3>
			${ this.renderVersionsTable() }
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: block;
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
			overflow: hidden;
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
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'plugin-detail': PluginDetail;
	}
}
