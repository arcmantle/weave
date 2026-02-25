// ─── ANSI Color Maps ───

/** @type {Record<string, string>} Map of ANSI foreground color codes to hex values. */
const ANSI_COLORS = {
	'30': '#555', '31': '#f85149', '32': '#56d364', '33': '#d29922',
	'34': '#58a6ff', '35': '#bc8cff', '36': '#39d2c0', '37': '#cccccc',
	'90': '#6e7681', '91': '#ff7b72', '92': '#7ee787', '93': '#e3b341',
	'94': '#79c0ff', '95': '#d2a8ff', '96': '#56d4dd', '97': '#ffffff'
};
/** @type {Record<string, string>} Map of ANSI background color codes to hex values. */
const ANSI_BG_COLORS = {
	'40': '#555', '41': '#f85149', '42': '#56d364', '43': '#d29922',
	'44': '#58a6ff', '45': '#bc8cff', '46': '#39d2c0', '47': '#cccccc',
	'100': '#6e7681', '101': '#ff7b72', '102': '#7ee787', '103': '#e3b341',
	'104': '#79c0ff', '105': '#d2a8ff', '106': '#56d4dd', '107': '#ffffff'
};

/**
 * Parse raw ANSI text into lines, carrying style state across calls.
 * @param {string} text - Raw ANSI text chunk.
 * @param {AnsiState} state - Mutable state object carried between calls.
 * @returns {AnsiParseResult} Parsed lines and any trailing partial line.
 */
function parseAnsiChunk(text, state) {
	const lines = [];
	let result = '';
	let spanOpen = false;
	let { bold, dim, italic, underline, fg, bg } = state;

	function buildSpan() {
		if (spanOpen) result += '</span>';
		const styles = [];
		if (fg) styles.push('color:' + fg);
		if (bg) styles.push('background:' + bg);
		if (bold) styles.push('font-weight:bold');
		if (dim) styles.push('opacity:0.6');
		if (italic) styles.push('font-style:italic');
		if (underline) styles.push('text-decoration:underline');
		if (styles.length > 0) {
			result += '<span style="' + styles.join(';') + '">';
			spanOpen = true;
		} else {
			spanOpen = false;
		}
	}

	let i = 0;
	while (i < text.length) {
		if (text[i] === '\n') {
			if (spanOpen) result += '</span>';
			lines.push({ html: result });
			result = '';
			spanOpen = false;
			if (fg || bg || bold || dim || italic || underline) buildSpan();
			i++;
			continue;
		}

		if (text[i] === '\r') { i++; continue; }

		if (text[i] === '\x1b' && text[i + 1] === '[') {
			const end = text.indexOf('m', i + 2);
			if (end === -1) { i++; continue; }
			const seq = text.substring(i + 2, end);
			const codes = seq.split(';');
			for (const c of codes) {
				const n = c.trim();
				if (n === '0' || n === '') {
					bold = false; dim = false; italic = false; underline = false;
					fg = null; bg = null;
				} else if (n === '1') bold = true;
				else if (n === '2') dim = true;
				else if (n === '3') italic = true;
				else if (n === '4') underline = true;
				else if (n === '22') { bold = false; dim = false; }
				else if (n === '23') italic = false;
				else if (n === '24') underline = false;
				else if (n === '39') fg = null;
				else if (n === '49') bg = null;
				else if (ANSI_COLORS[n]) fg = ANSI_COLORS[n];
				else if (ANSI_BG_COLORS[n]) bg = ANSI_BG_COLORS[n];
			}
			buildSpan();
			i = end + 1;
			continue;
		}

		if (text[i] === '<') result += '&lt;';
		else if (text[i] === '>') result += '&gt;';
		else if (text[i] === '&') result += '&amp;';
		else result += text[i];
		i++;
	}

	if (spanOpen) result += '</span>';

	state.bold = bold;
	state.dim = dim;
	state.italic = italic;
	state.underline = underline;
	state.fg = fg;
	state.bg = bg;

	return { lines, trailing: result };
}

/**
 * Simple wrapper for one-off ANSI-to-HTML rendering.
 * @param {string} text - Raw ANSI text.
 * @returns {string} HTML string with ANSI styles applied.
 */
function ansiToHtml(text) {
	const state = { bold: false, dim: false, italic: false, underline: false, fg: null, bg: null };
	const parsed = parseAnsiChunk(text, state);
	const all = parsed.lines.map(l => l.html);
	if (parsed.trailing) all.push(parsed.trailing);
	return all.join('\n');
}


// ─── <forge-terminal> ───
/**
 * Virtual-scrolling terminal output. Renders only visible lines.
 * @extends HTMLElement
 */
class ForgeTerminal extends HTMLElement {

	static LINE_HEIGHT = 20.8; // 13px * 1.6
	static OVERSCAN = 10;

	/** @type {ParsedLine[]} */
	lines = [];
	/** @type {AnsiState} */
	ansiState = { bold: false, dim: false, italic: false, underline: false, fg: null, bg: null };
	/** @type {string} */
	rawBuffer = '';
	/** @type {boolean} */
	scrollLocked = true;
	/** @type {boolean} */
	rafPending = false;
	/** @type {{ start: number, end: number, total: number } | null} */
	lastRenderedRange = null;
	/** @type {number} */
	lineHeight = 0;

	/** @type {HTMLDivElement} */
	spacer;
	/** @type {HTMLDivElement} */
	viewport;
	/** @type {string} */
	trailingChunk;
	/** @type {() => void} */
	boundOnScroll;

	connectedCallback() {
		this.className = 'runner-terminal-output';
		this.id = 'runner-output';

		// Stable DOM: spacer is the containing block, viewport is clipped within it.
		// This ensures scrollHeight === spacer.height, stable during scrollbar drags.
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

	disconnectedCallback() {
		this.removeEventListener('scroll', this.boundOnScroll);
	}

	clear() {
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

	/**
	 * Append a raw chunk of ANSI text (called per streaming chunk).
	 * @param {string} text
	 */
	appendChunk(text) {
		this.rawBuffer += text;

		const chunk = (this.trailingChunk || '') + text;
		const parsed = parseAnsiChunk(chunk, this.ansiState);

		// Replace the last partial line with fully parsed lines.
		if (this.trailingChunk) this.lines.pop();
		this.lines.push(...parsed.lines);

		this.trailingChunk = parsed.trailing;
		if (this.trailingChunk) this.lines.push({ html: this.trailingChunk });

		this.scheduleRender();
	}

	/**
	 * Append pre-parsed error text.
	 * @param {string} text
	 */
	appendError(text) {
		this.rawBuffer = text;
		const parsed = parseAnsiChunk(text, this.ansiState);
		this.lines.push(...parsed.lines);
		if (parsed.trailing) this.lines.push({ html: parsed.trailing });
		this.scheduleRender();
	}

	/** Remove trailing exit-marker lines from the output. */
	trimExitMarker() {
		while (this.lines.length > 0) {
			const last = this.lines[this.lines.length - 1];
			if (last.html === '' || last.html === '&nbsp;' || last.html.includes('exit:')) {
				this.lines.pop();
			} else break;
		}
		this.scheduleRender();
	}

	scheduleRender() {
		if (this.rafPending) return;
		this.rafPending = true;
		requestAnimationFrame(() => {
			this.rafPending = false;
			this.renderVirtual();
		});
	}

	renderVirtual() {
		if (!this.lineHeight) {
			const measure = document.createElement('div');
			measure.textContent = 'X';
			this.viewport.appendChild(measure);
			this.lineHeight = measure.getBoundingClientRect().height || ForgeTerminal.LINE_HEIGHT;
			measure.remove();
		}
		const LH = this.lineHeight;
		const totalLines = this.lines.length;
		const totalHeight = Math.ceil(totalLines * LH) + 12 + Math.ceil(LH * 3); // 12px top + 3 line heights bottom
		const viewportHeight = this.clientHeight;

		// Update spacer height to match total content.
		this.spacer.style.height = totalHeight + 'px';

		if (this.scrollLocked) {
			this.scrollTop = totalHeight;
		}

		const scrollTop = this.scrollTop;
		const firstVisible = Math.floor(scrollTop / LH);
		const visibleCount = Math.ceil(viewportHeight / LH);
		const start = Math.max(0, firstVisible - ForgeTerminal.OVERSCAN);
		const end = Math.min(totalLines, firstVisible + visibleCount + ForgeTerminal.OVERSCAN);

		if (this.lastRenderedRange &&
			this.lastRenderedRange.start === start &&
			this.lastRenderedRange.end === end &&
			this.lastRenderedRange.total === totalLines) {
			return;
		}
		this.lastRenderedRange = { start, end, total: totalLines };

		// Position viewport with rounded pixels to avoid subpixel blurriness.
		const offsetY = Math.round(start * LH) + 12;
		this.viewport.style.transform = 'translateY(' + offsetY + 'px)';

		let html = '';
		for (let i = start; i < end; i++) {
			html += '<div>' + (this.lines[i].html || '&nbsp;') + '</div>';
		}
		this.viewport.innerHTML = html;

		if (this.scrollLocked) {
			this.scrollTop = this.scrollHeight;
		}
	}

	scrollToBottom() {
		this.scrollLocked = true;
		this.lastRenderedRange = null;
		this.scrollTop = this.scrollHeight;
		this.scheduleRender();
	}

	handleScroll() {
		const LH = this.lineHeight || ForgeTerminal.LINE_HEIGHT;
		const atBottom = this.scrollTop + this.clientHeight >= this.scrollHeight - LH * 2;
		this.scrollLocked = atBottom;
		if (!this.rafPending) this.scheduleRender();
	}
}

customElements.define('forge-terminal', ForgeTerminal);


// ─── <forge-runner> ───
/**
 * Command runner with form inputs, run/stop/clear buttons, and a virtual terminal.
 * @extends HTMLElement
 */
class ForgeRunner extends HTMLElement {

	/** @type {DocCommand | null} */
	cmd = null;
	/** @type {AbortController | null} */
	abort = null;
	/** @type {boolean} */
	running = false;

	connectedCallback() {
		this.setupBindings();
	}

	/**
	 * Render the runner form and terminal shell for a given command.
	 * @param {DocCommand} cmd
	 */
	render(cmd) {
		this.cmd = cmd;

		let html = '<div class="section runner-section"><div class="section-title">Run</div>';
		html += '<div class="runner-form" id="runner-form">';

		// Positional inputs.
		if (cmd.positionals && cmd.positionals.length > 0) {
			cmd.positionals.forEach(p => {
				html += '<div class="runner-field">';
				html += '<label>' + esc(p.name);
				if (p.required) html += '<span class="runner-field-meta" style="color:var(--red)"> required</span>';
				html += '</label>';
				html += '<input type="text" class="runner-input" data-arg-name="' + esc(p.name)
					+ '" data-arg-positional="true" placeholder="' + esc(p.description || p.name) + '"'
					+ (p.defaultValue ? ' value="' + esc(p.defaultValue) + '"' : '') + '>';
				html += '</div>';
			});
		}

		// Flag inputs.
		if (cmd.flags && cmd.flags.length > 0) {
			cmd.flags.forEach(f => {
				html += '<div class="runner-field">';
				html += '<label>--' + esc(f.name) + '</label>';
				if (f.type === 'bool') {
					html += '<label class="runner-checkbox-wrap">'
						+ '<input type="checkbox" class="runner-checkbox" data-arg-name="' + esc(f.name)
						+ '" data-arg-flag="true" data-arg-type="bool"'
						+ (f.defaultValue === 'true' ? ' checked' : '') + '>'
						+ '<span style="font-family:var(--font-sans);font-size:13px;color:var(--text-muted)">'
						+ esc(f.description || '') + '</span></label>';
				} else {
					html += '<input type="text" class="runner-input" data-arg-name="' + esc(f.name)
						+ '" data-arg-flag="true" data-arg-type="string" placeholder="'
						+ esc(f.description || f.name) + '"'
						+ (f.defaultValue ? ' value="' + esc(f.defaultValue) + '"' : '') + '>';
				}
				html += '</div>';
			});
		}

		// Freeform fallback.
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

		// Terminal output.
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

	setupBindings() {
		const runBtn = this.querySelector('#runner-run');
		const stopBtn = this.querySelector('#runner-stop');
		const clearBtn = this.querySelector('#runner-clear');
		if (!runBtn) return;

		runBtn.addEventListener('click', () => this.startRun());
		stopBtn.addEventListener('click', () => this.stopRun());
		clearBtn.addEventListener('click', () => this.handleClear());

		const form = this.querySelector('#runner-form');
		if (form) {
			form.querySelectorAll('input.runner-input').forEach(el => {
				el.addEventListener('keydown', (e) => {
					if (e.key === 'Enter') this.startRun();
				});
			});
		}
	}

	/** @returns {ForgeTerminal | null} */
	get terminal() {
		return this.querySelector('forge-terminal');
	}

	/**
	 * Collect arguments from the runner form inputs.
	 * @returns {string[]}
	 */
	collectArgs() {
		const args = [];
		const form = this.querySelector('#runner-form');
		if (!form) return args;

		const freeform = this.querySelector('#runner-freeform');
		if (freeform && freeform.value.trim()) {
			return freeform.value.trim().split(/\s+/);
		}

		form.querySelectorAll('[data-arg-positional]').forEach(el => {
			if (el.value.trim()) args.push(el.value.trim());
		});

		form.querySelectorAll('[data-arg-flag]').forEach(el => {
			const name = el.dataset.argName;
			if (el.dataset.argType === 'bool') {
				if (el.checked) args.push('--' + name);
			} else {
				if (el.value.trim()) args.push('--' + name, el.value.trim());
			}
		});

		return args;
	}

	async startRun() {
		if (this.running || !this.cmd) return;

		const args = this.collectArgs();
		const terminalWrap = this.querySelector('#runner-terminal');
		const term = this.terminal;
		const dot = this.querySelector('#runner-dot');
		const statusText = this.querySelector('#runner-status-text');
		const runBtn = this.querySelector('#runner-run');
		const stopBtn = this.querySelector('#runner-stop');

		terminalWrap.style.display = 'block';
		term.clear();
		dot.className = 'runner-terminal-dot running';
		statusText.textContent = 'Running...';
		runBtn.disabled = true;
		stopBtn.disabled = false;
		this.running = true;

		// Scroll the main content area down to show the terminal.
		requestAnimationFrame(() => {
			const main = document.getElementById('main-content');
			main.scrollTo({ top: main.scrollHeight, behavior: 'smooth' });
		});

		try {
			const controller = new AbortController();
			this.abort = controller;

			const res = await fetch('/api/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ command: this.cmd.name, args }),
				signal: controller.signal
			});

			if (!res.ok) {
				const errText = await res.text();
				term.appendError(errText);
				dot.className = 'runner-terminal-dot exited-err';
				statusText.textContent = 'Error';
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const text = decoder.decode(value, { stream: true });
				term.appendChunk(text);
			}

			// Check exit code from the last line.
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

		} catch (e) {
			if (e.name === 'AbortError') {
				dot.className = 'runner-terminal-dot exited-err';
				statusText.textContent = 'Stopped';
			} else {
				term.appendChunk('\nError: ' + e.message);
				dot.className = 'runner-terminal-dot exited-err';
				statusText.textContent = 'Error';
			}
		} finally {
			this.running = false;
			this.abort = null;
			runBtn.disabled = false;
			stopBtn.disabled = true;
			term.scrollToBottom();
		}
	}

	stopRun() {
		if (this.abort) this.abort.abort();
		fetch('/api/run/kill', { method: 'POST' }).catch(() => {});
	}

	handleClear() {
		const term = this.terminal;
		const terminalWrap = this.querySelector('#runner-terminal');
		if (term) term.clear();
		if (terminalWrap) terminalWrap.style.display = 'none';
	}
}

customElements.define('forge-runner', ForgeRunner);
