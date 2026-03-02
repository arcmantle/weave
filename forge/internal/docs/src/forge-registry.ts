import { html, LitElement, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';

import { renderMarkdown } from './markdown-renderer';
import type {
	DocInstallTarget,
	DocRegistrySource,
	DocTemplate,
	DocTemplateSummary,
	RegistrySearchResponse,
} from './types';


interface RegistryState {
	query:              string;
	source:             string;
	offset:             number;
	limit:              number;
	total:              number;
	hasMore:            boolean;
	loading:            boolean;
	items:              DocTemplateSummary[];
	selectedId:         string;
	sources:            DocRegistrySource[];
	installTargets:     DocInstallTarget[];
	selectedTemplate:   DocTemplate | null;
	detailLoading:      boolean;
	detailError:        string;
	installStatusText:  string;
	installStatusClass: string;
	installBusy:        boolean;
}


class ForgeRegistry extends LitElement {

	protected state: RegistryState = {
		query:              '',
		source:             '',
		offset:             0,
		limit:              50,
		total:              0,
		hasMore:            false,
		loading:            false,
		items:              [],
		selectedId:         '',
		sources:            [],
		installTargets:     [],
		selectedTemplate:   null,
		detailLoading:      false,
		detailError:        '',
		installStatusText:  '',
		installStatusClass: 'template-install-status',
		installBusy:        false,
	};

	protected searchTimer: ReturnType<typeof setTimeout> | null = null;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	initialize(registrySources: DocRegistrySource[] = [], installTargets: DocInstallTarget[] = []): void {
		this.state.sources = Array.isArray(registrySources) ? registrySources : [];
		this.state.installTargets = Array.isArray(installTargets) ? installTargets : [];
		this.requestUpdate();
		void this.search(true);
	}

	protected override render(): TemplateResult {
		return html`
			<div class="registry-shell">
				<div class="registry-list-panel">
					<div class="registry-toolbar">
						<input
							id="registry-search"
							class="registry-search"
							type="text"
							placeholder="Search templates by name, description, language..."
							.value=${ this.state.query }
							@input=${ (event: Event) => this.onSearchInput(event) }
						/>
						<select id="registry-source" class="registry-source" @change=${ (event: Event) => this.onSourceChange(event) }>
							<option value="">All sources</option>
							${ repeat(this.state.sources, source => source.name, source => html`
							<option
								value=${ source.name }
								?selected=${ this.state.source === source.name }
							>
							${ source.name } (${ source.count })
							</option>
							`) }
						</select>
					</div>
					<div id="registry-results" class="registry-results">
						${ this.resultsTemplate() }
					</div>
					<div class="registry-list-footer">
						<span id="registry-count">${ this.state.total } templates</span>
						<button
							id="registry-load-more"
							class="registry-load-more"
							type="button"
							style=${ this.state.hasMore ? '' : 'display:none' }
							@click=${ () => this.search(false) }
						>
							Load more
						</button>
					</div>
				</div>
				<div class="registry-detail-panel">
					<div class="registry-detail-scroll" id="registry-detail">
						${ this.detailTemplate() }
					</div>
				</div>
			</div>
		`;
	}

	protected resultsTemplate(): TemplateResult {
		if (this.state.items.length === 0)
			return html`<div class="registry-empty">No templates match your search.</div>`;


		return html`
			${ repeat(this.state.items, item => item.id, item => html`
				<div
					class=${ 'registry-item' + (this.state.selectedId === item.id ? ' active' : '') }
					data-id=${ item.id }
					@click=${ () => this.selectTemplate(item.id) }
				>
					<div class="registry-item-title">
						<span>${ item.name }</span>
						${ when(!!item.latestTag, () => html`<span class="meta-chip">${ item.latestTag }</span>`, () => nothing) }
					</div>
					<div class="registry-item-desc">${ item.description || '' }</div>
					<div class="registry-item-meta">
						<span>${ item.source }</span>
						<span>${ sourceTypeLabel(item.sourceType) }</span>
						<span>${ (item.languages || []).join(', ') }</span>
					</div>
				</div>
			`) }
		`;
	}

	protected detailTemplate(): TemplateResult {
		if (this.state.detailLoading)
			return html`<div class="registry-empty">Loading template...</div>`;

		if (this.state.detailError)
			return html`<div class="registry-empty">${ this.state.detailError }</div>`;

		if (!this.state.selectedTemplate)
			return html`<div class="registry-empty">Select a template to view details and install options.</div>`;


		const template = this.state.selectedTemplate;
		const selectedRef = template.latestTag ? `${ template.name }@${ template.latestTag }` : template.name;
		const languages = template.languages || [];
		const variables = template.variables || [];

		return html`
			<div class="command-detail">
				<div class="command-header">
					<div class="command-name">${ template.name } <span class="badge badge-template">template</span></div>
					${ when(!!template.description, () => html`<div class="command-description">${ template.description }</div>`, () => nothing) }
					<div class="command-meta">
						<div class="meta-chip meta-chip-template">${ template.source }</div>
						${ when(!!template.sourceType, () => html`<div class="meta-chip">${ sourceTypeLabel(template.sourceType) }</div>`, () => nothing) }
						${ when(!!template.latestTag, () => html`<div class="meta-chip">latest: ${ template.latestTag }</div>`, () => nothing) }
						${ repeat(languages, language => language, language => html`<div class="meta-chip">${ langLabel(language) }</div>`) }
					</div>
				</div>

				<div class="section">
					<div class="section-title">Install</div>
					<div class="template-install">
						<label class="template-install-field"><span>Command Name</span><input id="registry-install-name" class="template-install-input" type="text" .value=${ template.name } /></label>
						<label class="template-install-field">
							<span>Language</span>
							<select id="registry-install-lang" class="template-install-select">
								<option value="">Auto</option>
								${ repeat(languages, language => language, language => html`<option value=${ language }>${ langLabel(language) }</option>`) }
							</select>
						</label>
						${ when(this.state.installTargets.length > 1, () => html`
							<label class="template-install-field">
								<span>Install Target</span>
								<select id="registry-install-target" class="template-install-select">
									${ repeat(this.state.installTargets, target => target.path, target => html`<option value=${ target.path }>${ target.label }</option>`) }
								</select>
							</label>
						`, () => nothing) }
						<div class="template-install-actions">
							<button id="registry-install-btn" class="template-install-btn" ?disabled=${ this.state.installBusy } @click=${ () => this.handleInstall(selectedRef) }>Install Template</button>
							<span id="registry-install-status" class=${ this.state.installStatusClass }>${ this.state.installStatusText }</span>
						</div>
					</div>
				</div>

				<div class="section">
					<div class="section-title">Usage</div>
					<div class="usage-box"><span class="usage-prefix">$</span> forge add <span class="usage-required">&lt;name&gt;</span> --from <span class="usage-template-name">${ selectedRef }</span></div>
				</div>

				${ when(variables.length > 0, () => html`
					<div class="section">
						<div class="section-title">Variables</div>
						<table class="arg-table">
							<thead><tr><th>Name</th><th>Description</th><th>Default</th></tr></thead>
							<tbody>
								${ repeat(variables, variable => variable.name, variable => html`
									<tr>
										<td><span class="arg-name">${ variable.name }</span></td>
										<td>${ variable.description || '' }</td>
										<td><span class="arg-default">${ variable.default || '' }</span></td>
									</tr>
								`) }
							</tbody>
						</table>
					</div>
				`, () => nothing) }

				${ when(!!template.example, () => html`
					<div class="section">
						<div class="section-title">Example</div>
						<div class="example-content">${ unsafeHTML(renderMarkdown(template.example || '')) }</div>
					</div>
				`, () => nothing) }
			</div>
		`;
	}

	protected onSearchInput(event: Event): void {
		const input = event.target as HTMLInputElement;
		this.state.query = input.value || '';
		if (this.searchTimer)
			clearTimeout(this.searchTimer);

		this.searchTimer = setTimeout(() => {
			void this.search(true);
		}, 180);
	}

	protected onSourceChange(event: Event): void {
		const select = event.target as HTMLSelectElement;
		this.state.source = select.value || '';
		void this.search(true);
	}

	protected async search(reset: boolean): Promise<void> {
		if (this.state.loading)
			return;

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
			if (!response.ok)
				throw new Error('Search failed');

			const data = await response.json() as RegistrySearchResponse;
			const items = Array.isArray(data.items) ? data.items : [];
			this.state.total = data.total || 0;
			this.state.hasMore = !!data.hasMore;
			this.state.items = reset ? items : this.state.items.concat(items);
			this.state.offset = this.state.items.length;
		}
		catch {
			this.state.items = [];
			this.state.total = 0;
			this.state.hasMore = false;
		}
		finally {
			this.state.loading = false;
			this.requestUpdate();
		}
	}

	protected async selectTemplate(id: string): Promise<void> {
		if (!id)
			return;


		this.state.selectedId = id;
		this.state.selectedTemplate = null;
		this.state.detailLoading = true;
		this.state.detailError = '';
		this.state.installStatusText = '';
		this.state.installStatusClass = 'template-install-status';
		this.requestUpdate();

		try {
			const response = await fetch('/api/registry/template?id=' + encodeURIComponent(id));
			if (!response.ok)
				throw new Error('Template not found');

			this.state.selectedTemplate = await response.json() as DocTemplate;
			this.state.detailLoading = false;
			this.requestUpdate();
		}
		catch {
			this.state.selectedTemplate = null;
			this.state.detailLoading = false;
			this.state.detailError = 'Failed to load template details.';
			this.requestUpdate();
		}
	}

	protected async handleInstall(selectedRef: string): Promise<void> {
		const nameInput = this.querySelector('#registry-install-name') as HTMLInputElement | null;
		const langSelect = this.querySelector('#registry-install-lang') as HTMLSelectElement | null;
		const targetSelect = this.querySelector('#registry-install-target') as HTMLSelectElement | null;
		if (!nameInput || !langSelect)
			return;


		const commandName = (nameInput.value || '').trim();
		if (!commandName) {
			this.state.installStatusText = 'Command name is required';
			this.state.installStatusClass = 'template-install-status error';
			this.requestUpdate();

			return;
		}

		const payload: {
			template:    string;
			commandName: string;
			language:    string;
			targetPath:  string;
		} = {
			template:   selectedRef,
			commandName,
			language:   (langSelect.value || '').trim(),
			targetPath: '',
		};

		if (targetSelect) { payload.targetPath = (targetSelect.value || '').trim(); }
		else if (this.state.installTargets.length === 1) {
			const defaultTarget = this.state.installTargets[0];
			if (defaultTarget)
				payload.targetPath = defaultTarget.path;
		}


		this.state.installBusy = true;
		this.state.installStatusText = 'Installing...';
		this.state.installStatusClass = 'template-install-status';
		this.requestUpdate();

		try {
			const response = await fetch('/api/templates/install', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify(payload),
			});
			const raw = await response.text();
			let body: { ok?: boolean; message?: string; } = {};
			try {
				body = raw ? JSON.parse(raw) as { ok?: boolean; message?: string; } : {};
			}
			catch {
				body = { message: raw };
			}

			if (!response.ok || body.ok === false) {
				this.state.installStatusText = body.message || ('Install failed (HTTP ' + response.status + ')');
				this.state.installStatusClass = 'template-install-status error';
				this.requestUpdate();

				return;
			}

			this.state.installStatusText = 'Installed successfully';
			this.state.installStatusClass = 'template-install-status success';
			this.requestUpdate();
		}
		catch {
			this.state.installStatusText = 'Install failed';
			this.state.installStatusClass = 'template-install-status error';
			this.requestUpdate();
		}
		finally {
			this.state.installBusy = false;
			this.requestUpdate();
		}
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
