// ─── Sidebar Component ───
/**
 * Sidebar listing all forge commands with grouping, search filtering, and meta status.
 * @extends HTMLElement
 */
class ForgeSidebar extends HTMLElement {

	/** @type {HTMLElement} */
	listEl;
	/** @type {HTMLElement} */
	statsEl;

	connectedCallback() {
		this.listEl = this.querySelector('.sidebar-content') || document.getElementById('sidebar-list');
		this.statsEl = this.querySelector('.sidebar-stats') || document.getElementById('sidebar-stats');
	}

	/**
	 * Render the sidebar command list with grouping and search filtering.
	 * @param {DocCommand[]} commands - All available commands.
	 * @param {MetaStatus} metaStatus - Current metadata loading status per command.
	 * @param {boolean} metaDone - Whether all metadata loading is complete.
	 * @param {string} searchQuery - Current search filter string.
	 * @param {string | null} activeCommand - Currently selected command name.
	 */
	render(commands, metaStatus, metaDone, searchQuery, activeCommand) {
		const groups = {};
		const topLevel = [];

		const filtered = commands.filter(cmd => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return cmd.name.toLowerCase().includes(q) ||
				(cmd.description || '').toLowerCase().includes(q);
		});

		filtered.forEach(cmd => {
			const colonIdx = cmd.name.indexOf(':');
			if (colonIdx !== -1) {
				const prefix = cmd.name.substring(0, colonIdx);
				if (!groups[prefix]) groups[prefix] = [];
				groups[prefix].push(cmd);
			} else {
				topLevel.push(cmd);
			}
		});

		const displayOrder = [];
		const seenGroups = new Set();

		topLevel.forEach(cmd => {
			displayOrder.push({ type: 'command', cmd });
			if (groups[cmd.name]) {
				displayOrder.push({ type: 'group', name: cmd.name, children: groups[cmd.name] });
				seenGroups.add(cmd.name);
			}
		});

		Object.keys(groups).sort().forEach(prefix => {
			if (!seenGroups.has(prefix)) {
				displayOrder.push({ type: 'group-only', name: prefix, children: groups[prefix] });
			}
		});

		let html = '';

		displayOrder.forEach(entry => {
			if (entry.type === 'command') {
				html += this.renderItem(entry.cmd, true, metaStatus, activeCommand);
			} else if (entry.type === 'group' || entry.type === 'group-only') {
				if (entry.type === 'group-only') {
					html += '<div class="sidebar-group"><div class="sidebar-group-header" data-group="' + esc(entry.name) + '">'
						+ chevronSvg() + esc(entry.name) + '</div>';
				} else {
					html += '<div class="sidebar-group"><div class="sidebar-group-header" data-group="' + esc(entry.name) + '">'
						+ chevronSvg() + esc(entry.name) + ' subcommands</div>';
				}
				html += '<div class="sidebar-group-items">';
				entry.children.forEach(cmd => {
					html += this.renderItem(cmd, false, metaStatus, activeCommand);
				});
				html += '</div></div>';
			}
		});

		if (filtered.length === 0 && searchQuery) {
			html = '<div class="no-results"><p>No commands match "' + esc(searchQuery) + '"</p></div>';
		}

		this.listEl.innerHTML = html;

		this.listEl.querySelectorAll('.sidebar-item').forEach(el => {
			el.addEventListener('click', (e) => {
				this.dispatchEvent(new CustomEvent('command-select', {
					detail: { name: e.currentTarget.dataset.cmd },
					bubbles: true
				}));
			});
		});

		this.listEl.querySelectorAll('.sidebar-group-header').forEach(el => {
			el.addEventListener('click', () => {
				el.classList.toggle('collapsed');
				const items = el.nextElementSibling;
				if (items) items.classList.toggle('collapsed');
			});
		});

		// Stats
		const scriptCount = commands.filter(c => c.commandType === 'script').length;
		const compositeCount = commands.filter(c => c.commandType === 'composite').length;
		const localCount = commands.filter(c => !c.source || c.source === 'local').length;
		const inheritedCount = commands.filter(c => c.source && c.source !== 'local').length;
		const readyCount = Object.values(metaStatus).filter(s => s === 'ready').length;
		const totalScripts = Object.keys(metaStatus).length;

		let statsHtml = '<span>' + localCount + '</span> local · <span>' + inheritedCount + '</span> inherited';
		if (!metaDone && totalScripts > 0) {
			statsHtml += ' · <span class="status-loading">' + readyCount + '/' + totalScripts + ' loaded</span>';
		}
		this.statsEl.innerHTML = statsHtml;
	}

	/**
	 * Render a single sidebar item.
	 * @param {DocCommand} cmd - The command to render.
	 * @param {boolean} isTopLevel - Whether this is a top-level (ungrouped) item.
	 * @param {MetaStatus} metaStatus - Current metadata loading status.
	 * @param {string | null} activeCommand - Currently selected command name.
	 * @returns {string} HTML string for the sidebar item.
	 */
	renderItem(cmd, isTopLevel, metaStatus, activeCommand) {
		const isActive = activeCommand === cmd.name;
		const displayName = isTopLevel ? cmd.name : cmd.name.substring(cmd.name.lastIndexOf(':') + 1);
		const status = metaStatus[cmd.name];

		let statusIcon = '';
		if (cmd.commandType === 'script') {
			if (status === 'compiling' || status === 'pending') {
				statusIcon = '<span class="status-icon compiling" title="Loading...">' + spinnerSvg() + '</span>';
			}
		}

		const badge = cmd.commandType === 'composite'
			? '<span class="badge badge-composite">composite</span>'
			: '<span class="badge badge-script">script</span>';

		const sourceBadge = cmd.source && cmd.source !== 'local'
			? '<span class="badge badge-inherited" title="Inherited from ' + esc(cmd.source) + '">' + esc(cmd.source) + '</span>'
			: '';

		return '<div class="sidebar-item' + (isTopLevel ? ' top-level' : '') + (isActive ? ' active' : '') + '" data-cmd="' + esc(cmd.name) + '">'
			+ statusIcon + esc(displayName) + badge + sourceBadge + '</div>';
	}
}

customElements.define('forge-sidebar', ForgeSidebar);
