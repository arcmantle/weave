class ForgeRegistry extends HTMLElement {
	state = {
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

	searchTimer = null;

	initialize(registrySources = [], installTargets = []) {
		this.state.sources = Array.isArray(registrySources) ? registrySources : [];
		this.state.installTargets = Array.isArray(installTargets) ? installTargets : [];
		this.renderShell();
		this.search(true);
	}

	renderShell() {
		this.innerHTML = ''
			+ '<div class="registry-shell">'
			+ '  <div class="registry-list-panel">'
			+ '    <div class="registry-toolbar">'
			+ '      <input id="registry-search" class="registry-search" type="text" placeholder="Search templates by name, description, language..." />'
			+ '      <select id="registry-source" class="registry-source"></select>'
			+ '    </div>'
			+ '    <div id="registry-results" class="registry-results"></div>'
			+ '    <div class="registry-list-footer">'
			+ '      <span id="registry-count">0 results</span>'
			+ '      <button id="registry-load-more" class="registry-load-more" type="button" style="display:none">Load more</button>'
			+ '    </div>'
			+ '  </div>'
			+ '  <div class="registry-detail-panel">'
			+ '    <div class="registry-detail-scroll" id="registry-detail">'
			+ '      <div class="registry-empty">Select a template to view details and install options.</div>'
			+ '    </div>'
			+ '  </div>'
			+ '</div>';

		this.bindToolbar();
		this.renderSourceOptions();
	}

	bindToolbar() {
		const input = this.querySelector('#registry-search');
		const source = this.querySelector('#registry-source');
		const loadMore = this.querySelector('#registry-load-more');

		if (input) {
			input.value = this.state.query;
			input.addEventListener('input', () => {
				this.state.query = input.value || '';
				if (this.searchTimer) {
					clearTimeout(this.searchTimer);
				}
				this.searchTimer = setTimeout(() => this.search(true), 180);
			});
		}

		if (source) {
			source.addEventListener('change', () => {
				this.state.source = source.value || '';
				this.search(true);
			});
		}

		if (loadMore) {
			loadMore.addEventListener('click', () => this.search(false));
		}
	}

	renderSourceOptions() {
		const sourceSelect = this.querySelector('#registry-source');
		if (!sourceSelect) return;

		let html = '<option value="">All sources</option>';
		(this.state.sources || []).forEach(s => {
			html += '<option value="' + esc(s.name) + '">' + esc(s.name) + ' (' + s.count + ')</option>';
		});
		sourceSelect.innerHTML = html;
		sourceSelect.value = this.state.source || '';
	}

	async search(reset) {
		if (this.state.loading) return;
		this.state.loading = true;

		if (reset) {
			this.state.offset = 0;
			this.state.items = [];
		}

		const q = encodeURIComponent(this.state.query || '');
		const source = encodeURIComponent(this.state.source || '');
		const offset = this.state.offset;
		const limit = this.state.limit;
		const url = '/api/registry/search?q=' + q + '&source=' + source + '&offset=' + offset + '&limit=' + limit;

		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error('Search failed');
			const data = await res.json();

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

	renderResults() {
		const resultsEl = this.querySelector('#registry-results');
		const countEl = this.querySelector('#registry-count');
		const loadMoreEl = this.querySelector('#registry-load-more');
		if (!resultsEl || !countEl || !loadMoreEl) return;

		if (this.state.items.length === 0) {
			resultsEl.innerHTML = '<div class="registry-empty">No templates match your search.</div>';
		} else {
			let html = '';
			this.state.items.forEach(item => {
				const active = this.state.selectedId === item.id ? ' active' : '';
				html += '<div class="registry-item' + active + '" data-id="' + esc(item.id) + '">'
					+ '<div class="registry-item-title"><span>' + esc(item.name) + '</span>' + (item.latestTag ? '<span class="meta-chip">' + esc(item.latestTag) + '</span>' : '') + '</div>'
					+ '<div class="registry-item-desc">' + esc(item.description || '') + '</div>'
					+ '<div class="registry-item-meta">'
					+ '<span>' + esc(item.source) + '</span>'
					+ '<span>' + esc(sourceTypeLabel(item.sourceType)) + '</span>'
					+ '<span>' + esc((item.languages || []).join(', ')) + '</span>'
					+ '</div>'
					+ '</div>';
			});
			resultsEl.innerHTML = html;
			resultsEl.querySelectorAll('.registry-item').forEach(el => {
				el.addEventListener('click', () => this.selectTemplate(el.dataset.id || ''));
			});
		}

		countEl.textContent = this.state.total + ' templates';
		loadMoreEl.style.display = this.state.hasMore ? '' : 'none';
	}

	renderResultsError() {
		const resultsEl = this.querySelector('#registry-results');
		if (resultsEl) {
			resultsEl.innerHTML = '<div class="registry-empty">Failed to load templates.</div>';
		}
	}

	async selectTemplate(id) {
		if (!id) return;
		this.state.selectedId = id;
		this.renderResults();

		const detail = this.querySelector('#registry-detail');
		if (!detail) return;
		detail.innerHTML = '<div class="registry-empty">Loading template...</div>';

		try {
			const res = await fetch('/api/registry/template?id=' + encodeURIComponent(id));
			if (!res.ok) throw new Error('Template not found');
			const tpl = await res.json();
			this.renderTemplateDetail(tpl);
		} catch {
			detail.innerHTML = '<div class="registry-empty">Failed to load template details.</div>';
		}
	}

	renderTemplateDetail(tpl) {
		const selectedRef = tpl.latestTag ? (tpl.name + '@' + tpl.latestTag) : tpl.name;
		let html = '<div class="command-detail"><div class="command-header">';
		html += '<div class="command-name">' + esc(tpl.name) + ' <span class="badge badge-template">template</span></div>';
		if (tpl.description) html += '<div class="command-description">' + esc(tpl.description) + '</div>';
		html += '<div class="command-meta">';
		html += '<div class="meta-chip meta-chip-template">' + esc(tpl.source) + '</div>';
		if (tpl.sourceType) html += '<div class="meta-chip">' + esc(sourceTypeLabel(tpl.sourceType)) + '</div>';
		if (tpl.latestTag) html += '<div class="meta-chip">latest: ' + esc(tpl.latestTag) + '</div>';
		(tpl.languages || []).forEach(lang => {
			html += '<div class="meta-chip">' + esc(langLabel(lang)) + '</div>';
		});
		html += '</div></div>';

		html += '<div class="section"><div class="section-title">Install</div>';
		html += '<div class="template-install">';
		html += '<label class="template-install-field"><span>Command Name</span><input id="registry-install-name" class="template-install-input" type="text" value="' + esc(tpl.name) + '" /></label>';
		html += '<label class="template-install-field"><span>Language</span><select id="registry-install-lang" class="template-install-select"><option value="">Auto</option>';
		(tpl.languages || []).forEach(lang => {
			html += '<option value="' + esc(lang) + '">' + esc(langLabel(lang)) + '</option>';
		});
		html += '</select></label>';
		if ((this.state.installTargets || []).length > 1) {
			html += '<label class="template-install-field"><span>Install Target</span><select id="registry-install-target" class="template-install-select">';
			this.state.installTargets.forEach(t => {
				html += '<option value="' + esc(t.path) + '">' + esc(t.label) + '</option>';
			});
			html += '</select></label>';
		}
		html += '<div class="template-install-actions"><button id="registry-install-btn" class="template-install-btn">Install Template</button><span id="registry-install-status" class="template-install-status"></span></div>';
		html += '</div></div>';

		html += '<div class="section"><div class="section-title">Usage</div><div class="usage-box"><span class="usage-prefix">$</span> forge add <span class="usage-required">&lt;name&gt;</span> --from <span class="usage-template-name">' + esc(selectedRef) + '</span></div></div>';

		if (tpl.variables && tpl.variables.length > 0) {
			html += '<div class="section"><div class="section-title">Variables</div><table class="arg-table"><thead><tr><th>Name</th><th>Description</th><th>Default</th></tr></thead><tbody>';
			tpl.variables.forEach(v => {
				html += '<tr><td><span class="arg-name">' + esc(v.name) + '</span></td><td>' + esc(v.description || '') + '</td><td><span class="arg-default">' + esc(v.default || '') + '</span></td></tr>';
			});
			html += '</tbody></table></div>';
		}

		if (tpl.example) {
			html += '<div class="section"><div class="section-title">Example</div>';
			html += '<div class="example-content">' + renderMarkdown(tpl.example) + '</div>';
			html += '</div>';
		}

		html += '</div>';
		const detail = this.querySelector('#registry-detail');
		if (detail) detail.innerHTML = html;
		this.bindInstall(tpl, selectedRef);
	}

	bindInstall(tpl, selectedRef) {
		const btn = this.querySelector('#registry-install-btn');
		const status = this.querySelector('#registry-install-status');
		const nameInput = this.querySelector('#registry-install-name');
		const langSelect = this.querySelector('#registry-install-lang');
		const targetSelect = this.querySelector('#registry-install-target');
		if (!btn || !status || !nameInput || !langSelect) return;

		btn.addEventListener('click', async () => {
			const commandName = (nameInput.value || '').trim();
			if (!commandName) {
				status.textContent = 'Command name is required';
				status.className = 'template-install-status error';
				return;
			}

			const payload = {
				template: selectedRef,
				commandName,
				language: (langSelect.value || '').trim(),
				targetPath: ''
			};

			if (targetSelect) {
				payload.targetPath = (targetSelect.value || '').trim();
			} else if ((this.state.installTargets || []).length === 1) {
				payload.targetPath = this.state.installTargets[0].path;
			}

			btn.disabled = true;
			status.textContent = 'Installing...';
			status.className = 'template-install-status';
			try {
				const res = await fetch('/api/templates/install', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const raw = await res.text();
				let body = {};
				try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw }; }
				if (!res.ok || body.ok === false) {
					status.textContent = body.message || ('Install failed (HTTP ' + res.status + ')');
					status.className = 'template-install-status error';
					return;
				}
				status.textContent = 'Installed successfully';
				status.className = 'template-install-status success';
			} catch {
				status.textContent = 'Install failed';
				status.className = 'template-install-status error';
			} finally {
				btn.disabled = false;
			}
		});
	}
}

function langLabel(lang) {
	switch (lang) {
	case 'go': return 'Go';
	case 'ts': return 'TypeScript';
	case 'cs': return 'C#';
	default: return lang;
	}
}

function sourceTypeLabel(sourceType) {
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
