// ─── Markdown Renderer ───

/**
 * Render a markdown string to HTML.
 * Supports headings, code blocks, unordered/ordered lists, and paragraphs.
 * @param {string} src - Raw markdown source text.
 * @returns {string} Rendered HTML string.
 */
function renderMarkdown(src) {
	const lines = src.split('\n');
	let html = '';
	let inCode = false;
	let codeLang = '';
	let codeLines = [];
	let inList = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.trimStart().startsWith('```')) {
			if (inCode) {
				html += '<pre><code' + (codeLang ? ' class="lang-' + esc(codeLang) + '"' : '') + '>'
					+ esc(codeLines.join('\n')) + '</code></pre>';
				codeLines = [];
				codeLang = '';
				inCode = false;
			} else {
				if (inList) { html += '</ul>'; inList = false; }
				codeLang = line.trim().slice(3).trim();
				inCode = true;
			}
			continue;
		}

		if (inCode) {
			codeLines.push(line);
			continue;
		}

		if (line.trim() === '') {
			if (inList) { html += '</ul>'; inList = false; }
			continue;
		}

		const hMatch = line.match(/^(#{1,4})\s+(.*)/);
		if (hMatch) {
			if (inList) { html += '</ul>'; inList = false; }
			const level = hMatch[1].length;
			html += '<h' + level + '>' + inlineMd(hMatch[2]) + '</h' + level + '>';
			continue;
		}

		if (line.match(/^\s*[-*]\s/)) {
			if (!inList) { html += '<ul>'; inList = true; }
			html += '<li>' + inlineMd(line.replace(/^\s*[-*]\s/, '')) + '</li>';
			continue;
		}

		if (line.match(/^\s*\d+\.\s/)) {
			if (!inList) { html += '<ul>'; inList = true; }
			html += '<li>' + inlineMd(line.replace(/^\s*\d+\.\s/, '')) + '</li>';
			continue;
		}

		if (inList) { html += '</ul>'; inList = false; }
		html += '<p>' + inlineMd(line) + '</p>';
	}

	if (inCode) {
		html += '<pre><code>' + esc(codeLines.join('\n')) + '</code></pre>';
	}
	if (inList) { html += '</ul>'; }

	return html;
}

/**
 * Process inline markdown syntax (code, bold, italic, links).
 * @param {string} text - Inline markdown text.
 * @returns {string} HTML with inline formatting applied.
 */
function inlineMd(text) {
	text = text.replace(/`([^`]+)`/g, (_, c) => '<code>' + esc(c) + '</code>');
	text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
	text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
	return text;
}
