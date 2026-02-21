import { authService } from '@arcmantle/pivot-client-auth';
import { router } from '@arcmantle/pivot-client-router';
import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import type { Plugin } from '../models/plugin.ts';
import { pluginApi } from '../services/plugin-api-service.ts';
import { dataAttrs } from '../utils/dom.ts';
import { formatDate, formatFileSize } from '../utils/format.ts';


@customElement('plugin-admin')
export class PluginAdmin extends LitElement {

	@state() protected plugins:        Plugin[] = [];
	@state() protected loading:        boolean = false;
	@state() protected currentUser:    string | null = null;
	@state() protected uploadStatus:   string | null = null;
	@state() protected uploadError:    string | null = null;
	@state() protected uploadProgress: boolean = false;
	@state() protected expandedPlugin: string | null = null;
	@state() protected pluginDetails:  Map<string, Plugin> = new Map();

	override connectedCallback(): void {
		super.connectedCallback();
		this.initialize();
	}

	protected async initialize(): Promise<void> {
		this.currentUser = await authService.getCurrentUser();
		await this.loadPlugins();
	}

	protected async loadPlugins(): Promise<void> {
		this.loading = true;
		try {
			const response = await pluginApi.getPlugins({ pageSize: 100 });
			// Filter to plugins the current user is the author of
			this.plugins = response.plugins.filter(
				p => p.author === this.currentUser,
			);
		}
		catch (err) {
			console.error('Failed to load plugins:', err);
		}
		finally {
			this.loading = false;
		}
	}

	protected async toggleExpand(pluginName: string): Promise<void> {
		if (this.expandedPlugin === pluginName) {
			this.expandedPlugin = null;

			return;
		}

		this.expandedPlugin = pluginName;

		// Fetch full detail if we haven't already
		if (!this.pluginDetails.has(pluginName)) {
			try {
				const detail = await pluginApi.getPlugin(pluginName);
				this.pluginDetails = new Map(this.pluginDetails).set(pluginName, detail);
			}
			catch (err) {
				console.error('Failed to load plugin details:', err);
			}
		}
	}

	protected async deleteVersion(pluginName: string, version: string): Promise<void> {
		if (!confirm(`Delete ${ pluginName } version ${ version }?`))
			return;

		try {
			await pluginApi.deleteVersion(pluginName, version);
			// Refresh the detail for this plugin
			const detail = await pluginApi.getPlugin(pluginName);
			this.pluginDetails = new Map(this.pluginDetails).set(pluginName, detail);
			await this.loadPlugins();
		}
		catch (err) {
			console.error('Failed to delete version:', err);
			alert('Failed to delete plugin version');
		}
	}

	protected handleDeleteVersionClick(ev: Event): void {
		const { pluginName, version } = dataAttrs(ev, 'pluginName', 'version');
		if (pluginName && version)
			this.deleteVersion(pluginName, version);
	}

	protected handleToggleExpandClick(ev: Event): void {
		const { pluginName } = dataAttrs(ev, 'pluginName');
		if (pluginName)
			this.toggleExpand(pluginName);
	}

	protected async handleLogout(): Promise<void> {
		await authService.logout();
		await router.navigate('/login');
	}

	/* ── Upload handling ── */

	protected selectedFile: File | null = null;

	protected handleFileSelect(e: Event): void {
		const input = e.target as HTMLInputElement;
		this.selectedFile = input.files?.[0] || null;
		this.uploadStatus = null;
		this.uploadError = null;
	}

	protected async handleUpload(): Promise<void> {
		if (!this.selectedFile) {
			this.uploadError = 'Please select a file to upload';

			return;
		}

		if (!this.selectedFile.name.endsWith('.pivotpkg')) {
			this.uploadError = 'Please select a valid .pivotpkg file';

			return;
		}

		this.uploadProgress = true;
		this.uploadError = null;
		this.uploadStatus = null;

		try {
			const result = await pluginApi.uploadPlugin(this.selectedFile);
			this.uploadStatus = `Successfully uploaded ${ result.plugin } v${ result.version }`;
			this.selectedFile = null;

			const input = this.shadowRoot?.querySelector('#plugin-file') as HTMLInputElement;
			if (input)
				input.value = '';

			await this.loadPlugins();
		}
		catch (error) {
			this.uploadError = error instanceof Error ? error.message : 'Upload failed';
		}
		finally {
			this.uploadProgress = false;
		}
	}

	/* ── Rendering ── */

	protected renderUploadSection(): unknown {
		return html`
		<section class="section">
			<h2>Upload Plugin Package</h2>

			${ when(this.uploadStatus, () => html`
			<div class="alert alert-success">${ this.uploadStatus }</div>
			`) }
			${ when(this.uploadError, () => html`
			<div class="alert alert-error">${ this.uploadError }</div>
			`) }

			<div class="upload-form">
				<div class="form-group">
					<label for="plugin-file">Select .pivotpkg file</label>
					<input
						type="file"
						id="plugin-file"
						accept=".pivotpkg"
						?disabled=${ this.uploadProgress }
						@change=${ this.handleFileSelect }
					/>
				</div>

				${ when(this.uploadProgress, () => html`
				<div class="upload-progress">Uploading...</div>
				`) }

				<div class="form-actions">
					<button
						class="btn btn-primary"
						@click=${ this.handleUpload }
						?disabled=${ this.uploadProgress }
					>
						Upload Plugin
					</button>
				</div>
			</div>
		</section>
		`;
	}

	protected renderVersionsForPlugin(pluginName: string): unknown {
		const detail = this.pluginDetails.get(pluginName);
		if (!detail)
			return html`<div class="loading">Loading versions...</div>`;

		const versions = detail.versions;
		if (!versions || versions.length === 0)
			return html`<p>No versions.</p>`;

		return html`
		<table class="versions-table">
			<thead>
				<tr>
					<th>Version</th>
					<th>File Size</th>
					<th>Downloads</th>
					<th>Uploaded</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				${ versions.map(version => html`
				<tr>
					<td>${ version.version }</td>
					<td>${ formatFileSize(version.fileSize) }</td>
					<td>${ version.downloadCount }</td>
					<td>${ formatDate(version.uploadedAt) }</td>
					<td>
						<button
							class="btn-small btn-danger"
							data-plugin-name=${ pluginName }
							data-version=${ version.version }
							@click=${ this.handleDeleteVersionClick }
						>
							Delete
						</button>
					</td>
				</tr>
				`) }
			</tbody>
		</table>
		`;
	}

	protected renderPluginList(): unknown {
		if (this.loading)
			return html`<div class="loading">Loading...</div>`;

		if (this.plugins.length === 0) {
			return html`
		<div class="empty-state">
			<p>You have no plugins to manage. Upload a plugin to get started.</p>
		</div>
			`;
		}

		return this.plugins.map(plugin => html`
		<div class="admin-plugin-card">
			<div
				class="admin-plugin-header"
				data-plugin-name=${ plugin.name }
				@click=${ this.handleToggleExpandClick }
			>
				<div class="admin-plugin-info">
					<strong>${ plugin.name }</strong>
					<span class="plugin-meta">
						v${ plugin.latestVersion ?? 'N/A' }
						· ${ plugin.versionCount ?? 0 } versions
						· ${ plugin.totalDownloads ?? 0 } downloads
					</span>
				</div>
				<span class="expand-icon">
					${ when(this.expandedPlugin === plugin.name, () => '▼', () => '▶') }
				</span>
			</div>
			${ when(this.expandedPlugin === plugin.name, () => html`
			<div class="admin-plugin-body">
				${ this.renderVersionsForPlugin(plugin.name) }
			</div>
			`) }
		</div>
		`);
	}

	protected renderStats(): unknown {
		const totalPlugins = this.plugins.length;
		const totalVersions = this.plugins.reduce((sum, p) => sum + (p.versionCount ?? 0), 0);
		const totalDownloads = this.plugins.reduce((sum, p) => sum + (p.totalDownloads ?? 0), 0);

		return html`
		<div class="stats-grid">
			<div class="stat-card">
				<h3>Your Plugins</h3>
				<p class="stat-value">${ totalPlugins }</p>
			</div>
			<div class="stat-card">
				<h3>Total Versions</h3>
				<p class="stat-value">${ totalVersions }</p>
			</div>
			<div class="stat-card">
				<h3>Total Downloads</h3>
				<p class="stat-value">${ totalDownloads }</p>
			</div>
		</div>
		`;
	}

	override render(): unknown {
		return html`
		<div class="header-bar">
			<h1>Plugin Administration</h1>
			<div class="header-actions">
				<router-link to="/" class="btn btn-secondary">Dashboard</router-link>
				<button class="btn btn-secondary" @click=${ this.handleLogout }>
					Logout (${ this.currentUser })
				</button>
			</div>
		</div>

		${ this.renderStats() }
		${ this.renderUploadSection() }

		<section class="section">
			<h2>Your Plugins</h2>
			${ this.renderPluginList() }
		</section>
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			--color-text: #333;
			--color-text-muted: #666;
			--color-text-light: #888;
			--color-primary: #667eea;
			--color-primary-hover: #5568d3;
			--color-secondary: #6c757d;
			--color-secondary-hover: #5a6268;
			--color-danger: #dc3545;
			--color-danger-hover: #c82333;
			--color-border: #ddd;
			--color-border-light: #eee;
			--color-bg-surface: white;
			--color-bg-muted: #f8f9fa;
			--color-shadow: rgba(0, 0, 0, 0.1);
			--color-alert-success-bg: #d4edda;
			--color-alert-success-text: #155724;
			--color-alert-success-border: #c3e6cb;
			--color-alert-error-bg: #f8d7da;
			--color-alert-error-text: #721c24;
			--color-alert-error-border: #f5c6cb;
			--spacing-xs: 4px;
			--spacing-sm: 6px;
			--spacing-md: 8px;
			--spacing-lg: 10px;
			--spacing-xl: 12px;
			--spacing-2xl: 16px;
			--spacing-3xl: 20px;
			--spacing-4xl: 24px;
			--spacing-5xl: 30px;
			--spacing-6xl: 40px;
			--font-size-sm: 12px;
			--font-size-base: 13px;
			--font-size-md: 14px;
			--font-size-lg: 32px;
			--radius-sm: 4px;
			--radius-md: 8px;
			--transition-speed: 0.3s;
			display: block;
			padding: var(--spacing-3xl);
			max-width: 1400px;
			margin: 0 auto;
		}
		h1 {
			margin: 0;
			color: var(--color-text);
		}
		h2 {
			color: var(--color-text);
			margin: 0 0 var(--spacing-2xl);
		}
		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--spacing-3xl);
		}
		.header-actions {
			display: flex;
			gap: var(--spacing-md);
			align-items: center;
		}
		.section {
			margin-top: var(--spacing-4xl);
		}
		/* Stats */
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: var(--spacing-3xl);
			margin-bottom: var(--spacing-4xl);
		}
		.stat-card {
			background: var(--color-bg-surface);
			padding: var(--spacing-3xl);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			& h3 {
				margin: 0 0 var(--spacing-lg) 0;
				font-size: var(--font-size-md);
				color: var(--color-text-muted);
				font-weight: 500;
			}
		}
		.stat-value {
			font-size: var(--font-size-lg);
			font-weight: 700;
			color: var(--color-primary);
			margin: 0;
		}
		/* Plugin cards */
		.admin-plugin-card {
			background: var(--color-bg-surface);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			margin-bottom: var(--spacing-xl);
			overflow: hidden;
		}
		.admin-plugin-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: var(--spacing-2xl) var(--spacing-3xl);
			cursor: pointer;
			transition: background 0.2s;
			&:hover {
				background: var(--color-bg-muted);
			}
		}
		.admin-plugin-info {
			display: flex;
			flex-direction: column;
			gap: var(--spacing-xs);
		}
		.plugin-meta {
			font-size: var(--font-size-base);
			color: var(--color-text-light);
		}
		.expand-icon {
			color: var(--color-primary);
			font-size: var(--font-size-sm);
		}
		.admin-plugin-body {
			padding: 0 var(--spacing-3xl) var(--spacing-3xl);
			border-top: 1px solid var(--color-border-light);
		}
		/* Upload */
		.upload-form {
			max-width: 600px;
			background: var(--color-bg-surface);
			padding: var(--spacing-5xl);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
		}
		.form-group {
			margin-bottom: var(--spacing-3xl);
			& label {
				display: block;
				margin-bottom: var(--spacing-md);
				font-weight: 500;
				color: var(--color-text);
			}
			& input[type='file'] {
				width: 100%;
				padding: var(--spacing-lg);
				border: 2px dashed var(--color-border);
				border-radius: var(--radius-sm);
				cursor: pointer;
				transition: all var(--transition-speed);
				&:hover:not(:disabled) {
					border-color: var(--color-primary);
				}
				&:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}
			}
		}
		.upload-progress {
			text-align: center;
			padding: var(--spacing-3xl);
			color: var(--color-primary);
			font-weight: 500;
		}
		.form-actions {
			margin-top: var(--spacing-3xl);
		}
		/* Versions table */
		.versions-table {
			width: 100%;
			border-collapse: collapse;
			margin-top: var(--spacing-2xl);
			& thead {
				background: var(--color-bg-muted);
			}
			& th {
				padding: var(--spacing-lg) var(--spacing-xl);
				text-align: left;
				font-weight: 600;
				color: var(--color-text);
				border-bottom: 2px solid var(--color-border-light);
			}
			& td {
				padding: var(--spacing-lg) var(--spacing-xl);
				border-bottom: 1px solid var(--color-border-light);
			}
			& tbody tr:hover {
				background: var(--color-bg-muted);
			}
		}
		/* Alerts */
		.alert {
			padding: var(--spacing-2xl);
			border-radius: var(--radius-sm);
			margin-bottom: var(--spacing-3xl);
		}
		.alert-success {
			background: var(--color-alert-success-bg);
			color: var(--color-alert-success-text);
			border: 1px solid var(--color-alert-success-border);
		}
		.alert-error {
			background: var(--color-alert-error-bg);
			color: var(--color-alert-error-text);
			border: 1px solid var(--color-alert-error-border);
		}
		/* Buttons */
		.btn {
			padding: var(--spacing-md) var(--spacing-2xl);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			font-size: var(--font-size-md);
			transition: all var(--transition-speed);
			text-decoration: none;
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;
			padding: var(--spacing-xl) var(--spacing-4xl);
			&:hover:not(:disabled) {
				background: var(--color-primary-hover);
			}
			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
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
			padding: var(--spacing-sm) var(--spacing-xl);
			font-size: var(--font-size-sm);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			transition: all var(--transition-speed);
		}
		.btn-danger {
			background: var(--color-danger);
			color: white;
			&:hover {
				background: var(--color-danger-hover);
			}
		}
		/* States */
		.loading {
			text-align: center;
			padding: var(--spacing-6xl);
			color: var(--color-text-muted);
		}
		.empty-state {
			text-align: center;
			padding: var(--spacing-6xl);
			color: var(--color-text-muted);
			background: var(--color-bg-surface);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'plugin-admin': PluginAdmin;
	}
}
