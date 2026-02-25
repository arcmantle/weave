// ─── Command Detail Component ───
/**
 * Displays full command documentation: usage, arguments, flags, steps, example, and runner.
 * @extends HTMLElement
 */
class ForgeCommand extends HTMLElement {

	/**
	 * Render the full command detail view.
	 * @param {DocCommand} cmd - The command to display.
	 * @param {MetaStatus} metaStatus - Current metadata loading status per command.
	 */
	render(cmd, metaStatus) {
		let html = '<div class="command-detail"><div class="command-header">';
		html += '<div class="command-name">' + esc(cmd.name);
		if (cmd.commandType === 'composite') {
			html += ' <span class="badge badge-composite">composite</span>';
		} else {
			html += ' <span class="badge badge-script">script</span>';
		}
		html += '</div>';

		if (cmd.description) {
			html += '<div class="command-description">' + esc(cmd.description) + '</div>';
		}

		html += '<div class="command-meta">';
		if (cmd.source) {
			const isLocal = cmd.source === 'local';
			const sourceClass = isLocal ? 'meta-chip-local' : 'meta-chip-inherited';
			const sourceLabel = isLocal ? 'local' : 'inherited from ' + esc(cmd.source);
			if (!isLocal && cmd.sourcePath) {
				const sourceUrl = vscodeFileUrl(cmd.sourcePath);
				html += '<a class="meta-chip ' + sourceClass + ' meta-chip-link" href="' + esc(sourceUrl) + '" title="Open source directory in VS Code">' + sourceLabel + '</a>';
			} else {
				html += '<div class="meta-chip ' + sourceClass + '">' + sourceLabel + '</div>';
			}
		}
		if (cmd.script) {
			const scriptUrl = vscodeFileUrl(cmd.scriptPath);
			if (scriptUrl) {
				html += '<a class="meta-chip meta-chip-link" href="' + esc(scriptUrl) + '" title="Open in VS Code">' + fileSvg() + esc(cmd.script) + '</a>';
			} else {
				html += '<div class="meta-chip">' + fileSvg() + esc(cmd.script) + '</div>';
			}
		}
		if (cmd.language) {
			html += '<div class="meta-chip">' + esc(cmd.language) + '</div>';
		}
		html += '</div></div>';

		const status = metaStatus[cmd.name];
		if (cmd.commandType === 'script' && status && status !== 'ready') {
			html += '<div class="section"><div class="meta-loading">'
				+ '<div class="loading-spinner" style="width:16px;height:16px;border-width:2px"></div>'
				+ '<span>Loading argument metadata...</span></div></div>';
		}

		if (cmd.commandType === 'script') {
			html += this.renderUsage(cmd);
		}

		if (cmd.positionals && cmd.positionals.length > 0) {
			html += '<div class="section"><div class="section-title">Arguments</div>';
			html += this.renderArgTable(cmd.positionals, true);
			html += '</div>';
		}

		if (cmd.flags && cmd.flags.length > 0) {
			html += '<div class="section"><div class="section-title">Flags &amp; Options</div>';
			html += this.renderArgTable(cmd.flags, false);
			html += '</div>';
		}

		if (cmd.steps && cmd.steps.length > 0) {
			html += '<div class="section"><div class="section-title">Run Steps</div>';
			html += this.renderSteps(cmd.steps);
			html += '</div>';
		}

		if (cmd.example) {
			html += '<div class="section"><div class="section-title">Example</div>';
			html += '<div class="example-content">' + renderMarkdown(cmd.example) + '</div>';
			html += '</div>';
		}

		// Runner (web component).
		if (cmd.commandType === 'script' || cmd.commandType === 'composite') {
			html += '<forge-runner></forge-runner>';
		}

		html += '</div>';
		this.innerHTML = html;

		// Bind step command clicks.
		this.querySelectorAll('.step-name, .parallel-entry').forEach(el => {
			el.addEventListener('click', (e) => {
				this.dispatchEvent(new CustomEvent('command-select', {
					detail: { name: e.currentTarget.dataset.cmd },
					bubbles: true
				}));
			});
		});

		// Initialize the runner component.
		const runner = this.querySelector('forge-runner');
		if (runner) runner.render(cmd);
	}

	/**
	 * Render the usage synopsis for a script command.
	 * @param {DocCommand} cmd
	 * @returns {string} HTML string.
	 */
	renderUsage(cmd) {
		let usage = '<span class="usage-prefix">$</span> forge ' + esc(cmd.name);

		if (cmd.positionals) {
			cmd.positionals.forEach(p => {
				if (p.required) {
					usage += ' <span class="usage-required">&lt;' + esc(p.name) + '&gt;</span>';
				} else {
					usage += ' <span class="usage-optional">[' + esc(p.name) + ']</span>';
				}
			});
		}

		if (cmd.flags && cmd.flags.length > 0) {
			usage += ' <span class="usage-optional">[flags]</span>';
		}

		return '<div class="section"><div class="section-title">Usage</div>'
			+ '<div class="usage-box">' + usage + '</div></div>';
	}

	/**
	 * Render a table of arguments or flags.
	 * @param {DocArg[]} args - Argument definitions.
	 * @param {boolean} isPositional - Whether these are positional args (vs flags).
	 * @returns {string} HTML table string.
	 */
	renderArgTable(args, isPositional) {
		let html = '<table class="arg-table"><thead><tr>'
			+ '<th>Name</th><th>Type</th><th>Description</th>'
			+ (isPositional ? '<th>Required</th>' : '<th>Default</th>')
			+ '</tr></thead><tbody>';

		args.forEach(a => {
			const typeClass = a.type === 'bool' ? 'type-bool' : 'type-string';
			html += '<tr>';
			html += '<td><span class="arg-name">' + (isPositional ? '' : '--') + esc(a.name) + '</span></td>';
			html += '<td><span class="arg-type ' + typeClass + '">' + esc(a.type || 'string') + '</span></td>';
			html += '<td>' + esc(a.description || '') + '</td>';
			if (isPositional) {
				html += '<td>' + (a.required ? '<span class="arg-required">required</span>' : '') + '</td>';
			} else {
				html += '<td><span class="arg-default">' + esc(a.defaultValue || '') + '</span></td>';
			}
			html += '</tr>';
		});

		html += '</tbody></table>';
		return html;
	}

	/**
	 * Render the run steps list for a composite command.
	 * @param {DocStep[]} steps
	 * @returns {string} HTML string.
	 */
	renderSteps(steps) {
		let html = '<div class="steps-list">';

		steps.forEach((step, i) => {
			html += '<div class="step">';
			html += '<span class="step-index">' + (i + 1) + '</span>';
			html += '<span class="step-arrow">→</span>';

			if (step.parallel && step.parallel.length > 0) {
				html += '<span class="step-parallel-badge">parallel</span>';
				html += '<div class="parallel-entries">';
				step.parallel.forEach((entry, j) => {
					if (j > 0) html += '<span class="parallel-separator">·</span>';
					const parts = entry.split(' ');
					html += '<span class="parallel-entry" data-cmd="' + esc(parts[0]) + '">' + esc(parts[0]) + '</span>';
					if (parts.length > 1) {
						html += '<span class="step-args">' + esc(parts.slice(1).join(' ')) + '</span>';
					}
				});
				html += '</div>';
			} else {
				html += '<span class="step-name" data-cmd="' + esc(step.command) + '">' + esc(step.command) + '</span>';
				if (step.args && step.args.length > 0) {
					html += '<span class="step-args">' + esc(step.args.join(' ')) + '</span>';
				}
			}

			html += '</div>';
		});

		html += '</div>';
		return html;
	}
}

customElements.define('forge-command', ForgeCommand);
