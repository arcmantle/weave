import './utils';

function inlineMd(text: string): string {
	let next = text;
	next = next.replace(/`([^`]+)`/g, (_match, content: string) => '<code>' + esc(content) + '</code>');
	next = next.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	next = next.replace(/\*(.+?)\*/g, '<em>$1</em>');
	next = next.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
	return next;
}

function renderMarkdown(src: string): string {
	const lines = src.split('\n');
	let html = '';
	let inCode = false;
	let codeLang = '';
	const codeLines: string[] = [];
	let inList = false;

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];

		if (line.trimStart().startsWith('```')) {
			if (inCode) {
				html += '<pre><code' + (codeLang ? ' class="lang-' + esc(codeLang) + '"' : '') + '>'
					+ esc(codeLines.join('\n')) + '</code></pre>';
				codeLines.length = 0;
				codeLang = '';
				inCode = false;
			} else {
				if (inList) {
					html += '</ul>';
					inList = false;
				}
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
			if (inList) {
				html += '</ul>';
				inList = false;
			}
			continue;
		}

		const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
		if (headingMatch) {
			if (inList) {
				html += '</ul>';
				inList = false;
			}
			const level = headingMatch[1].length;
			html += '<h' + level + '>' + inlineMd(headingMatch[2]) + '</h' + level + '>';
			continue;
		}

		if (line.match(/^\s*[-*]\s/)) {
			if (!inList) {
				html += '<ul>';
				inList = true;
			}
			html += '<li>' + inlineMd(line.replace(/^\s*[-*]\s/, '')) + '</li>';
			continue;
		}

		if (line.match(/^\s*\d+\.\s/)) {
			if (!inList) {
				html += '<ul>';
				inList = true;
			}
			html += '<li>' + inlineMd(line.replace(/^\s*\d+\.\s/, '')) + '</li>';
			continue;
		}

		if (inList) {
			html += '</ul>';
			inList = false;
		}

		html += '<p>' + inlineMd(line) + '</p>';
	}

	if (inCode) {
		html += '<pre><code>' + esc(codeLines.join('\n')) + '</code></pre>';
	}

	if (inList) {
		html += '</ul>';
	}

	return html;
}

const docsGlobals = globalThis as typeof globalThis & {
	renderMarkdown?: typeof renderMarkdown;
};

docsGlobals.renderMarkdown = renderMarkdown;
