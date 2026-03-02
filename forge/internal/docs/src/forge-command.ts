import { html, render, type TemplateResult } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { when } from 'lit-html/directives/when.js';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

class ForgeCommand extends HTMLElement {
	public render(command: DocCommand, metaStatus: MetaStatus): void {
		render(this.commandTemplate(command, metaStatus), this);

		const runner = this.querySelector('forge-runner') as RunnerRenderer | null;
		if (runner) {
			runner.render(command);
		}
	}

	protected commandTemplate(command: DocCommand, metaStatus: MetaStatus): TemplateResult {
		const status = metaStatus[command.name];
		const sourceUrl = vscodeFileUrl(command.sourcePath || '');
		const scriptUrl = vscodeFileUrl(command.scriptPath || '');

		return html`
			<div class="command-detail">
				<div class="command-header">
					<div class="command-name">
						${command.name}
						<span class=${'badge ' + (command.commandType === 'composite' ? 'badge-composite' : 'badge-script')}>${command.commandType}</span>
					</div>
					${when(!!command.description, () => html`<div class="command-description">${command.description}</div>`, () => null)}
					<div class="command-meta">
						${when(!!command.source, () => {
							const isLocal = command.source === 'local';
							const sourceLabel = isLocal ? 'local' : 'inherited from ' + command.source;
							const sourceClass = isLocal ? 'meta-chip-local' : 'meta-chip-inherited';
							if (!isLocal && sourceUrl) {
								return html`<a class=${'meta-chip ' + sourceClass + ' meta-chip-link'} href=${sourceUrl} title="Open source directory in VS Code">${sourceLabel}</a>`;
							}
							return html`<div class=${'meta-chip ' + sourceClass}>${sourceLabel}</div>`;
						}, () => null)}
						${when(!!command.script, () => when(!!scriptUrl,
							() => html`<a class="meta-chip meta-chip-link" href=${scriptUrl} title="Open in VS Code">${unsafeHTML(fileSvg())}${command.script}</a>`,
							() => html`<div class="meta-chip">${unsafeHTML(fileSvg())}${command.script}</div>`
						), () => null)}
						${when(!!command.language, () => html`<div class="meta-chip">${command.language}</div>`, () => null)}
					</div>
				</div>

				${when(command.commandType === 'script' && !!status && status !== 'ready', () => html`
					<div class="section"><div class="meta-loading"><div class="loading-spinner" style="width:16px;height:16px;border-width:2px"></div><span>Loading argument metadata...</span></div></div>
				`, () => null)}

				${when(command.commandType === 'script', () => this.usageTemplate(command), () => null)}
				${when((command.positionals || []).length > 0, () => html`<div class="section"><div class="section-title">Arguments</div>${this.argTableTemplate(command.positionals || [], true)}</div>`, () => null)}
				${when((command.flags || []).length > 0, () => html`<div class="section"><div class="section-title">Flags &amp; Options</div>${this.argTableTemplate(command.flags || [], false)}</div>`, () => null)}
				${when((command.steps || []).length > 0, () => html`<div class="section"><div class="section-title">Run Steps</div>${this.stepsTemplate(command.steps || [])}</div>`, () => null)}
				${when(!!command.example, () => html`<div class="section"><div class="section-title">Example</div><div class="example-content">${unsafeHTML(renderMarkdown(command.example || ''))}</div></div>`, () => null)}

				${when(command.commandType === 'script' || command.commandType === 'composite', () => html`<forge-runner></forge-runner>`, () => null)}
			</div>
		`;
	}

	protected usageTemplate(command: DocCommand): TemplateResult {
		return html`
			<div class="section">
				<div class="section-title">Usage</div>
				<div class="usage-box">
					<span class="usage-prefix">$</span> forge ${command.name}
					${repeat(command.positionals || [], positional => positional.name, positional => positional.required
						? html` <span class="usage-required">&lt;${positional.name}&gt;</span>`
						: html` <span class="usage-optional">[${positional.name}]</span>`)}
					${when((command.flags || []).length > 0, () => html` <span class="usage-optional">[flags]</span>`, () => null)}
				</div>
			</div>
		`;
	}

	protected argTableTemplate(args: DocArg[], isPositional: boolean): TemplateResult {
		return html`
			<table class="arg-table">
				<thead>
					<tr>
						<th>Name</th><th>Type</th><th>Description</th><th>${isPositional ? 'Required' : 'Default'}</th>
					</tr>
				</thead>
				<tbody>
					${repeat(args, arg => arg.name + ':' + arg.type, arg => html`
						<tr>
							<td><span class="arg-name">${isPositional ? '' : '--'}${arg.name}</span></td>
							<td><span class=${'arg-type ' + ((arg.type || 'string') === 'bool' ? 'type-bool' : 'type-string')}>${arg.type || 'string'}</span></td>
							<td>${arg.description || ''}</td>
							<td>
								${isPositional
									? (arg.required ? html`<span class="arg-required">required</span>` : null)
									: html`<span class="arg-default">${arg.defaultValue || ''}</span>`}
							</td>
						</tr>
					`)}
				</tbody>
			</table>
		`;
	}

	protected stepsTemplate(steps: RunStep[]): TemplateResult {
		return html`
			<div class="steps-list">
				${repeat(steps, (_, index) => index, (step, index) => html`
					<div class="step">
						<span class="step-index">${index + 1}</span>
						<span class="step-arrow">→</span>
						${when((step.parallel || []).length > 0,
							() => html`
								<span class="step-parallel-badge">parallel</span>
								<div class="parallel-entries">
									${repeat(step.parallel || [], entry => entry, (entry, pIndex) => {
										const parts = entry.split(' ');
										return html`
											${when(pIndex > 0, () => html`<span class="parallel-separator">·</span>`, () => null)}
											<span class="parallel-entry" data-cmd=${parts[0]} @click=${() => this.selectCommand(parts[0])}>${parts[0]}</span>
											${when(parts.length > 1, () => html`<span class="step-args">${parts.slice(1).join(' ')}</span>`, () => null)}
										`;
									})}
								</div>
							`,
							() => html`
								<span class="step-name" data-cmd=${step.command || ''} @click=${() => this.selectCommand(step.command || '')}>${step.command || ''}</span>
								${when((step.args || []).length > 0, () => html`<span class="step-args">${(step.args || []).join(' ')}</span>`, () => null)}
							`
						)}
					</div>
				`)}
			</div>
		`;
	}

	protected selectCommand(name: string): void {
		if (!name) {
			return;
		}

		this.dispatchEvent(new CustomEvent('command-select', {
			detail: { name },
			bubbles: true
		}));
	}
}

customElements.define('forge-command', ForgeCommand);