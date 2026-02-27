// ─── Template Detail Component ───
/**
 * Displays full template documentation: description, languages, variables, and usage.
 * @extends HTMLElement
 */
class ForgeTemplates extends HTMLElement {

	/**
	 * Render the full template detail view.
	 * @param {DocTemplate} tpl - The template to display.
	 * @param {DocInstallTarget[]} installTargets - Available install targets.
	 */
	render(tpl, installTargets = []) {
		const selectedRef = tpl.latestTag ? (tpl.name + '@' + tpl.latestTag) : tpl.name;
		let html = '<div class="command-detail"><div class="command-header">';
		html += '<div class="command-name">' + esc(tpl.name);
		html += ' <span class="badge badge-template">template</span>';
		html += '</div>';

		if (tpl.description) {
			html += '<div class="command-description">' + esc(tpl.description) + '</div>';
		}

		html += '<div class="command-meta">';
		html += '<div class="meta-chip meta-chip-template">' + esc(tpl.source) + '</div>';
		if (tpl.sourceType) {
			html += '<div class="meta-chip">' + esc(sourceTypeLabel(tpl.sourceType)) + '</div>';
		}
		if (tpl.latestTag) {
			html += '<div class="meta-chip">latest: ' + esc(tpl.latestTag) + '</div>';
		}
		if (tpl.languages && tpl.languages.length > 0) {
			tpl.languages.forEach(lang => {
				html += '<div class="meta-chip">' + esc(langLabel(lang)) + '</div>';
			});
		}
		html += '</div></div>';

		html += '<div class="section"><div class="section-title">Install</div>';
		html += '<div class="template-install">';
		html += '<label class="template-install-field"><span>Command Name</span><input id="tpl-install-name" class="template-install-input" type="text" value="' + esc(tpl.name) + '" /></label>';
		html += '<label class="template-install-field"><span>Language</span><select id="tpl-install-lang" class="template-install-select">';
		html += '<option value="">Auto</option>';
		(tpl.languages || []).forEach(lang => {
			html += '<option value="' + esc(lang) + '">' + esc(langLabel(lang)) + '</option>';
		});
		html += '</select></label>';

		if (installTargets.length > 1) {
			html += '<label class="template-install-field"><span>Install Target</span><select id="tpl-install-target" class="template-install-select">';
			installTargets.forEach(t => {
				html += '<option value="' + esc(t.path) + '">' + esc(t.label) + '</option>';
			});
			html += '</select></label>';
		}

		html += '<div class="template-install-actions">';
		html += '<button id="tpl-install-btn" class="template-install-btn">Install Template</button>';
		html += '<span id="tpl-install-status" class="template-install-status"></span>';
		html += '</div></div></div>';
		html += '<div id="tpl-install-log-wrap" class="template-install-log-wrap" style="display:none">';
		html += '<div class="template-install-log-actions">';
		html += '<button id="tpl-install-log-toggle" class="template-install-log-toggle" type="button">Show Full Log</button>';
		html += '<button id="tpl-install-log-copy" class="template-install-log-copy" type="button">Copy Log</button>';
		html += '</div>';
		html += '<pre id="tpl-install-output" class="template-install-output" style="display:none"></pre>';
		html += '</div>';

		// Usage section.
		html += '<div class="section"><div class="section-title">Usage</div>';
		html += '<div class="usage-box">';
		html += '<span class="usage-prefix">$</span> forge add <span class="usage-required">&lt;name&gt;</span>';
		html += ' --from <span class="usage-template-name">' + esc(selectedRef) + '</span>';
		if (tpl.languages && tpl.languages.length > 0) {
			html += ' <span class="usage-optional">[--' + esc(tpl.languages[0]) + ']</span>';
		}
		if (tpl.variables && tpl.variables.length > 0) {
			html += ' <span class="usage-optional">[--var key=value]</span>';
		}
		html += '</div></div>';

		if (tpl.versions && tpl.versions.length > 1) {
			html += '<div class="section"><div class="section-title">Previous Versions</div>';
			html += '<div class="template-versions">';
			for (let i = 1; i < tpl.versions.length; i++) {
				const version = tpl.versions[i];
				html += '<div class="template-version-item"><code>' + esc(tpl.name + '@' + version) + '</code></div>';
			}
			html += '</div></div>';
		}

		// Variables section.
		if (tpl.variables && tpl.variables.length > 0) {
			html += '<div class="section"><div class="section-title">Variables</div>';
			html += '<table class="arg-table"><thead><tr>';
			html += '<th>Name</th><th>Description</th><th>Default</th>';
			html += '</tr></thead><tbody>';

			tpl.variables.forEach(v => {
				html += '<tr>';
				html += '<td><span class="arg-name">' + esc(v.name) + '</span></td>';
				html += '<td>' + esc(v.description || '') + '</td>';
				html += '<td><span class="arg-default">' + esc(v.default || '') + '</span></td>';
				html += '</tr>';
			});

			html += '</tbody></table></div>';
		}

		// Languages section.
		html += '<div class="section"><div class="section-title">Supported Languages</div>';
		html += '<div class="template-languages">';
		(tpl.languages || []).forEach(lang => {
			html += '<div class="template-lang-chip">';
			html += '<span class="template-lang-name">' + esc(langLabel(lang)) + '</span>';
			html += '<span class="template-lang-flag">--' + esc(lang) + '</span>';
			html += '</div>';
		});
		html += '</div></div>';

		// Example commands section.
		html += '<div class="section"><div class="section-title">Examples</div>';
		html += '<div class="template-examples">';

		// Basic usage.
		let basic = 'forge add my-command --from ' + selectedRef;
		html += '<div class="template-example"><code>' + esc(basic) + '</code></div>';

		// With language flag.
		if (tpl.languages && tpl.languages.length > 1) {
			let langEx = 'forge add my-command --from ' + selectedRef + ' --' + tpl.languages[1];
			html += '<div class="template-example"><code>' + esc(langEx) + '</code></div>';
		}

		// With variables.
		if (tpl.variables && tpl.variables.length > 0) {
			let varParts = ['forge add my-command --from ' + selectedRef];
			tpl.variables.forEach(v => {
				const val = v.default || '<value>';
				varParts.push('--var ' + v.name + '=' + val);
			});
			html += '<div class="template-example"><code>' + esc(varParts.join(' ')) + '</code></div>';
		}

		html += '</div></div>';

		html += '</div>';
		this.innerHTML = html;

		this.bindInstallActions(tpl, installTargets, selectedRef);
	}

	bindInstallActions(tpl, installTargets, selectedRef) {
		const btn = this.querySelector('#tpl-install-btn');
		const status = this.querySelector('#tpl-install-status');
		const nameInput = this.querySelector('#tpl-install-name');
		const langSelect = this.querySelector('#tpl-install-lang');
		const targetSelect = this.querySelector('#tpl-install-target');
		const outputEl = this.querySelector('#tpl-install-output');
		const logWrap = this.querySelector('#tpl-install-log-wrap');
		const logToggle = this.querySelector('#tpl-install-log-toggle');
		const logCopy = this.querySelector('#tpl-install-log-copy');
		let logExpanded = false;
		let copyResetTimer = null;

		const setLog = (text, expand) => {
			if (!outputEl || !logWrap || !logToggle) return;
			const trimmed = (text || '').trim();
			if (!trimmed) {
				logWrap.style.display = 'none';
				outputEl.style.display = 'none';
				outputEl.textContent = '';
				logExpanded = false;
				logToggle.textContent = 'Show Full Log';
				return;
			}

			outputEl.textContent = trimmed;
			logWrap.style.display = '';
			logExpanded = !!expand;
			outputEl.style.display = logExpanded ? '' : 'none';
			logToggle.textContent = logExpanded ? 'Hide Full Log' : 'Show Full Log';
		};

		if (logToggle) {
			logToggle.addEventListener('click', () => {
				if (!outputEl || !logWrap || !outputEl.textContent) return;
				logExpanded = !logExpanded;
				outputEl.style.display = logExpanded ? '' : 'none';
				logToggle.textContent = logExpanded ? 'Hide Full Log' : 'Show Full Log';
			});
		}

		if (logCopy) {
			logCopy.addEventListener('click', async () => {
				const text = (outputEl && outputEl.textContent) ? outputEl.textContent : '';
				if (!text) return;

				const setCopyLabel = (label) => {
					logCopy.textContent = label;
					if (copyResetTimer) {
						clearTimeout(copyResetTimer);
					}
					copyResetTimer = setTimeout(() => {
						logCopy.textContent = 'Copy Log';
					}, 1200);
				};

				try {
					if (navigator.clipboard && navigator.clipboard.writeText) {
						await navigator.clipboard.writeText(text);
						setCopyLabel('Copied');
						return;
					}
				} catch {
					// Fall through to execCommand fallback.
				}

				try {
					const area = document.createElement('textarea');
					area.value = text;
					area.setAttribute('readonly', 'true');
					area.style.position = 'absolute';
					area.style.left = '-9999px';
					document.body.appendChild(area);
					area.select();
					document.execCommand('copy');
					document.body.removeChild(area);
					setCopyLabel('Copied');
				} catch {
					setCopyLabel('Copy Failed');
				}
			});
		}

		if (!btn || !status || !nameInput || !langSelect) {
			return;
		}

		btn.addEventListener('click', async () => {
			setLog('', false);

			const commandName = (nameInput.value || '').trim();
			if (!commandName) {
				status.textContent = 'Command name is required';
				status.className = 'template-install-status error';
				setLog('Validation: commandName is required.', true);
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
			} else if (installTargets.length === 1) {
				payload.targetPath = installTargets[0].path;
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
				try {
					body = raw ? JSON.parse(raw) : {};
				} catch {
					body = { message: raw };
				}

				if (!res.ok || body.ok === false) {
					const msg = body.message || ('Install failed (HTTP ' + res.status + ')');
					status.textContent = msg;
					status.className = 'template-install-status error';
					setLog(body.output || raw || '', true);
					return;
				}

				status.textContent = 'Installed successfully';
				status.className = 'template-install-status success';
				setLog(body.output || '', false);
			} catch {
				status.textContent = 'Install failed';
				status.className = 'template-install-status error';
				setLog('Network error while calling /api/templates/install', true);
			} finally {
				btn.disabled = false;
			}
		});
	}
}

/**
 * Map language code to display label.
 * @param {string} lang
 * @returns {string}
 */
function langLabel(lang) {
	switch (lang) {
	case 'go': return 'Go';
	case 'ts': return 'TypeScript';
	case 'cs': return 'C#';
	default: return lang;
	}
}

/**
 * Map source type code to display label.
 * @param {string} sourceType
 * @returns {string}
 */
function sourceTypeLabel(sourceType) {
	switch (sourceType) {
	case 'built-in': return 'built-in';
	case 'github-git': return 'github git';
	case 'local-git': return 'local git';
	case 'folder-index': return 'folder index';
	case 'folder-scan': return 'folder scan';
	default: return sourceType;
	}
}

customElements.define('forge-templates', ForgeTemplates);
