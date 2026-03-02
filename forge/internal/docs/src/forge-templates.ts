import { html, render, type TemplateResult } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { when } from 'lit-html/directives/when.js';

class ForgeTemplates extends HTMLElement {
	public render(template: DocTemplate, installTargets: DocInstallTarget[] = []): void {
		const selectedRef = template.latestTag ? `${template.name}@${template.latestTag}` : template.name;
		render(this.templateView(template, installTargets, selectedRef), this);
		this.bindInstallActions(template, installTargets, selectedRef);
	}

	protected templateView(template: DocTemplate, installTargets: DocInstallTarget[], selectedRef: string): TemplateResult {
		const languages = template.languages || [];
		const variables = template.variables || [];

		return html`
			<div class="command-detail">
				<div class="command-header">
					<div class="command-name">${template.name} <span class="badge badge-template">template</span></div>
					${when(!!template.description, () => html`<div class="command-description">${template.description}</div>`, () => null)}
					<div class="command-meta">
						<div class="meta-chip meta-chip-template">${template.source}</div>
						${when(!!template.sourceType, () => html`<div class="meta-chip">${sourceTypeLabel(template.sourceType || '')}</div>`, () => null)}
						${when(!!template.latestTag, () => html`<div class="meta-chip">latest: ${template.latestTag}</div>`, () => null)}
						${repeat(languages, language => language, language => html`<div class="meta-chip">${langLabel(language)}</div>`)}
					</div>
				</div>

				<div class="section"><div class="section-title">Install</div>
					<div class="template-install">
						<label class="template-install-field"><span>Command Name</span><input id="tpl-install-name" class="template-install-input" type="text" .value=${template.name} /></label>
						<label class="template-install-field"><span>Language</span><select id="tpl-install-lang" class="template-install-select"><option value="">Auto</option>${repeat(languages, language => language, language => html`<option value=${language}>${langLabel(language)}</option>`)}</select></label>
						${when(installTargets.length > 1, () => html`
							<label class="template-install-field"><span>Install Target</span><select id="tpl-install-target" class="template-install-select">${repeat(installTargets, target => target.path, target => html`<option value=${target.path}>${target.label}</option>`)}</select></label>
						`, () => null)}
						<div class="template-install-actions">
							<button id="tpl-install-btn" class="template-install-btn">Install Template</button>
							<span id="tpl-install-status" class="template-install-status"></span>
						</div>
					</div>
				</div>

				<div id="tpl-install-log-wrap" class="template-install-log-wrap" style="display:none">
					<div class="template-install-log-actions">
						<button id="tpl-install-log-toggle" class="template-install-log-toggle" type="button">Show Full Log</button>
						<button id="tpl-install-log-copy" class="template-install-log-copy" type="button">Copy Log</button>
					</div>
					<pre id="tpl-install-output" class="template-install-output" style="display:none"></pre>
				</div>

				<div class="section"><div class="section-title">Usage</div>
					<div class="usage-box"><span class="usage-prefix">$</span> forge add <span class="usage-required">&lt;name&gt;</span> --from <span class="usage-template-name">${selectedRef}</span>
					${when(languages.length > 0, () => html` <span class="usage-optional">[--${languages[0]}]</span>`, () => null)}
					${when(variables.length > 0, () => html` <span class="usage-optional">[--var key=value]</span>`, () => null)}
					</div>
				</div>

				${when((template.versions || []).length > 1, () => html`
					<div class="section"><div class="section-title">Previous Versions</div>
						<div class="template-versions">${repeat((template.versions || []).slice(1), version => version, version => html`<div class="template-version-item"><code>${template.name + '@' + version}</code></div>`)}</div>
					</div>
				`, () => null)}

				${when(variables.length > 0, () => html`
					<div class="section"><div class="section-title">Variables</div>
						<table class="arg-table"><thead><tr><th>Name</th><th>Description</th><th>Default</th></tr></thead><tbody>
							${repeat(variables, variable => variable.name, variable => html`<tr><td><span class="arg-name">${variable.name}</span></td><td>${variable.description || ''}</td><td><span class="arg-default">${variable.default || ''}</span></td></tr>`)}
						</tbody></table>
					</div>
				`, () => null)}

				<div class="section"><div class="section-title">Supported Languages</div>
					<div class="template-languages">${repeat(languages, language => language, language => html`<div class="template-lang-chip"><span class="template-lang-name">${langLabel(language)}</span><span class="template-lang-flag">--${language}</span></div>`)}</div>
				</div>

				<div class="section"><div class="section-title">Examples</div>
					<div class="template-examples">
						<div class="template-example"><code>forge add my-command --from ${selectedRef}</code></div>
						${when(languages.length > 1, () => html`<div class="template-example"><code>forge add my-command --from ${selectedRef} --${languages[1]}</code></div>`, () => null)}
						${when(variables.length > 0, () => html`<div class="template-example"><code>${['forge add my-command --from ' + selectedRef, ...variables.map(variable => '--var ' + variable.name + '=' + (variable.default || '<value>'))].join(' ')}</code></div>`, () => null)}
					</div>
				</div>
			</div>
		`;
	}

	protected bindInstallActions(template: DocTemplate, installTargets: DocInstallTarget[], selectedRef: string): void {
		const button = this.querySelector('#tpl-install-btn') as HTMLButtonElement | null;
		const status = this.querySelector('#tpl-install-status') as HTMLElement | null;
		const nameInput = this.querySelector('#tpl-install-name') as HTMLInputElement | null;
		const langSelect = this.querySelector('#tpl-install-lang') as HTMLSelectElement | null;
		const targetSelect = this.querySelector('#tpl-install-target') as HTMLSelectElement | null;
		const output = this.querySelector('#tpl-install-output') as HTMLElement | null;
		const logWrap = this.querySelector('#tpl-install-log-wrap') as HTMLElement | null;
		const logToggle = this.querySelector('#tpl-install-log-toggle') as HTMLButtonElement | null;
		const logCopy = this.querySelector('#tpl-install-log-copy') as HTMLButtonElement | null;
		let logExpanded = false;
		let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

		const setLog = (text: string, expand: boolean): void => {
			if (!output || !logWrap || !logToggle) {
				return;
			}
			const trimmed = (text || '').trim();
			if (!trimmed) {
				logWrap.style.display = 'none';
				output.style.display = 'none';
				output.textContent = '';
				logExpanded = false;
				logToggle.textContent = 'Show Full Log';
				return;
			}

			output.textContent = trimmed;
			logWrap.style.display = '';
			logExpanded = !!expand;
			output.style.display = logExpanded ? '' : 'none';
			logToggle.textContent = logExpanded ? 'Hide Full Log' : 'Show Full Log';
		};

		if (logToggle) {
			logToggle.addEventListener('click', () => {
				if (!output || !output.textContent) {
					return;
				}
				logExpanded = !logExpanded;
				output.style.display = logExpanded ? '' : 'none';
				logToggle.textContent = logExpanded ? 'Hide Full Log' : 'Show Full Log';
			});
		}

		if (logCopy) {
			logCopy.addEventListener('click', async () => {
				const text = output?.textContent || '';
				if (!text) {
					return;
				}

				const setCopyLabel = (label: string): void => {
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
					// Fall through.
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

		if (!button || !status || !nameInput || !langSelect) {
			return;
		}

		button.addEventListener('click', async () => {
			setLog('', false);

			const commandName = (nameInput.value || '').trim();
			if (!commandName) {
				status.textContent = 'Command name is required';
				status.className = 'template-install-status error';
				setLog('Validation: commandName is required.', true);
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
			} else if (installTargets.length === 1) {
				payload.targetPath = installTargets[0].path;
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
				let body: { ok?: boolean; message?: string; output?: string } = {};
				try {
					body = raw ? JSON.parse(raw) as { ok?: boolean; message?: string; output?: string } : {};
				} catch {
					body = { message: raw };
				}

				if (!response.ok || body.ok === false) {
					const message = body.message || ('Install failed (HTTP ' + response.status + ')');
					status.textContent = message;
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

function sourceTypeLabel(sourceType: string): string {
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