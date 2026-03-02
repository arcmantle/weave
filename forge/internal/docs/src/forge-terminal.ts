import { css, html, LitElement, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { AnsiRenderer, type ParsedLine } from './ansi-renderer';

export class ForgeTerminal extends LitElement {

	static readonly LINE_HEIGHT = 20.8;
	static readonly OVERSCAN = 10;
	static readonly BOTTOM_SCROLL_BUFFER_LINES = 2;

	protected lines:             ParsedLine[] = [];
	protected ansiRenderer = new AnsiRenderer();
	rawBuffer = '';
	protected scrollLocked = false;
	protected rafPending = false;
	protected lastRenderedRange: { start: number; end: number; total: number; } | null = null;
	protected lineHeight = ForgeTerminal.LINE_HEIGHT;

	protected boundOnScroll: (() => void) | null = null;
	protected totalHeight = 0;
	protected offsetY = 0;
	protected visibleStart = 0;
	protected visibleLines:  ParsedLine[] = [];

	protected override render(): TemplateResult {
		return html`
			<div
				class="runner-terminal-spacer"
				style=${ 'position:relative;overflow:hidden;height:' + this.totalHeight + 'px' }
			>
				<div
					class="runner-terminal-viewport"
					style=${ 'position:absolute;top:0;left:0;right:0;transform:translateY(' + this.offsetY + 'px)' }
				>
					${ unsafeHTML(this.visibleLinesHtml()) }
				</div>
			</div>
		`;
	}

	protected visibleLinesHtml(): string {
		let out = '';
		for (const line of this.visibleLines)
			out += '<div class="runner-terminal-line">' + this.lineHtml(line) + '</div>';

		return out;
	}

	protected lineHtml(line: ParsedLine): string {
		if (!line.html)
			return '&nbsp;';

		return line.html;
	}

	override connectedCallback(): void {
		super.connectedCallback();

		this.boundOnScroll = this.handleScroll.bind(this);
		this.addEventListener('scroll', this.boundOnScroll);
		this.renderVirtual();
	}

	override disconnectedCallback(): void {
		if (this.boundOnScroll)
			this.removeEventListener('scroll', this.boundOnScroll);

		super.disconnectedCallback();
	}

	clear(): void {
		this.lines = [];
		this.ansiRenderer.reset();
		this.rawBuffer = '';
		this.scrollLocked = false;
		this.rafPending = false;
		this.lastRenderedRange = null;
		this.totalHeight = 0;
		this.offsetY = 0;
		this.visibleStart = 0;
		this.visibleLines = [];
		this.requestUpdate();
	}

	appendChunk(text: string): void {
		this.rawBuffer += text;
		const parsed = this.ansiRenderer.consume(text);

		if (parsed.hadPreviousTrailing)
			this.lines.pop();

		this.lines.push(...parsed.lines);
		if (parsed.trailingLine)
			this.lines.push(parsed.trailingLine);

		this.scheduleRender();
	}

	appendError(text: string): void {
		this.rawBuffer = text;
		const parsed = this.ansiRenderer.consume(text);
		if (parsed.hadPreviousTrailing)
			this.lines.pop();

		this.lines.push(...parsed.lines);
		if (parsed.trailingLine)
			this.lines.push(parsed.trailingLine);

		this.scheduleRender();
	}

	trimExitMarker(): void {
		while (this.lines.length > 0) {
			const last = this.lines[this.lines.length - 1];
			if (!last)
				break;

			if (last.html === '' || last.html === '&nbsp;' || last.html.includes('exit:'))
				this.lines.pop();
			else
				break;
		}

		this.scheduleRender();
	}

	protected scheduleRender(): void {
		if (this.rafPending)
			return;

		this.rafPending = true;
		requestAnimationFrame(() => {
			this.rafPending = false;
			this.renderVirtual();
		});
	}

	protected renderVirtual(): void {
		const lineHeight = this.lineHeight;
		const totalLines = this.lines.length;
		const scrollBuffer = Math.ceil(lineHeight * ForgeTerminal.BOTTOM_SCROLL_BUFFER_LINES);
		const totalHeight = Math.ceil(totalLines * lineHeight) + scrollBuffer;
		const viewportHeight = this.clientHeight;
		this.totalHeight = totalHeight;

		if (this.scrollLocked)
			this.scrollTop = totalHeight;

		const scrollTop = this.scrollTop;
		const firstVisible = Math.floor(scrollTop / lineHeight);
		const visibleCount = Math.ceil(viewportHeight / lineHeight);
		const start = Math.max(0, firstVisible - ForgeTerminal.OVERSCAN);
		const end = Math.min(totalLines, firstVisible + visibleCount + ForgeTerminal.OVERSCAN);

		if (this.lastRenderedRange
			&& this.lastRenderedRange.start === start
			&& this.lastRenderedRange.end === end
			&& this.lastRenderedRange.total === totalLines)
			return;

		this.lastRenderedRange = { start, end, total: totalLines };
		this.offsetY = Math.round(start * lineHeight);
		this.visibleStart = start;
		this.visibleLines = this.lines.slice(start, end);
		this.requestUpdate();

		if (this.scrollLocked)
			this.scrollTop = this.scrollHeight;
	}

	scrollToBottom(): void {
		this.scrollLocked = true;
		this.lastRenderedRange = null;
		this.scrollTop = this.scrollHeight;
		this.scheduleRender();
	}

	protected handleScroll(): void {
		const lineHeight = this.lineHeight || ForgeTerminal.LINE_HEIGHT;
		const atBottom = this.scrollTop + this.clientHeight >= this.scrollHeight - lineHeight * 2;
		this.scrollLocked = atBottom;
		if (!this.rafPending)
			this.scheduleRender();
	}

	static override styles = css`
		:host {
			font-family: var(--font-mono);
			font-size: 13px;
			line-height: 1.6;
			color: #cccccc;
			display: block;
			height: 400px;
			overflow: auto;
			tab-size: 4;
			position: relative;
		}

		.runner-terminal-viewport {
			padding: 0 16px;
		}

		.runner-terminal-line {
			white-space: pre-wrap;
			overflow-wrap: anywhere;
			word-break: break-word;
		}
	`;

}

customElements.define('forge-terminal', ForgeTerminal);
