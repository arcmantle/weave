import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { router } from '../features/router/index.ts';
import type { Plugin } from '../models/plugin.ts';
import { authService } from '../services/auth-service.ts';
import { pluginApi } from '../services/plugin-api-service.ts';

type TabType = 'browse' | 'upload' | 'storage';


@customElement('registry-manager')
export class RegistryManager extends LitElement {

	@state() private activeTab:      TabType = 'browse';
	@state() private plugins:        Plugin[] = [];
	@state() private loading:        boolean = false;
	@state() private currentUser:    string | null = null;
	@state() private uploadStatus:   string | null = null;
	@state() private uploadError:    string | null = null;
	@state() private uploadProgress: boolean = false;

	override connectedCallback(): void {
		super.connectedCallback();
		this.initialize();
	}

	private async initialize(): Promise<void> {
		this.currentUser = await authService.getCurrentUser();
		await this.loadPlugins();
	}

	private async loadPlugins() {
		this.loading = true;
		try {
			const response = await pluginApi.getPlugins();
			this.plugins = response.plugins;
		}
		catch (err) {
			console.error('Failed to load plugins:', err);
		}
		finally {
			this.loading = false;
		}
	}

	private async deleteVersion(pluginName: string, version: string) {
		if (!confirm(`Delete ${ pluginName } version ${ version }?`))
			return;


		try {
			await pluginApi.deleteVersion(pluginName, version);
			await this.loadPlugins();
		}
		catch (err) {
			console.error('Failed to delete version:', err);
			alert('Failed to delete plugin version');
		}
	}

	private formatFileSize(bytes: number): string {
		const sizes = [ 'B', 'KB', 'MB', 'GB' ];
		let len = bytes;
		let order = 0;
		while (len >= 1024 && order < sizes.length - 1) {
			order++;
			len = len / 1024;
		}

		return `${ len.toFixed(2) } ${ sizes[order] }`;
	}

	private formatDate(date: Date): string {
		return new Date(date).toLocaleString();
	}

	private async handleLogout() {
		await authService.logout();
		await router.navigate('/login');
	}

	private renderBrowseTab() {
		if (this.loading)
			return html`<div class="loading">Loading...</div>`;


		if (this.plugins.length === 0)
			return html`<p>No plugins in registry.</p>`;


		return html`
			<h2>Available Plugins</h2>
			<table class="plugins-table">
				<thead>
					<tr>
						<th>Name</th>
						<th>Latest Version</th>
						<th>Author</th>
						<th>Description</th>
						<th>Total Downloads</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					${ this.plugins.map(
						plugin => html`
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
						`,
					) }
				</tbody>
			</table>
		`;
	}

	private async viewPluginDetails(name: string) {
		// TODO: Implement plugin detail view
		console.log('View details for:', name);
	}

	private renderUploadTab() {
		return html`
			<h2>Upload Plugin Package</h2>

			${ this.uploadStatus
				? html`<div class="alert alert-success">${ this.uploadStatus }</div>`
				: '' }
			${ this.uploadError
				? html`<div class="alert alert-error">${ this.uploadError }</div>`
				: '' }

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

				${ this.uploadProgress
					? html`<div class="upload-progress">Uploading...</div>`
					: '' }

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
		`;
	}

	private selectedFile: File | null = null;

	private handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		this.selectedFile = input.files?.[0] || null;
		this.uploadStatus = null;
		this.uploadError = null;
	}

	private async handleUpload() {
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

			// Reset file input
			const input = this.shadowRoot?.querySelector('#plugin-file') as HTMLInputElement;
			if (input)
				input.value = '';


			// Reload plugins to show the new upload
			await this.loadPlugins();
		}
		catch (error) {
			this.uploadError = error instanceof Error ? error.message : 'Upload failed';
		}
		finally {
			this.uploadProgress = false;
		}
	}

	private renderStorageTab() {
		const totalPlugins = this.plugins.length;
		const totalVersions = this.plugins.reduce((sum, p) => sum + (p.versionCount ?? 0), 0);
		const totalDownloads = this.plugins.reduce((sum, p) => sum + (p.totalDownloads ?? 0), 0);

		return html`
			<h2>Storage Information</h2>
			<div class="stats-grid">
				<div class="stat-card">
					<h3>Total Plugins</h3>
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
				<h1>Registry Manager</h1>
				<button class="btn btn-secondary" @click=${ this.handleLogout }>
					Logout (${ this.currentUser })
				</button>
			</div>

			<div class="tabs">
				<button
					class=${ this.activeTab === 'browse' ? 'active' : '' }
					@click=${ () => (this.activeTab = 'browse') }
				>
					Browse Plugins
				</button>
				<button
					class=${ this.activeTab === 'upload' ? 'active' : '' }
					@click=${ () => (this.activeTab = 'upload') }
				>
					Upload Plugin
				</button>
				<button
					class=${ this.activeTab === 'storage' ? 'active' : '' }
					@click=${ () => (this.activeTab = 'storage') }
				>
					Storage Info
				</button>
			</div>

			<div class="tab-content">
				${ this.activeTab === 'browse'
					? this.renderBrowseTab()
					: this.activeTab === 'upload'
						? this.renderUploadTab()
						: this.renderStorageTab() }
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
			margin: 0 0 20px 0;
			color: #333;
		}

		.tabs {
			display: flex;
			gap: 10px;
			margin-bottom: 20px;
			border-bottom: 2px solid #eee;
		}

		.tabs button {
			padding: 12px 24px;
			border: none;
			background: none;
			cursor: pointer;
			font-size: 14px;
			font-weight: 500;
			color: #666;
			border-bottom: 3px solid transparent;
			transition: all 0.3s;
		}

		.tabs button:hover {
			color: #333;
		}

		.tabs button.active {
			color: #667eea;
			border-bottom-color: #667eea;
		}

		.tab-content {
			padding: 20px 0;
		}

		.loading {
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

		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 20px;
			margin-top: 20px;
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

		.alert {
			padding: 16px;
			border-radius: 4px;
			margin-bottom: 20px;
		}

		.alert-info {
			background: #d1ecf1;
			color: #0c5460;
			border: 1px solid #bee5eb;
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

		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20px;
		}

		.btn {
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 14px;
			transition: all 0.3s;
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
		'registry-manager': RegistryManager;
	}
}
