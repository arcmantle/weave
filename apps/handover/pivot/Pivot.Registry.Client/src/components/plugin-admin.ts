import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { router } from '../features/router/index.ts';
import type { Plugin } from '../models/plugin.ts';
import { authService } from '../services/auth-service.ts';
import { pluginApi } from '../services/plugin-api-service.ts';
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
								@click=${ () => this.deleteVersion(pluginName, version.version) }
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
				@click=${ () => this.toggleExpand(plugin.name) }
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
			display: block;
			padding: 20px;
			max-width: 1400px;
			margin: 0 auto;
		}

		h1 {
			margin: 0;
			color: #333;
		}

		h2 {
			color: #333;
			margin: 0 0 16px;
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

		.section {
			margin-top: 24px;
		}

		/* Stats */
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 20px;
			margin-bottom: 24px;
		}

		.stat-card {
			background: white;
			padding: 20px;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		}

		.stat-card h3 {
			margin: 0 0 10px 0;
			font-size: 14px;
			color: #666;
			font-weight: 500;
		}

		.stat-value {
			font-size: 32px;
			font-weight: 700;
			color: #667eea;
			margin: 0;
		}

		/* Plugin cards */
		.admin-plugin-card {
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			margin-bottom: 12px;
			overflow: hidden;
		}

		.admin-plugin-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 16px 20px;
			cursor: pointer;
			transition: background 0.2s;
		}

		.admin-plugin-header:hover {
			background: #f8f9fa;
		}

		.admin-plugin-info {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.plugin-meta {
			font-size: 13px;
			color: #888;
		}

		.expand-icon {
			color: #667eea;
			font-size: 12px;
		}

		.admin-plugin-body {
			padding: 0 20px 20px;
			border-top: 1px solid #eee;
		}

		/* Upload */
		.upload-form {
			max-width: 600px;
			background: white;
			padding: 30px;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		}

		.form-group {
			margin-bottom: 20px;
		}

		.form-group label {
			display: block;
			margin-bottom: 8px;
			font-weight: 500;
			color: #333;
		}

		.form-group input[type='file'] {
			width: 100%;
			padding: 10px;
			border: 2px dashed #ddd;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.3s;
		}

		.form-group input[type='file']:hover:not(:disabled) {
			border-color: #667eea;
		}

		.form-group input[type='file']:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}

		.upload-progress {
			text-align: center;
			padding: 20px;
			color: #667eea;
			font-weight: 500;
		}

		.form-actions {
			margin-top: 20px;
		}

		/* Versions table */
		.versions-table {
			width: 100%;
			border-collapse: collapse;
			margin-top: 16px;
		}

		.versions-table thead {
			background: #f8f9fa;
		}

		.versions-table th {
			padding: 10px 12px;
			text-align: left;
			font-weight: 600;
			color: #333;
			border-bottom: 2px solid #eee;
		}

		.versions-table td {
			padding: 10px 12px;
			border-bottom: 1px solid #eee;
		}

		.versions-table tbody tr:hover {
			background: #f8f9fa;
		}

		/* Alerts */
		.alert {
			padding: 16px;
			border-radius: 4px;
			margin-bottom: 20px;
		}

		.alert-success {
			background: #d4edda;
			color: #155724;
			border: 1px solid #c3e6cb;
		}

		.alert-error {
			background: #f8d7da;
			color: #721c24;
			border: 1px solid #f5c6cb;
		}

		/* Buttons */
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
			padding: 12px 24px;
		}

		.btn-primary:hover:not(:disabled) {
			background: #5568d3;
		}

		.btn-primary:disabled {
			opacity: 0.6;
			cursor: not-allowed;
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

		.btn-danger {
			background: #dc3545;
			color: white;
		}

		.btn-danger:hover {
			background: #c82333;
		}

		/* States */
		.loading {
			text-align: center;
			padding: 40px;
			color: #666;
		}

		.empty-state {
			text-align: center;
			padding: 40px;
			color: #666;
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		}
	`;

}

declare global {
	interface HTMLElementTagNameMap {
		'plugin-admin': PluginAdmin;
	}
}
