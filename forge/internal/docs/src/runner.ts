import './utils';

type AnsiState = {
	bold: boolean;
	dim: boolean;
	italic: boolean;
	underline: boolean;
	fg: string | null;
	bg: string | null;
};

type ParsedLine = {
	html: string;
};

type AnsiParseResult = {
	lines: ParsedLine[];
	trailing: string;
};

const ANSI_COLORS: Record<string, string> = {
	'30': '#555', '31': '#f85149', '32': '#56d364', '33': '#d29922',
	'34': '#58a6ff', '35': '#bc8cff', '36': '#39d2c0', '37': '#cccccc',
	'90': '#6e7681', '91': '#ff7b72', '92': '#7ee787', '93': '#e3b341',
	'94': '#79c0ff', '95': '#d2a8ff', '96': '#56d4dd', '97': '#ffffff'
};

const ANSI_BG_COLORS: Record<string, string> = {
	'40': '#555', '41': '#f85149', '42': '#56d364', '43': '#d29922',
	'44': '#58a6ff', '45': '#bc8cff', '46': '#39d2c0', '47': '#cccccc',
	'100': '#6e7681', '101': '#ff7b72', '102': '#7ee787', '103': '#e3b341',
	'104': '#79c0ff', '105': '#d2a8ff', '106': '#56d4dd', '107': '#ffffff'
};

function parseAnsiChunk(text: string, state: AnsiState): AnsiParseResult {
	const lines: ParsedLine[] = [];
	let result = '';
	let spanOpen = false;
	let { bold, dim, italic, underline, fg, bg } = state;

	const buildSpan = (): void => {
		if (spanOpen) {
			result += '</span>';
		}

		const styles: string[] = [];
		if (fg) {
			styles.push('color:' + fg);
		}
		if (bg) {
			styles.push('background:' + bg);
		}
		if (bold) {
			styles.push('font-weight:bold');
		}
		if (dim) {
			styles.push('opacity:0.6');
		}
		if (italic) {
			styles.push('font-style:italic');
		}
		if (underline) {
			styles.push('text-decoration:underline');
		}

		if (styles.length > 0) {
			result += '<span style="' + styles.join(';') + '">';
			spanOpen = true;
		} else {
			spanOpen = false;
		}
	};

	let index = 0;
	while (index < text.length) {
		if (text[index] === '\n') {
			if (spanOpen) {
				result += '</span>';
			}
			lines.push({ html: result });
			result = '';
			spanOpen = false;
			if (fg || bg || bold || dim || italic || underline) {
				buildSpan();
			}
			index++;
			continue;
		}

		if (text[index] === '\r') {
			index++;
			continue;
		}

		if (text[index] === '\x1b' && text[index + 1] === '[') {
			const end = text.indexOf('m', index + 2);
			if (end === -1) {
				index++;
				continue;
			}

			const seq = text.substring(index + 2, end);
			const codes = seq.split(';');
			for (const code of codes) {
				const value = code.trim();
				if (value === '0' || value === '') {
					bold = false;
					dim = false;
					italic = false;
					underline = false;
					fg = null;
					bg = null;
				} else if (value === '1') {
					bold = true;
				} else if (value === '2') {
					dim = true;
				} else if (value === '3') {
					italic = true;
				} else if (value === '4') {
					underline = true;
				} else if (value === '22') {
					bold = false;
					dim = false;
				} else if (value === '23') {
					italic = false;
				} else if (value === '24') {
					underline = false;
				} else if (value === '39') {
					fg = null;
				} else if (value === '49') {
					bg = null;
				} else if (ANSI_COLORS[value]) {
					fg = ANSI_COLORS[value];
				} else if (ANSI_BG_COLORS[value]) {
					bg = ANSI_BG_COLORS[value];
				}
			}

			buildSpan();
			index = end + 1;
			continue;
		}

		if (text[index] === '<') {
			result += '&lt;';
		} else if (text[index] === '>') {
			result += '&gt;';
		} else if (text[index] === '&') {
			result += '&amp;';
		} else {
			result += text[index];
		}

		index++;
	}

	if (spanOpen) {
		result += '</span>';
	}

	state.bold = bold;
	state.dim = dim;
	state.italic = italic;
	state.underline = underline;
	state.fg = fg;
	state.bg = bg;

	return { lines, trailing: result };
}

class ForgeTerminal extends HTMLElement {
	public static readonly LINE_HEIGHT = 20.8;
	public static readonly OVERSCAN = 10;

	protected lines: ParsedLine[] = [];
	protected ansiState: AnsiState = { bold: false, dim: false, italic: false, underline: false, fg: null, bg: null };
	public rawBuffer = '';
	protected scrollLocked = true;
	protected rafPending = false;
	protected lastRenderedRange: { start: number; end: number; total: number } | null = null;
	protected lineHeight = 0;

	protected spacer!: HTMLDivElement;
	protected viewport!: HTMLDivElement;
	protected trailingChunk = '';
	protected boundOnScroll: (() => void) | null = null;

	public connectedCallback(): void {
		this.className = 'runner-terminal-output';
		this.id = 'runner-output';

		this.spacer = document.createElement('div');
		this.spacer.style.cssText = 'position:relative;overflow:hidden;height:0';

		this.viewport = document.createElement('div');
		this.viewport.className = 'runner-terminal-viewport';
		this.viewport.style.cssText = 'position:absolute;top:0;left:0;right:0';

		this.spacer.appendChild(this.viewport);
		this.appendChild(this.spacer);

		this.boundOnScroll = this.handleScroll.bind(this);
		this.addEventListener('scroll', this.boundOnScroll);
	}

	public disconnectedCallback(): void {
		if (this.boundOnScroll) {
			this.removeEventListener('scroll', this.boundOnScroll);
		}
	}

	public clear(): void {
		this.lines = [];
		this.ansiState = { bold: false, dim: false, italic: false, underline: false, fg: null, bg: null };
		this.rawBuffer = '';
		this.scrollLocked = true;
		this.rafPending = false;
		this.lastRenderedRange = null;
		this.trailingChunk = '';
		this.spacer.style.height = '0';
		this.viewport.innerHTML = '';
		this.viewport.style.transform = 'translateY(0)';
	}

	public appendChunk(text: string): void {
		this.rawBuffer += text;

		const chunk = (this.trailingChunk || '') + text;
		const parsed = parseAnsiChunk(chunk, this.ansiState);

		if (this.trailingChunk) {
			this.lines.pop();
		}

		this.lines.push(...parsed.lines);
		this.trailingChunk = parsed.trailing;
		if (this.trailingChunk) {
			this.lines.push({ html: this.trailingChunk });
		}

		this.scheduleRender();
	}

	public appendError(text: string): void {
		this.rawBuffer = text;
		const parsed = parseAnsiChunk(text, this.ansiState);
		this.lines.push(...parsed.lines);
		if (parsed.trailing) {
			this.lines.push({ html: parsed.trailing });
		}
		this.scheduleRender();
	}

	public trimExitMarker(): void {
		while (this.lines.length > 0) {
			const last = this.lines[this.lines.length - 1];
			if (last.html === '' || last.html === '&nbsp;' || last.html.includes('exit:')) {
				this.lines.pop();
			} else {
				break;
			}
		}

		this.scheduleRender();
	}

	protected scheduleRender(): void {
		if (this.rafPending) {
			return;
		}

		this.rafPending = true;
		requestAnimationFrame(() => {
			this.rafPending = false;
			this.renderVirtual();
		});
	}

	protected renderVirtual(): void {
		if (!this.lineHeight) {
			const measure = document.createElement('div');
			measure.textContent = 'X';
			this.viewport.appendChild(measure);
			this.lineHeight = measure.getBoundingClientRect().height || ForgeTerminal.LINE_HEIGHT;
			measure.remove();
		}

		const lineHeight = this.lineHeight;
		const totalLines = this.lines.length;
		const totalHeight = Math.ceil(totalLines * lineHeight) + 12 + Math.ceil(lineHeight * 3);
		const viewportHeight = this.clientHeight;

		this.spacer.style.height = totalHeight + 'px';

		if (this.scrollLocked) {
			this.scrollTop = totalHeight;
		}

		const scrollTop = this.scrollTop;
		const firstVisible = Math.floor(scrollTop / lineHeight);
		const visibleCount = Math.ceil(viewportHeight / lineHeight);
		const start = Math.max(0, firstVisible - ForgeTerminal.OVERSCAN);
		const end = Math.min(totalLines, firstVisible + visibleCount + ForgeTerminal.OVERSCAN);

		if (this.lastRenderedRange
			&& this.lastRenderedRange.start === start
			&& this.lastRenderedRange.end === end
			&& this.lastRenderedRange.total === totalLines) {
			return;
		}

		this.lastRenderedRange = { start, end, total: totalLines };

		const offsetY = Math.round(start * lineHeight) + 12;
		this.viewport.style.transform = 'translateY(' + offsetY + 'px)';

		let html = '';
		for (let index = start; index < end; index++) {
			html += '<div>' + (this.lines[index].html || '&nbsp;') + '</div>';
		}
		this.viewport.innerHTML = html;

		if (this.scrollLocked) {
			this.scrollTop = this.scrollHeight;
		}
	}

	public scrollToBottom(): void {
		this.scrollLocked = true;
		this.lastRenderedRange = null;
		this.scrollTop = this.scrollHeight;
		this.scheduleRender();
	}

	protected handleScroll(): void {
		const lineHeight = this.lineHeight || ForgeTerminal.LINE_HEIGHT;
		const atBottom = this.scrollTop + this.clientHeight >= this.scrollHeight - lineHeight * 2;
		this.scrollLocked = atBottom;
		if (!this.rafPending) {
			this.scheduleRender();
		}
	}
}

class ForgeRunner extends HTMLElement {
	protected cmd: DocCommand | null = null;
	protected abort: AbortController | null = null;
	protected running = false;

	public connectedCallback(): void {
		this.setupBindings();
	}

	public render(cmd: DocCommand): void {
		this.cmd = cmd;

		let html = '<div class="section runner-section"><div class="section-title">Run</div>';
		html += '<div class="runner-form" id="runner-form">';

		if (cmd.positionals && cmd.positionals.length > 0) {
			cmd.positionals.forEach(position => {
				html += '<div class="runner-field">';
				html += '<label>' + esc(position.name);
				if (position.required) {
					html += '<span class="runner-field-meta" style="color:var(--red)"> required</span>';
				}
				html += '</label>';
				html += '<input type="text" class="runner-input" data-arg-name="' + esc(position.name)
					+ '" data-arg-positional="true" placeholder="' + esc(position.description || position.name) + '"'
					+ (position.defaultValue ? ' value="' + esc(position.defaultValue) + '"' : '') + '>';
				html += '</div>';
			});
		}

		if (cmd.flags && cmd.flags.length > 0) {
			cmd.flags.forEach(flag => {
				html += '<div class="runner-field">';
				html += '<label>--' + esc(flag.name) + '</label>';
				if (flag.type === 'bool') {
					html += '<label class="runner-checkbox-wrap">'
						+ '<input type="checkbox" class="runner-checkbox" data-arg-name="' + esc(flag.name)
						+ '" data-arg-flag="true" data-arg-type="bool"'
						+ (flag.defaultValue === 'true' ? ' checked' : '') + '>'
						+ '<span style="font-family:var(--font-sans);font-size:13px;color:var(--text-muted)">'
						+ esc(flag.description || '') + '</span></label>';
				} else {
					html += '<input type="text" class="runner-input" data-arg-name="' + esc(flag.name)
						+ '" data-arg-flag="true" data-arg-type="string" placeholder="'
						+ esc(flag.description || flag.name) + '"'
						+ (flag.defaultValue ? ' value="' + esc(flag.defaultValue) + '"' : '') + '>';
				}
				html += '</div>';
			});
		}

		if ((!cmd.positionals || cmd.positionals.length === 0) && (!cmd.flags || cmd.flags.length === 0)) {
			html += '<div class="runner-field">';
			html += '<label>args</label>';
			html += '<input type="text" class="runner-input" id="runner-freeform" placeholder="Optional arguments...">';
			html += '</div>';
		}

		html += '<div class="runner-actions">';
		html += '<button class="runner-btn runner-btn-run" id="runner-run">' + playSvg() + 'Run</button>';
		html += '<button class="runner-btn runner-btn-stop" id="runner-stop" disabled>' + stopSvg() + 'Stop</button>';
		html += '<button class="runner-btn runner-btn-clear" id="runner-clear">Clear</button>';
		html += '</div>';
		html += '</div>';

		html += '<div class="runner-terminal" id="runner-terminal" style="display:none">';
		html += '<div class="runner-terminal-header"><span>Output</span>'
			+ '<div class="runner-terminal-status"><span class="runner-terminal-dot" id="runner-dot"></span>'
			+ '<span id="runner-status-text"></span></div></div>';
		html += '<forge-terminal></forge-terminal>';
		html += '</div>';

		html += '</div>';
		this.innerHTML = html;
		this.setupBindings();
	}

	protected setupBindings(): void {
		const runButton = this.querySelector('#runner-run') as HTMLButtonElement | null;
		const stopButton = this.querySelector('#runner-stop') as HTMLButtonElement | null;
		const clearButton = this.querySelector('#runner-clear') as HTMLButtonElement | null;
		if (!runButton || !stopButton || !clearButton) {
			return;
		}

		runButton.addEventListener('click', () => {
			void this.startRun();
		});
		stopButton.addEventListener('click', () => this.stopRun());
		clearButton.addEventListener('click', () => this.handleClear());

		const form = this.querySelector('#runner-form');
		if (form) {
			form.querySelectorAll('input.runner-input').forEach(element => {
				element.addEventListener('keydown', event => {
					if ((event as KeyboardEvent).key === 'Enter') {
						void this.startRun();
					}
				});
			});
		}
	}

	protected get terminal(): ForgeTerminal | null {
		return this.querySelector('forge-terminal');
	}

	protected collectArgs(): string[] {
		const args: string[] = [];
		const form = this.querySelector('#runner-form');
		if (!form) {
			return args;
		}

		const freeform = this.querySelector('#runner-freeform') as HTMLInputElement | null;
		if (freeform && freeform.value.trim()) {
			return freeform.value.trim().split(/\s+/);
		}

		form.querySelectorAll('[data-arg-positional]').forEach(element => {
			const input = element as HTMLInputElement;
			if (input.value.trim()) {
				args.push(input.value.trim());
			}
		});

		form.querySelectorAll('[data-arg-flag]').forEach(element => {
			const input = element as HTMLInputElement;
			const name = input.dataset.argName || '';
			if (input.dataset.argType === 'bool') {
				if (input.checked) {
					args.push('--' + name);
				}
			} else if (input.value.trim()) {
				args.push('--' + name, input.value.trim());
			}
		});

		return args;
	}

	protected async startRun(): Promise<void> {
		if (this.running || !this.cmd) {
			return;
		}

		const args = this.collectArgs();
		const terminalWrap = this.querySelector('#runner-terminal') as HTMLElement | null;
		const term = this.terminal;
		const dot = this.querySelector('#runner-dot') as HTMLElement | null;
		const statusText = this.querySelector('#runner-status-text') as HTMLElement | null;
		const runButton = this.querySelector('#runner-run') as HTMLButtonElement | null;
		const stopButton = this.querySelector('#runner-stop') as HTMLButtonElement | null;

		if (!terminalWrap || !term || !dot || !statusText || !runButton || !stopButton) {
			return;
		}

		terminalWrap.style.display = 'block';
		term.clear();
		dot.className = 'runner-terminal-dot running';
		statusText.textContent = 'Running...';
		runButton.disabled = true;
		stopButton.disabled = false;
		this.running = true;

		requestAnimationFrame(() => {
			const main = document.getElementById('main-content');
			if (main) {
				main.scrollTo({ top: main.scrollHeight, behavior: 'smooth' });
			}
		});

		try {
			const controller = new AbortController();
			this.abort = controller;

			const response = await fetch('/api/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ command: this.cmd.name, args }),
				signal: controller.signal
			});

			if (!response.ok) {
				const errText = await response.text();
				term.appendError(errText);
				dot.className = 'runner-terminal-dot exited-err';
				statusText.textContent = 'Error';
				return;
			}

			const body = response.body;
			if (!body) {
				term.appendError('No output stream available.');
				dot.className = 'runner-terminal-dot exited-err';
				statusText.textContent = 'Error';
				return;
			}

			const reader = body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const chunk = await reader.read();
				if (chunk.done) {
					break;
				}
				const text = decoder.decode(chunk.value, { stream: true });
				term.appendChunk(text);
			}

			const rawLines = term.rawBuffer.trimEnd().split('\n');
			const lastLine = rawLines[rawLines.length - 1] || '';
			const exitMatch = lastLine.match(/\x1b\[exit:(\d+)\]/);

			if (exitMatch) {
				term.trimExitMarker();
				const code = parseInt(exitMatch[1], 10);
				dot.className = code === 0 ? 'runner-terminal-dot exited-ok' : 'runner-terminal-dot exited-err';
				statusText.textContent = code === 0 ? 'Completed' : 'Exit code ' + code;
			} else {
				dot.className = 'runner-terminal-dot exited-ok';
				statusText.textContent = 'Completed';
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				dot.className = 'runner-terminal-dot exited-err';
				statusText.textContent = 'Stopped';
			} else {
				const message = error instanceof Error ? error.message : String(error);
				term.appendChunk('\nError: ' + message);
				dot.className = 'runner-terminal-dot exited-err';
				statusText.textContent = 'Error';
			}
		} finally {
			this.running = false;
			this.abort = null;
			runButton.disabled = false;
			stopButton.disabled = true;
			term.scrollToBottom();
		}
	}

	protected stopRun(): void {
		if (this.abort) {
			this.abort.abort();
		}

		fetch('/api/run/kill', { method: 'POST' }).catch(() => {});
	}

	protected handleClear(): void {
		const term = this.terminal;
		const terminalWrap = this.querySelector('#runner-terminal') as HTMLElement | null;
		if (term) {
			term.clear();
		}
		if (terminalWrap) {
			terminalWrap.style.display = 'none';
		}
	}
}

customElements.define('forge-terminal', ForgeTerminal);
customElements.define('forge-runner', ForgeRunner);
