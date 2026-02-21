import { authService } from '@arcmantle/pivot-client-auth';
import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import type { Plugin } from '../models/plugin.ts';
import { type AccessMode, configService } from '../services/config-service.ts';
import { pluginApi } from '../services/plugin-api-service.ts';
import { dataAttrs } from '../utils/dom.ts';

const tabTypes = [ 'upload', 'storage' ] as const;
type TabType = typeof tabTypes[number];

function isTabType(value: string): value is TabType {
	return (tabTypes as readonly string[]).includes(value);
}


@customElement('registry-manager')
export class RegistryManager extends LitElement {

	@state() protected activeTab:      TabType = 'upload';
	@state() protected plugins:        Plugin[] = [];
	@state() protected loading:        boolean = false;
	@state() protected currentUser:    string | null = null;
	@state() protected uploadStatus:   string | null = null;
	@state() protected uploadError:    string | null = null;
	@state() protected uploadProgress: boolean = false;
	@state() protected accessMode:     AccessMode = 'private';

	override connectedCallback(): void {
		super.connectedCallback();
		this.initialize();
	}

	protected async initialize(): Promise<void> {
		const config = await configService.getConfig();
		this.accessMode = config.accessMode;
		this.currentUser = await authService.getCurrentUser();
		await this.loadPlugins();
	}

	protected async loadPlugins(): Promise<void> {
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

	protected get isAuthenticated(): boolean {
		return !!this.currentUser;
	}

	protected handleTabClick(ev: Event): void {
		const { tab } = dataAttrs(ev, 'tab');
		if (tab && isTabType(tab))
			this.activeTab = tab;
	}

	protected renderUploadTab(): unknown {
		return html`
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
		`;
	}

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

	protected renderStorageTab(): unknown {
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
		</div>

		<nav class="nav-cards">
			<router-link to="/browse" class="nav-card">
				<h3>Browse Plugins</h3>
				<p>Search and discover available plugins in the registry.</p>
			</router-link>
			<router-link to="/explore" class="nav-card">
				<h3>Plugin Explorer</h3>
				<p>Browse plugins with a side-by-side list and detail view.</p>
			</router-link>
			${ when(this.isAuthenticated, () => html`
			<router-link to="/admin" class="nav-card">
				<h3>Plugin Admin</h3>
				<p>Manage your plugins, upload new versions, and view statistics.</p>
			</router-link>
			`) }
		</nav>

		${ when(this.isAuthenticated, () => html`
		<div class="tabs">
			<button
				class=${ this.activeTab === 'upload' ? 'active' : '' }
				data-tab="upload"
				@click=${ this.handleTabClick }
			>
				Upload Plugin
			</button>
			<button
				class=${ this.activeTab === 'storage' ? 'active' : '' }
				data-tab="storage"
				@click=${ this.handleTabClick }
			>
				Storage Info
			</button>
		</div>

		<div class="tab-content">
			${ when(this.activeTab === 'upload',
				() => this.renderUploadTab(),
				() => this.renderStorageTab()) }
		</div>
		`) }
		`;
	}

	static override styles: CSSResultGroup = css`
		:host {
			--color-text: #333;
			--color-text-muted: #666;
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
			--color-shadow-hover: rgba(0, 0, 0, 0.15);
			--color-alert-success-bg: #d4edda;
			--color-alert-success-text: #155724;
			--color-alert-success-border: #c3e6cb;
			--color-alert-error-bg: #f8d7da;
			--color-alert-error-text: #721c24;
			--color-alert-error-border: #f5c6cb;
			--color-alert-info-bg: #d1ecf1;
			--color-alert-info-text: #0c5460;
			--color-alert-info-border: #bee5eb;
			--spacing-sm: 8px;
			--spacing-md: 10px;
			--spacing-lg: 12px;
			--spacing-xl: 16px;
			--spacing-2xl: 20px;
			--spacing-3xl: 24px;
			--spacing-4xl: 30px;
			--spacing-5xl: 32px;
			--spacing-6xl: 40px;
			--font-size-sm: 12px;
			--font-size-base: 14px;
			--font-size-lg: 32px;
			--radius-sm: 4px;
			--radius-md: 8px;
			--transition-speed: 0.3s;
			display: block;
			padding: var(--spacing-2xl);
			max-width: 1400px;
		}
		h1 {
			margin: 0 0 var(--spacing-2xl) 0;
			color: var(--color-text);
		}
		.tabs {
			display: flex;
			gap: var(--spacing-md);
			margin-bottom: var(--spacing-2xl);
			border-bottom: 2px solid var(--color-border-light);
			& button {
				padding: var(--spacing-lg) var(--spacing-3xl);
				border: none;
				background: none;
				cursor: pointer;
				font-size: var(--font-size-base);
				font-weight: 500;
				color: var(--color-text-muted);
				border-bottom: 3px solid transparent;
				transition: all var(--transition-speed);
				&:hover {
					color: var(--color-text);
				}
				&.active {
					color: var(--color-primary);
					border-bottom-color: var(--color-primary);
				}
			}
		}
		.nav-cards {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: var(--spacing-xl);
			margin-bottom: var(--spacing-5xl);
		}
		.nav-card {
			display: block;
			background: var(--color-bg-surface);
			padding: var(--spacing-3xl);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			text-decoration: none;
			color: inherit;
			transition: box-shadow var(--transition-speed), transform 0.2s;
			cursor: pointer;
			&:hover {
				box-shadow: 0 4px 16px var(--color-shadow-hover);
				transform: translateY(-2px);
			}
			& h3 {
				margin: 0 0 var(--spacing-sm);
				color: var(--color-primary);
			}
			& p {
				margin: 0;
				color: var(--color-text-muted);
				font-size: var(--font-size-base);
			}
		}
		.tab-content {
			padding: var(--spacing-2xl) 0;
		}
		.loading {
			text-align: center;
			padding: var(--spacing-6xl);
			color: var(--color-text-muted);
		}
		.plugins-table {
			width: 100%;
			border-collapse: collapse;
			background: var(--color-bg-surface);
			box-shadow: 0 2px 8px var(--color-shadow);
			border-radius: var(--radius-md);
			overflow: hidden;
			& thead {
				background: var(--color-bg-muted);
			}
			& th {
				padding: var(--spacing-lg);
				text-align: left;
				font-weight: 600;
				color: var(--color-text);
				border-bottom: 2px solid var(--color-border-light);
			}
			& td {
				padding: var(--spacing-lg);
				border-bottom: 1px solid var(--color-border-light);
			}
			& tbody tr:hover {
				background: var(--color-bg-muted);
			}
		}
		.btn-small {
			padding: 6px var(--spacing-lg);
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
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: var(--spacing-2xl);
			margin-top: var(--spacing-2xl);
		}
		.stat-card {
			background: var(--color-bg-surface);
			padding: var(--spacing-2xl);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
			& h3 {
				margin: 0 0 var(--spacing-md) 0;
				font-size: var(--font-size-base);
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
		.alert {
			padding: var(--spacing-xl);
			border-radius: var(--radius-sm);
			margin-bottom: var(--spacing-2xl);
		}
		.alert-info {
			background: var(--color-alert-info-bg);
			color: var(--color-alert-info-text);
			border: 1px solid var(--color-alert-info-border);
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
		.upload-form {
			max-width: 600px;
			background: var(--color-bg-surface);
			padding: var(--spacing-4xl);
			border-radius: var(--radius-md);
			box-shadow: 0 2px 8px var(--color-shadow);
		}
		.form-group {
			margin-bottom: var(--spacing-2xl);
			& label {
				display: block;
				margin-bottom: var(--spacing-sm);
				font-weight: 500;
				color: var(--color-text);
			}
			& input[type='file'] {
				width: 100%;
				padding: var(--spacing-md);
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
			padding: var(--spacing-2xl);
			color: var(--color-primary);
			font-weight: 500;
		}
		.form-actions {
			margin-top: var(--spacing-2xl);
		}
		.btn-primary {
			background: var(--color-primary);
			color: white;
			padding: var(--spacing-lg) var(--spacing-3xl);
			&:hover:not(:disabled) {
				background: var(--color-primary-hover);
			}
			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
		.header-bar {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--spacing-2xl);
		}
		.btn {
			padding: var(--spacing-sm) var(--spacing-xl);
			border: none;
			border-radius: var(--radius-sm);
			cursor: pointer;
			font-size: var(--font-size-base);
			transition: all var(--transition-speed);
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
		'registry-manager': RegistryManager;
	}
}
