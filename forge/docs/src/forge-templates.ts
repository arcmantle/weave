import { type CSSResultGroup, html, LitElement, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';

import { forgeTemplatesStyles } from './forge-templates-styles';
import type { DocInstallTarget, DocTemplate } from './types';

class ForgeTemplates extends LitElement {

	protected templateData:   DocTemplate | null = null;
	protected installTargets: DocInstallTarget[] = [];
	protected selectedRef = '';
	protected installStatusText = '';
	protected installStatusClass = 'template-install-status';
	protected logText = '';
	protected logExpanded = false;
	protected copyLabel = 'Copy Log';
	protected copyResetTimer: ReturnType<typeof setTimeout> | null = null;

	static override styles: CSSResultGroup = [ forgeTemplatesStyles ];

	setTemplate(template: DocTemplate, installTargets: DocInstallTarget[] = []): void {
		this.templateData = template;
		this.installTargets = installTargets;
		this.selectedRef = template.latestTag
			? `${ template.name }@${ template.latestTag }`
			: template.name;
		this.installStatusText = '';
		this.installStatusClass = 'template-install-status';
		this.logText = '';
		this.logExpanded = false;
		this.copyLabel = 'Copy Log';
		this.requestUpdate();
	}

	protected override render(): TemplateResult {
		if (!this.templateData)
			return html``;


		return this.templateView(this.templateData, this.installTargets, this.selectedRef);
	}

	protected templateView(template: DocTemplate, installTargets: DocInstallTarget[], selectedRef: string): TemplateResult {
		const languages = template.languages || [];
		const variables = template.variables || [];

		return html`
			<div class="command-detail">
				<div class="command-header">
					<div class="command-name">${ template.name } <span class="badge badge-template">template</span></div>
					${ when(
						!!template.description,
						() => html`<div class="command-description">${ template.description }</div>`,
						() => null,
					) }
					<div class="command-meta">
						<div class="meta-chip meta-chip-template">${ template.source }</div>
						${ when(
							!!template.sourceType,
							() => html`<div class="meta-chip">${ sourceTypeLabel(template.sourceType || '') }</div>`,
							() => null,
						) }
						${ when(
							!!template.latestTag,
							() => html`<div class="meta-chip">latest: ${ template.latestTag }</div>`,
							() => null,
						) }
						${ repeat(
							languages,
							language => language,
							language => html`<div class="meta-chip">${ langLabel(language) }</div>`,
						) }
					</div>
				</div>

				<div class="section"><div class="section-title">Install</div>
					<div class="template-install">
						<label class="template-install-field">
							<span>Command Name</span>
							<input
								id="tpl-install-name"
								class="template-install-input"
								type="text"
								.value=${ template.name }
							/>
						</label>
						<label class="template-install-field">
							<span>Language</span>
							<select id="tpl-install-lang" class="template-install-select">
								<option value="">Auto</option>
								${ repeat(
									languages,
									language => language,
									language => html`<option value=${ language }>${ langLabel(language) }</option>`,
								) }
							</select>
						</label>
						${ when(installTargets.length > 1, () => html`
							<label class="template-install-field">
								<span>Install Target</span>
								<select id="tpl-install-target" class="template-install-select">
									${ repeat(
										installTargets,
										target => target.path,
										target => html`<option value=${ target.path }>${ target.label }</option>`,
									) }
								</select>
							</label>
						`, () => null) }
						<div class="template-install-actions">
							<button
								id="tpl-install-btn"
								class="template-install-btn"
								@click=${ () => this.handleInstall() }
							>
								Install Template
							</button>
							<span id="tpl-install-status" class=${ this.installStatusClass }>${ this.installStatusText }</span>
						</div>
					</div>
				</div>

				<div id="tpl-install-log-wrap" class="template-install-log-wrap" style=${ this.logText ? '' : 'display:none' }>
					<div class="template-install-log-actions">
						<button
							id="tpl-install-log-toggle"
							class="template-install-log-toggle"
							type="button"
							@click=${ () => this.toggleLog() }
						>
							${ this.logExpanded ? 'Hide Full Log' : 'Show Full Log' }
						</button>
						<button
							id="tpl-install-log-copy"
							class="template-install-log-copy"
							type="button"
							@click=${ () => this.copyLog() }
						>
							${ this.copyLabel }
						</button>
					</div>
					<pre
						id="tpl-install-output"
						class="template-install-output"
						style=${ this.logExpanded ? '' : 'display:none' }
					>${ this.logText }</pre>
				</div>

				<div class="section"><div class="section-title">Usage</div>
					<div class="usage-box">
						<span class="usage-prefix">$</span> forge add
						<span class="usage-required">&lt;name&gt;</span> --from
						<span class="usage-template-name">${ selectedRef }</span>
					${ when(languages.length > 0, () => html` <span class="usage-optional">[--${ languages[0] }]</span>`, () => null) }
					${ when(variables.length > 0, () => html` <span class="usage-optional">[--var key=value]</span>`, () => null) }
					</div>
				</div>

				${ when((template.versions || []).length > 1, () => html`
					<div class="section"><div class="section-title">Previous Versions</div>
						<div class="template-versions">
							${ repeat(
								(template.versions || []).slice(1),
								version => version,
								version => html`<div class="template-version-item"><code>${ template.name + '@' + version }</code></div>`,
							) }
						</div>
					</div>
				`, () => null) }

				${ when(variables.length > 0, () => html`
					<div class="section"><div class="section-title">Variables</div>
						<table class="arg-table"><thead><tr><th>Name</th><th>Description</th><th>Default</th></tr></thead><tbody>
							${ repeat(
								variables,
								variable => variable.name,
								variable => html`
									<tr>
										<td><span class="arg-name">${ variable.name }</span></td>
										<td>${ variable.description || '' }</td>
										<td><span class="arg-default">${ variable.default || '' }</span></td>
									</tr>
								`,
							) }
						</tbody></table>
					</div>
				`, () => null) }

				<div class="section"><div class="section-title">Supported Languages</div>
					<div class="template-languages">
						${ repeat(
							languages,
							language => language,
							language => html`
								<div class="template-lang-chip">
									<span class="template-lang-name">${ langLabel(language) }</span>
									<span class="template-lang-flag">--${ language }</span>
								</div>
							`,
						) }
					</div>
				</div>

				<div class="section"><div class="section-title">Examples</div>
					<div class="template-examples">
						<div class="template-example"><code>forge add my-command --from ${ selectedRef }</code></div>
						${ when(
							languages.length > 1,
							() => html`
								<div class="template-example">
									<code>forge add my-command --from ${ selectedRef } --${ languages[1] }</code>
								</div>
							`,
							() => null,
						) }
						${ when(
							variables.length > 0,
							() => html`
								<div class="template-example"><code>${ [
									'forge add my-command --from ' + selectedRef,
									...variables.map(variable => '--var ' + variable.name + '=' + (variable.default || '<value>')),
								].join(' ') }</code></div>
							`,
							() => null,
						) }
					</div>
				</div>
			</div>
		`;
	}

	protected async handleInstall(): Promise<void> {
		if (!this.templateData)
			return;


		const nameInput = this.renderRoot.querySelector('#tpl-install-name') as HTMLInputElement | null;
		const langSelect = this.renderRoot.querySelector('#tpl-install-lang') as HTMLSelectElement | null;
		const targetSelect = this.renderRoot.querySelector('#tpl-install-target') as HTMLSelectElement | null;
		if (!nameInput || !langSelect)
			return;


		const commandName = (nameInput.value || '').trim();
		if (!commandName) {
			this.installStatusText = 'Command name is required';
			this.installStatusClass = 'template-install-status error';
			this.logText = 'Validation: commandName is required.';
			this.logExpanded = true;
			this.requestUpdate();

			return;
		}

		const payload: {
			template:    string;
			commandName: string;
			language:    string;
			targetPath:  string;
		} = {
			template:   this.selectedRef,
			commandName,
			language:   (langSelect.value || '').trim(),
			targetPath: '',
		};

		if (targetSelect) { payload.targetPath = (targetSelect.value || '').trim(); }
		else if (this.installTargets.length === 1) {
			const defaultTarget = this.installTargets[0];
			if (defaultTarget)
				payload.targetPath = defaultTarget.path;
		}


		this.installStatusText = 'Installing...';
		this.installStatusClass = 'template-install-status';
		this.logText = '';
		this.logExpanded = false;
		this.requestUpdate();

		try {
			const response = await fetch('/api/templates/install', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify(payload),
			});

			const raw = await response.text();
			let body: { ok?: boolean; message?: string; output?: string; } = {};
			try {
				body = raw ? JSON.parse(raw) as { ok?: boolean; message?: string; output?: string; } : {};
			}
			catch {
				body = { message: raw };
			}

			if (!response.ok || body.ok === false) {
				const message = body.message || ('Install failed (HTTP ' + response.status + ')');
				this.installStatusText = message;
				this.installStatusClass = 'template-install-status error';
				this.logText = (body.output || raw || '').trim();
				this.logExpanded = true;
				this.requestUpdate();

				return;
			}

			this.installStatusText = 'Installed successfully';
			this.installStatusClass = 'template-install-status success';
			this.logText = (body.output || '').trim();
			this.logExpanded = false;
			this.requestUpdate();
		}
		catch {
			this.installStatusText = 'Install failed';
			this.installStatusClass = 'template-install-status error';
			this.logText = 'Network error while calling /api/templates/install';
			this.logExpanded = true;
			this.requestUpdate();
		}
	}

	protected toggleLog(): void {
		if (!this.logText)
			return;


		this.logExpanded = !this.logExpanded;
		this.requestUpdate();
	}

	protected async copyLog(): Promise<void> {
		if (!this.logText)
			return;


		const setCopyLabel = (label: string): void => {
			this.copyLabel = label;
			this.requestUpdate();
			if (this.copyResetTimer)
				clearTimeout(this.copyResetTimer);

			this.copyResetTimer = setTimeout(() => {
				this.copyLabel = 'Copy Log';
				this.requestUpdate();
			}, 1200);
		};

		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(this.logText);
				setCopyLabel('Copied');

				return;
			}
		}
		catch {
			// Fall through.
		}

		try {
			const area = document.createElement('textarea');
			area.value = this.logText;
			area.setAttribute('readonly', 'true');
			area.style.position = 'absolute';
			area.style.left = '-9999px';
			document.body.appendChild(area);
			area.select();
			document.execCommand('copy');
			document.body.removeChild(area);
			setCopyLabel('Copied');
		}
		catch {
			setCopyLabel('Copy Failed');
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
