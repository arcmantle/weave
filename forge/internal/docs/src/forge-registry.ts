import { html, nothing, render, type TemplateResult } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { when } from 'lit-html/directives/when.js';

type RegistryState = {
	query: string;
	source: string;
	offset: number;
	limit: number;
	total: number;
	hasMore: boolean;
	loading: boolean;
	items: DocTemplateSummary[];
	selectedId: string;
	sources: DocRegistrySource[];
	installTargets: DocInstallTarget[];
};

class ForgeRegistry extends HTMLElement {
	protected state: RegistryState = {
		query: '',
		source: '',
		offset: 0,
		limit: 50,
		total: 0,
		hasMore: false,
		loading: false,
		items: [],
		selectedId: '',
		sources: [],
		installTargets: []
	};

	protected searchTimer: ReturnType<typeof setTimeout> | null = null;

	public initialize(registrySources: DocRegistrySource[] = [], installTargets: DocInstallTarget[] = []): void {
		this.state.sources = Array.isArray(registrySources) ? registrySources : [];
		this.state.installTargets = Array.isArray(installTargets) ? installTargets : [];
		this.renderShell();
		void this.search(true);
	}

	protected renderShell(): void {
		render(this.shellTemplate(), this);
		this.bindToolbar();
		this.renderResults();
	}

	protected shellTemplate(): TemplateResult {
		return html`
			<div class="registry-shell">
				<div class="registry-list-panel">
					<div class="registry-toolbar">
						<input id="registry-search" class="registry-search" type="text" placeholder="Search templates by name, description, language..." .value=${this.state.query} />
						<select id="registry-source" class="registry-source">
							<option value="">All sources</option>
							${repeat(this.state.sources, source => source.name, source => html`
								<option value=${source.name} ?selected=${this.state.source === source.name}>${source.name} (${source.count})</option>
							`)}
						</select>
					</div>
					<div id="registry-results" class="registry-results"></div>
					<div class="registry-list-footer">
						<span id="registry-count">${this.state.total} templates</span>
						<button id="registry-load-more" class="registry-load-more" type="button" style=${this.state.hasMore ? '' : 'display:none'}>Load more</button>
					</div>
				</div>
				<div class="registry-detail-panel">
					<div class="registry-detail-scroll" id="registry-detail">
						<div class="registry-empty">Select a template to view details and install options.</div>
					</div>
				</div>
			</div>
		`;
	}

	protected bindToolbar(): void {
		const input = this.querySelector('#registry-search') as HTMLInputElement | null;
		const source = this.querySelector('#registry-source') as HTMLSelectElement | null;
		const loadMore = this.querySelector('#registry-load-more') as HTMLButtonElement | null;

		if (input) {
			input.addEventListener('input', () => {
				this.state.query = input.value || '';
				if (this.searchTimer) {
					clearTimeout(this.searchTimer);
				}
				this.searchTimer = setTimeout(() => {
					void this.search(true);
				}, 180);
			});
		}

		if (source) {
			source.addEventListener('change', () => {
				this.state.source = source.value || '';
				void this.search(true);
			});
		}

		if (loadMore) {
			loadMore.addEventListener('click', () => {
				void this.search(false);
			});
		}
	}

	protected async search(reset: boolean): Promise<void> {
		if (this.state.loading) {
			return;
		}
		this.state.loading = true;

		if (reset) {
			this.state.offset = 0;
			this.state.items = [];
		}

		const query = encodeURIComponent(this.state.query || '');
		const source = encodeURIComponent(this.state.source || '');
		const offset = this.state.offset;
		const limit = this.state.limit;
		const url = '/api/registry/search?q=' + query + '&source=' + source + '&offset=' + offset + '&limit=' + limit;

		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error('Search failed');
			}
			const data = await response.json() as RegistrySearchResponse;

			this.state.total = data.total || 0;
			this.state.hasMore = !!data.hasMore;
			const items = Array.isArray(data.items) ? data.items : [];
			this.state.items = reset ? items : this.state.items.concat(items);
			this.state.offset = this.state.items.length;

			this.renderResults();
		} catch {
			this.renderResultsError();
		} finally {
			this.state.loading = false;
		}
	}

	protected renderResults(): void {
		const results = this.querySelector('#registry-results') as HTMLElement | null;
		const count = this.querySelector('#registry-count');
		const loadMore = this.querySelector('#registry-load-more') as HTMLButtonElement | null;
		if (!results || !count || !loadMore) {
			return;
		}

		render(this.resultsTemplate(), results);
		count.textContent = this.state.total + ' templates';
		loadMore.style.display = this.state.hasMore ? '' : 'none';

		results.querySelectorAll('.registry-item').forEach(element => {
			element.addEventListener('click', () => {
				const id = (element as HTMLElement).dataset.id || '';
				void this.selectTemplate(id);
			});
		});
	}

	protected resultsTemplate(): TemplateResult {
		return when(
			this.state.items.length === 0,
			() => html`<div class="registry-empty">No templates match your search.</div>`,
			() => html`
				${repeat(this.state.items, item => item.id, item => html`
					<div class=${'registry-item' + (this.state.selectedId === item.id ? ' active' : '')} data-id=${item.id}>
						<div class="registry-item-title">
							<span>${item.name}</span>
							${when(!!item.latestTag, () => html`<span class="meta-chip">${item.latestTag}</span>`, () => nothing)}
						</div>
						<div class="registry-item-desc">${item.description || ''}</div>
						<div class="registry-item-meta">
							<span>${item.source}</span>
							<span>${sourceTypeLabel(item.sourceType)}</span>
							<span>${(item.languages || []).join(', ')}</span>
						</div>
					</div>
				`)}
			`
		);
	}

	protected renderResultsError(): void {
		const results = this.querySelector('#registry-results') as HTMLElement | null;
		if (results) {
			render(html`<div class="registry-empty">Failed to load templates.</div>`, results);
		}
	}

	protected async selectTemplate(id: string): Promise<void> {
		if (!id) {
			return;
		}

		this.state.selectedId = id;
		this.renderResults();

		const detail = this.querySelector('#registry-detail') as HTMLElement | null;
		if (!detail) {
			return;
		}
		render(html`<div class="registry-empty">Loading template...</div>`, detail);

		try {
			const response = await fetch('/api/registry/template?id=' + encodeURIComponent(id));
			if (!response.ok) {
				throw new Error('Template not found');
			}
			const template = await response.json() as DocTemplate;
			this.renderTemplateDetail(template);
		} catch {
			render(html`<div class="registry-empty">Failed to load template details.</div>`, detail);
		}
	}

	protected renderTemplateDetail(template: DocTemplate): void {
		const detail = this.querySelector('#registry-detail') as HTMLElement | null;
		if (!detail) {
			return;
		}

		const selectedRef = template.latestTag ? `${template.name}@${template.latestTag}` : template.name;

		render(this.templateDetailTemplate(template, selectedRef), detail);
		this.bindInstall(selectedRef);
	}

	protected templateDetailTemplate(template: DocTemplate, selectedRef: string): TemplateResult {
		const languages = template.languages || [];
		const variables = template.variables || [];

		return html`
			<div class="command-detail">
				<div class="command-header">
					<div class="command-name">${template.name} <span class="badge badge-template">template</span></div>
					${when(!!template.description, () => html`<div class="command-description">${template.description}</div>`, () => nothing)}
					<div class="command-meta">
						<div class="meta-chip meta-chip-template">${template.source}</div>
						${when(!!template.sourceType, () => html`<div class="meta-chip">${sourceTypeLabel(template.sourceType)}</div>`, () => nothing)}
						${when(!!template.latestTag, () => html`<div class="meta-chip">latest: ${template.latestTag}</div>`, () => nothing)}
						${repeat(languages, language => language, language => html`<div class="meta-chip">${langLabel(language)}</div>`)}
					</div>
				</div>

				<div class="section">
					<div class="section-title">Install</div>
					<div class="template-install">
						<label class="template-install-field"><span>Command Name</span><input id="registry-install-name" class="template-install-input" type="text" .value=${template.name} /></label>
						<label class="template-install-field">
							<span>Language</span>
							<select id="registry-install-lang" class="template-install-select">
								<option value="">Auto</option>
								${repeat(languages, language => language, language => html`<option value=${language}>${langLabel(language)}</option>`)}
							</select>
						</label>
						${when(this.state.installTargets.length > 1, () => html`
							<label class="template-install-field">
								<span>Install Target</span>
								<select id="registry-install-target" class="template-install-select">
									${repeat(this.state.installTargets, target => target.path, target => html`<option value=${target.path}>${target.label}</option>`)}
								</select>
							</label>
						`, () => nothing)}
						<div class="template-install-actions">
							<button id="registry-install-btn" class="template-install-btn">Install Template</button>
							<span id="registry-install-status" class="template-install-status"></span>
						</div>
					</div>
				</div>

				<div class="section">
					<div class="section-title">Usage</div>
					<div class="usage-box"><span class="usage-prefix">$</span> forge add <span class="usage-required">&lt;name&gt;</span> --from <span class="usage-template-name">${selectedRef}</span></div>
				</div>

				${when(variables.length > 0, () => html`
					<div class="section">
						<div class="section-title">Variables</div>
						<table class="arg-table">
							<thead><tr><th>Name</th><th>Description</th><th>Default</th></tr></thead>
							<tbody>
								${repeat(variables, variable => variable.name, variable => html`
									<tr>
										<td><span class="arg-name">${variable.name}</span></td>
										<td>${variable.description || ''}</td>
										<td><span class="arg-default">${variable.default || ''}</span></td>
									</tr>
								`)}
							</tbody>
						</table>
					</div>
				`, () => nothing)}

				${when(!!template.example, () => html`
					<div class="section">
						<div class="section-title">Example</div>
						<div class="example-content">${unsafeHTML(renderMarkdown(template.example || ''))}</div>
					</div>
				`, () => nothing)}
			</div>
		`;
	}

	protected bindInstall(selectedRef: string): void {
		const button = this.querySelector('#registry-install-btn') as HTMLButtonElement | null;
		const status = this.querySelector('#registry-install-status') as HTMLElement | null;
		const nameInput = this.querySelector('#registry-install-name') as HTMLInputElement | null;
		const langSelect = this.querySelector('#registry-install-lang') as HTMLSelectElement | null;
		const targetSelect = this.querySelector('#registry-install-target') as HTMLSelectElement | null;
		if (!button || !status || !nameInput || !langSelect) {
			return;
		}

		button.addEventListener('click', async () => {
			const commandName = (nameInput.value || '').trim();
			if (!commandName) {
				status.textContent = 'Command name is required';
				status.className = 'template-install-status error';
				return;
			}

			const payload: {
				template: string;
				commandName: string;
				language: string;
				targetPath: string;
			} = {
				template: selectedRef,
				commandName,
				language: (langSelect.value || '').trim(),
				targetPath: ''
			};

			if (targetSelect) {
				payload.targetPath = (targetSelect.value || '').trim();
			} else if (this.state.installTargets.length === 1) {
				payload.targetPath = this.state.installTargets[0].path;
			}

			button.disabled = true;
			status.textContent = 'Installing...';
			status.className = 'template-install-status';

			try {
				const response = await fetch('/api/templates/install', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const raw = await response.text();
				let body: { ok?: boolean; message?: string } = {};
				try {
					body = raw ? JSON.parse(raw) as { ok?: boolean; message?: string } : {};
				} catch {
					body = { message: raw };
				}

				if (!response.ok || body.ok === false) {
					status.textContent = body.message || ('Install failed (HTTP ' + response.status + ')');
					status.className = 'template-install-status error';
					return;
				}
				status.textContent = 'Installed successfully';
				status.className = 'template-install-status success';
			} catch {
				status.textContent = 'Install failed';
				status.className = 'template-install-status error';
			} finally {
				button.disabled = false;
			}
		});
	}
}

function langLabel(lang: string): string {
	switch (lang) {
	case 'go': return 'Go';
	case 'ts': return 'TypeScript';
	case 'cs': return 'C#';
	default: return lang;
	}
}

function sourceTypeLabel(sourceType?: string): string {
	switch (sourceType) {
	case 'built-in': return 'built-in';
	case 'github-git': return 'github git';
	case 'local-git': return 'local git';
	case 'folder-index': return 'folder index';
	case 'folder-scan': return 'folder scan';
	default: return sourceType || '';
	}
}

customElements.define('forge-registry', ForgeRegistry);