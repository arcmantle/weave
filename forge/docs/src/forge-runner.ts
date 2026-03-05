import './forge-terminal';

import { html, LitElement, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';

import { forgeRunnerStyles } from './forge-runner-styles';
import type { ForgeTerminal } from './forge-terminal';
import type { DocCommand } from './types';
import { playSvg, stopSvg } from './utils';

class ForgeRunner extends LitElement {

	protected cmd:   DocCommand | null = null;
	protected abort: AbortController | null = null;
	protected running = false;
	protected showTerminal = false;
	protected terminalDotClass = 'runner-terminal-dot';
	protected terminalStatusText = '';
	protected activeRunId = 0;

	setCommand(cmd: DocCommand): void {
		const commandChanged = this.cmd?.name !== cmd.name;
		this.cmd = cmd;
		if (commandChanged)
			this.resetForCommandChange();

		this.requestUpdate();
	}

	protected resetForCommandChange(): void {
		if (this.abort)
			this.stopRun();

		this.activeRunId++;
		this.running = false;
		this.abort = null;
		this.showTerminal = false;
		this.terminalDotClass = 'runner-terminal-dot';
		this.terminalStatusText = '';

		const term = this.terminal;
		if (term)
			term.clear();
	}

	protected override render(): TemplateResult {
		if (!this.cmd)
			return html``;

		return this.runnerTemplate(this.cmd);
	}

	protected runnerTemplate(cmd: DocCommand): TemplateResult {
		const hasPositionals = !!cmd.positionals && cmd.positionals.length > 0;
		const hasFlags = !!cmd.flags && cmd.flags.length > 0;

		return html`
			<div class="section runner-section">
				<div class="section-title">Run</div>
				<div class="runner-form" id="runner-form">
					${ repeat(cmd.positionals || [], position => position.name, position => html`
						<div class="runner-field">
							<label>
								${ position.name }
								${ when(
									!!position.required,
									() => html`<span class="runner-field-meta" style="color:var(--red)"> required</span>`,
									() => null,
								) }
							</label>
							<input
								type="text"
								class="runner-input"
								data-arg-name=${ position.name }
								data-arg-positional="true"
								placeholder=${ position.description || position.name }
								.value=${ position.defaultValue || '' }
								@keydown=${ this.handleInputKeydown }
							>
						</div>
					`) }

					${ repeat(cmd.flags || [], flag => flag.name, flag => html`
						<div class="runner-field">
							<label>--${ flag.name }</label>
							${ when(
								flag.type === 'bool',
								() => html`
									<label class="runner-checkbox-wrap">
										<input
											type="checkbox"
											class="runner-checkbox"
											data-arg-name=${ flag.name }
											data-arg-flag="true"
											data-arg-type="bool"
											?checked=${ flag.defaultValue === 'true' }
										>
										<span style="font-family:var(--font-sans);font-size:13px;color:var(--text-muted)">
											${ flag.description || '' }
										</span>
									</label>
								`,
								() => html`
									<input
										type="text"
										class="runner-input"
										data-arg-name=${ flag.name }
										data-arg-flag="true"
										data-arg-type="string"
										placeholder=${ flag.description || flag.name }
										.value=${ flag.defaultValue || '' }
										@keydown=${ this.handleInputKeydown }
									>
								`,
							) }
						</div>
					`) }

					${ when(
						!hasPositionals && !hasFlags,
						() => html`
							<div class="runner-field">
								<label>args</label>
								<input
									type="text"
									class="runner-input"
									id="runner-freeform"
									placeholder="Optional arguments..."
									@keydown=${ this.handleInputKeydown }
								>
							</div>
						`,
						() => null,
					) }

					<div class="runner-actions">
						<button
							class="runner-btn runner-btn-run"
							id="runner-run"
							@click=${ this.handleRunClick }
							?disabled=${ this.running }
						>
							${ unsafeHTML(playSvg()) }Run
						</button>
						<button
							class="runner-btn runner-btn-stop"
							id="runner-stop"
							@click=${ this.handleStopClick }
							?disabled=${ !this.running }
						>
							${ unsafeHTML(stopSvg()) }Stop
						</button>
						<button
							class="runner-btn runner-btn-clear"
							id="runner-clear"
							@click=${ this.handleClearClick }
						>
							Clear
						</button>
					</div>
				</div>

				<div class="runner-terminal" id="runner-terminal" style=${ this.showTerminal ? '' : 'display:none' }>
					<div class="runner-terminal-header">
						<span>Output</span>
						<div class="runner-terminal-status">
							<span class=${ this.terminalDotClass } id="runner-dot"></span>
							<span id="runner-status-text">${ this.terminalStatusText }</span>
						</div>
					</div>
					<forge-terminal></forge-terminal>
				</div>
			</div>
		`;
	}

	protected handleRunClick(): void {
		void this.startRun();
	}

	protected handleStopClick(): void {
		this.stopRun();
	}

	protected handleClearClick(): void {
		this.handleClear();
	}

	protected handleInputKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter')
			void this.startRun();
	}

	protected get terminal(): ForgeTerminal | null {
		return this.renderRoot.querySelector('forge-terminal');
	}

	protected collectArgs(): string[] {
		const args: string[] = [];
		const form = this.renderRoot.querySelector('#runner-form');
		if (!form)
			return args;

		const freeform = this.renderRoot.querySelector('#runner-freeform') as HTMLInputElement | null;
		if (freeform && freeform.value.trim())
			return freeform.value.trim().split(/\s+/);

		form.querySelectorAll('[data-arg-positional]').forEach(element => {
			const input = element as HTMLInputElement;
			if (input.value.trim())
				args.push(input.value.trim());
		});

		form.querySelectorAll('[data-arg-flag]').forEach(element => {
			const input = element as HTMLInputElement;
			const name = input.dataset['argName'] || '';
			if (input.dataset['argType'] === 'bool') {
				if (input.checked)
					args.push('--' + name);
			}
			else if (input.value.trim()) {
				args.push('--' + name, input.value.trim());
			}
		});

		return args;
	}

	protected async startRun(): Promise<void> {
		if (this.running || !this.cmd)
			return;

		const runId = ++this.activeRunId;

		const args = this.collectArgs();
		const term = this.terminal;
		if (!term)
			return;

		this.showTerminal = true;
		term.clear();
		this.terminalDotClass = 'runner-terminal-dot running';
		this.terminalStatusText = 'Running...';
		this.running = true;
		this.requestUpdate();

		requestAnimationFrame(() => {
			const main = document.getElementById('main-content');
			if (main)
				main.scrollTo({ top: main.scrollHeight, behavior: 'smooth' });
		});

		try {
			const controller = new AbortController();
			this.abort = controller;

			const response = await fetch('/api/run', {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify({ command: this.cmd.name, args }),
				signal:  controller.signal,
			});

			if (!response.ok) {
				if (runId !== this.activeRunId)
					return;

				const errText = await response.text();
				term.appendError(errText);
				this.terminalDotClass = 'runner-terminal-dot exited-err';
				this.terminalStatusText = 'Error';
				this.requestUpdate();

				return;
			}

			const body = response.body;
			if (!body) {
				if (runId !== this.activeRunId)
					return;

				term.appendError('No output stream available.');
				this.terminalDotClass = 'runner-terminal-dot exited-err';
				this.terminalStatusText = 'Error';
				this.requestUpdate();

				return;
			}

			const reader = body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const chunk = await reader.read();
				if (chunk.done)
					break;

				if (runId !== this.activeRunId) {
					void reader.cancel();

					return;
				}

				const text = decoder.decode(chunk.value, { stream: true });
				term.appendChunk(text);
			}

			if (runId !== this.activeRunId)
				return;

			const rawLines = term.rawBuffer.trimEnd().split('\n');
			const lastLine = rawLines[rawLines.length - 1] || '';
			const escChar = String.fromCharCode(27);
			const markerPrefix = escChar + '[exit:';
			const markerStart = lastLine.indexOf(markerPrefix);
			const markerEnd = markerStart >= 0 ? lastLine.indexOf(']', markerStart) : -1;
			const codeSlice = markerStart >= 0 && markerEnd > markerStart
				? lastLine.slice(markerStart + markerPrefix.length, markerEnd)
				: '';
			const exitCode = /^\d+$/.test(codeSlice) ? parseInt(codeSlice, 10) : null;

			if (exitCode !== null) {
				term.trimExitMarker();
				const code = exitCode;
				this.terminalDotClass = code === 0 ? 'runner-terminal-dot exited-ok' : 'runner-terminal-dot exited-err';
				this.terminalStatusText = code === 0 ? 'Completed' : 'Exit code ' + code;
			}
			else {
				this.terminalDotClass = 'runner-terminal-dot exited-ok';
				this.terminalStatusText = 'Completed';
			}

			this.requestUpdate();
		}
		catch (error) {
			if (runId !== this.activeRunId)
				return;

			if (error instanceof DOMException && error.name === 'AbortError') {
				this.terminalDotClass = 'runner-terminal-dot exited-err';
				this.terminalStatusText = 'Stopped';
			}
			else {
				const message = error instanceof Error ? error.message : String(error);
				term.appendChunk('\nError: ' + message);
				this.terminalDotClass = 'runner-terminal-dot exited-err';
				this.terminalStatusText = 'Error';
			}

			this.requestUpdate();
		}
		finally {
			if (runId === this.activeRunId) {
				this.running = false;
				this.abort = null;
				this.requestUpdate();
			}
		}
	}

	protected stopRun(): void {
		if (this.abort)
			this.abort.abort();

		fetch('/api/run/kill', { method: 'POST' }).catch(() => {});
	}

	protected handleClear(): void {
		const term = this.terminal;
		if (term)
			term.clear();

		this.showTerminal = false;
		this.terminalDotClass = 'runner-terminal-dot';
		this.terminalStatusText = '';
		this.requestUpdate();
	}

	static override styles = [ forgeRunnerStyles ];

}

customElements.define('forge-runner', ForgeRunner);
