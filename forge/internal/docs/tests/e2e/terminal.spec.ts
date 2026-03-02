import { expect, type Page, test } from '@playwright/test';

const ESC = '\u001b';

interface TestDocData {
	projectName: string;
	version:     string;
	commands: {
		name:        string;
		description: string;
		commandType: 'script' | 'composite';
		source:      string;
		positionals: unknown[];
		flags:       unknown[];
	}[];
}

const DATA: TestDocData = {
	projectName: 'forge-playground',
	version:     'dev',
	commands:    [
		{
			name:        'alpha:run',
			description: 'alpha command',
			commandType: 'script',
			source:      'local',
			positionals: [],
			flags:       [],
		},
		{
			name:        'beta:run',
			description: 'beta command',
			commandType: 'script',
			source:      'local',
			positionals: [],
			flags:       [],
		},
		{
			name:        'overflow:run',
			description: 'overflow command',
			commandType: 'script',
			source:      'local',
			positionals: [],
			flags:       [],
		},
	],
};

function outputFor(commandName: string): string {
	if (commandName === 'alpha:run')
		return `alpha-first-line\n${ ESC }[32malpha-green-line${ ESC }[0m\n${ ESC }[exit:0]\n`;

	if (commandName === 'beta:run')
		return `beta-only-output\n${ ESC }[exit:0]\n`;

	const lines = Array.from({ length: 240 }, (_value, index) => `overflow-line-${ String(index).padStart(3, '0') }`).join('\n');

	return `${ lines }\n${ ESC }[exit:0]\n`;
}

async function setupApiRoutes(page: Page): Promise<void> {
	await page.route('**/api/ping', route => route.fulfill({ status: 204, body: '' }));
	await page.route('**/api/shutdown', route => route.fulfill({ status: 204, body: '' }));
	await page.route('**/api/run/kill', route => route.fulfill({ status: 204, body: '' }));
	await page.route('**/api/events', route => route.fulfill({
		status:  200,
		headers: { 'content-type': 'text/event-stream' },
		body:    'event: done\ndata: {}\n\n',
	}));
	await page.route('**/api/data', route => route.fulfill({
		status:  200,
		headers: { 'content-type': 'application/json' },
		body:    JSON.stringify(DATA),
	}));
	await page.route('**/api/run', async route => {
		const request = route.request();
		const body = request.postDataJSON() as { command?: string; };
		const commandName = body.command || '';
		await route.fulfill({
			status:  200,
			headers: { 'content-type': 'text/plain; charset=utf-8' },
			body:    outputFor(commandName),
		});
	});
}

async function selectCommand(page: Page, name: string): Promise<void> {
	await page.locator(`[data-cmd="${ name }"]`).click();
}

async function runCurrentCommand(page: Page): Promise<void> {
	await page.locator('forge-runner #runner-run').click();
	await expect(page.locator('forge-runner #runner-status-text')).toHaveText(/Completed|Exit code \d+/);
}

async function readTerminalText(page: Page): Promise<string> {
	return page.evaluate(() => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal');
		const viewport = terminal?.shadowRoot?.querySelector('.runner-terminal-viewport');

		return viewport?.textContent || '';
	});
}

async function waitForTerminalText(page: Page, text: string): Promise<void> {
	await page.waitForFunction(expected => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal');
		const viewport = terminal?.shadowRoot?.querySelector('.runner-terminal-viewport');
		const terminalText = viewport?.textContent || '';

		return terminalText.includes(expected);
	}, text);
}

test.beforeEach(async ({ page }) => {
	await setupApiRoutes(page);
	await page.goto('/');
	await expect(page.locator('[data-cmd="alpha:run"]')).toBeVisible();
});

test('renders terminal output without leaking template source text', async ({ page }) => {
	await selectCommand(page, 'alpha:run');
	await runCurrentCommand(page);
	await waitForTerminalText(page, 'alpha-first-line');

	const terminalText = await readTerminalText(page);
	await expect(terminalText).toContain('alpha-first-line');
	await expect(terminalText).toContain('alpha-green-line');
	await expect(terminalText).not.toContain('if (runId === this.activeRunId)');
});

test('renders split ANSI chunks without leaking raw html markup', async ({ page }) => {
	await selectCommand(page, 'alpha:run');

	const terminalText = await page.evaluate(async () => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal') as {
			clear:       () => void;
			appendChunk: (text: string) => void;
			shadowRoot:  ShadowRoot | null;
		} | null;
		if (!terminal)
			return '';

		terminal.clear();
		terminal.appendChunk('start ' + String.fromCharCode(27) + '[32mgreen');
		terminal.appendChunk(' text' + String.fromCharCode(27) + '[0m end\nnext\n');

		await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

		const viewport = terminal.shadowRoot?.querySelector('.runner-terminal-viewport');

		return viewport?.textContent || '';
	});

	expect(terminalText).toContain('start green text end');
	expect(terminalText).toContain('next');
	expect(terminalText).not.toContain('&lt;span');
	expect(terminalText).not.toContain('<span style=');
});

test('renders ANSI color correctly when escape code itself is split across chunks', async ({ page }) => {
	await selectCommand(page, 'alpha:run');

	const terminalState = await page.evaluate(async () => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal') as {
			clear:       () => void;
			appendChunk: (text: string) => void;
			shadowRoot:  ShadowRoot | null;
		} | null;
		if (!terminal)
			return { text: '', html: '' };

		terminal.clear();
		terminal.appendChunk('start ' + String.fromCharCode(27) + '[');
		terminal.appendChunk('32mgreen' + String.fromCharCode(27) + '[0m end\n');

		await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

		const viewport = terminal.shadowRoot?.querySelector('.runner-terminal-viewport') as HTMLElement | null;

		return {
			text: viewport?.textContent || '',
			html: viewport?.innerHTML || '',
		};
	});

	expect(terminalState.text).toContain('start green end');
	expect(terminalState.text).not.toContain('[32m');
	expect(terminalState.html).toContain('color:#56d364');
});

test('switching commands resets terminal and shows new output', async ({ page }) => {
	await selectCommand(page, 'alpha:run');
	await runCurrentCommand(page);
	await waitForTerminalText(page, 'alpha-first-line');
	await expect(await readTerminalText(page)).toContain('alpha-first-line');

	await selectCommand(page, 'beta:run');
	await expect(page.locator('forge-runner #runner-terminal')).toBeHidden();

	await runCurrentCommand(page);
	await waitForTerminalText(page, 'beta-only-output');
	const terminalText = await readTerminalText(page);
	await expect(terminalText).toContain('beta-only-output');
	await expect(terminalText).not.toContain('alpha-first-line');
});

test('keeps terminal anchored at top after long output render', async ({ page }) => {
	await selectCommand(page, 'overflow:run');
	await runCurrentCommand(page);

	await page.waitForFunction(() => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal');
		const viewport = terminal?.shadowRoot?.querySelector('.runner-terminal-viewport');
		const firstLine = viewport?.firstElementChild?.textContent || '';

		return firstLine.includes('overflow-line-000');
	});

	const terminalState = await page.evaluate(() => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal') as (HTMLElement & {
			offsetY?:      number;
			visibleStart?: number;
		}) | null;
		if (!terminal)
			return { scrollTop: -1, firstLine: '', offsetY: -1, visibleStart: -1 };

		const viewport = terminal.shadowRoot?.querySelector('.runner-terminal-viewport');
		const firstLineElement = viewport?.firstElementChild as HTMLElement | null;
		const firstLine = firstLineElement?.textContent || '';

		return {
			scrollTop:    terminal.scrollTop,
			firstLine,
			offsetY:      terminal.offsetY ?? -1,
			visibleStart: terminal.visibleStart ?? -1,
		};
	});

	expect(terminalState.scrollTop).toBe(0);
	expect(terminalState.firstLine).toContain('overflow-line-000');
	expect(terminalState.visibleStart).toBe(0);
	expect(terminalState.offsetY).toBe(0);
});

test('virtualizes rendered lines correctly when scrolling', async ({ page }) => {
	await selectCommand(page, 'overflow:run');
	await runCurrentCommand(page);

	await page.waitForFunction(() => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal') as HTMLElement | null;
		if (!terminal)
			return false;

		const component = terminal as unknown as { lines?: unknown[]; };

		return Array.isArray(component.lines) && component.lines.length > 100;
	});

	const initial = await page.evaluate(() => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal') as HTMLElement | null;
		const viewport = terminal?.shadowRoot?.querySelector('.runner-terminal-viewport') as HTMLElement | null;
		const component = terminal as unknown as { lines?: unknown[]; };
		const renderedLines = viewport ? Array.from(viewport.children).map(node => (node.textContent || '').trim()) : [];

		return {
			totalLines:    Array.isArray(component?.lines) ? component.lines.length : 0,
			renderedCount: renderedLines.length,
			firstRendered: renderedLines[0] || '',
			containsStart: renderedLines.some(line => line.includes('overflow-line-000')),
		};
	});

	expect(initial.totalLines).toBeGreaterThan(150);
	expect(initial.renderedCount).toBeLessThan(initial.totalLines);
	expect(initial.firstRendered).toContain('overflow-line-000');
	expect(initial.containsStart).toBe(true);

	await page.evaluate(() => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal') as HTMLElement | null;
		if (!terminal)
			return;

		terminal.scrollTop = terminal.scrollHeight;
		terminal.dispatchEvent(new Event('scroll'));
	});

	await page.waitForFunction(() => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal') as HTMLElement | null;
		const viewport = terminal?.shadowRoot?.querySelector('.runner-terminal-viewport') as HTMLElement | null;
		const firstLine = (viewport?.firstElementChild?.textContent || '').trim();
		const match = firstLine.match(/overflow-line-(\d+)/);

		if (!match)
			return false;

		return Number(match[1]) > 0;
	});

	const scrolled = await page.evaluate(() => {
		const runner = document.querySelector('forge-runner');
		const terminal = runner?.shadowRoot?.querySelector('forge-terminal') as HTMLElement | null;
		const viewport = terminal?.shadowRoot?.querySelector('.runner-terminal-viewport') as HTMLElement | null;
		const component = terminal as unknown as { lines?: unknown[]; };
		const renderedLines = viewport ? Array.from(viewport.children).map(node => (node.textContent || '').trim()) : [];
		const firstRendered = renderedLines[0] || '';
		const lastRendered = renderedLines[renderedLines.length - 1] || '';
		const firstMatch = firstRendered.match(/overflow-line-(\d+)/);
		const lastMatch = lastRendered.match(/overflow-line-(\d+)/);

		return {
			totalLines:    Array.isArray(component?.lines) ? component.lines.length : 0,
			renderedCount: renderedLines.length,
			firstRendered,
			lastRendered,
			firstIndex:    firstMatch ? Number(firstMatch[1]) : -1,
			lastIndex:     lastMatch ? Number(lastMatch[1]) : -1,
			containsStart: renderedLines.some(line => line.includes('overflow-line-000')),
		};
	});

	expect(scrolled.renderedCount).toBeLessThan(scrolled.totalLines);
	expect(scrolled.firstIndex).toBeGreaterThan(0);
	expect(scrolled.lastIndex).toBeGreaterThan(180);
	expect(scrolled.containsStart).toBe(false);
});
