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
	/** @type {Set<string>} Tracks which inherited groups have been explicitly closed. */
	closedGroups = new Set();
	/** @type {Set<string>} Tracks which prefix groups are collapsed by the user. */
	collapsedPrefixGroups = new Set();

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
		const filtered = commands.filter(cmd => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return cmd.name.toLowerCase().includes(q) ||
				(cmd.description || '').toLowerCase().includes(q);
		});

		const localCommands = filtered.filter(cmd => !cmd.source || cmd.source === 'local');
		const inheritedCommands = filtered.filter(cmd => cmd.source && cmd.source !== 'local');

		let html = '';

		// Render local commands with prefix grouping.
		html += this.renderCommandGroup(localCommands, metaStatus, activeCommand);

		// Group inherited commands by source.
		const inheritedGroups = {};
		inheritedCommands.forEach(cmd => {
			if (!inheritedGroups[cmd.source]) {
				inheritedGroups[cmd.source] = { commands: [], sourcePath: cmd.sourcePath };
			}
			inheritedGroups[cmd.source].commands.push(cmd);
		});

		// Render inherited groups in collapsible <details> elements.
		Object.keys(inheritedGroups).sort().forEach(source => {
			const group = inheritedGroups[source];
			const isOpen = searchQuery ? true : !this.closedGroups.has(source);
			const openAttr = isOpen ? ' open' : '';
			const sourceUrl = vscodeFileUrl(group.sourcePath);

			html += '<details class="inherited-group" data-source="' + esc(source) + '"' + openAttr + '>';
			html += '<summary class="inherited-group-header">'
				+ chevronSvg()
				+ '<span class="inherited-group-name">' + esc(source) + '</span>'
				+ '<span class="inherited-count">' + group.commands.length + '</span>';
			if (sourceUrl) {
				html += '<a class="inherited-source-link" href="' + esc(sourceUrl) + '" title="Open in VS Code">' + linkSvg() + '</a>';
			}
			html += '</summary>';
			html += '<div class="inherited-group-items">';
			html += this.renderCommandGroup(group.commands, metaStatus, activeCommand);
			html += '</div></details>';
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
			const group = el.dataset.group;
			if (this.collapsedPrefixGroups.has(group)) {
				el.classList.add('collapsed');
				const items = el.nextElementSibling;
				if (items) items.classList.add('collapsed');
			}
			el.addEventListener('click', () => {
				el.classList.toggle('collapsed');
				const items = el.nextElementSibling;
				if (items) items.classList.toggle('collapsed');
				if (el.classList.contains('collapsed')) {
					this.collapsedPrefixGroups.add(group);
				} else {
					this.collapsedPrefixGroups.delete(group);
				}
			});
		});

		// Track inherited group open/close state via toggle events.
		this.listEl.querySelectorAll('.inherited-group').forEach(el => {
			el.addEventListener('toggle', (e) => {
				const source = e.currentTarget.dataset.source;
				if (e.currentTarget.open) {
					this.closedGroups.delete(source);
				} else {
					this.closedGroups.add(source);
				}
			});
		});

		// Prevent source links from toggling the parent details element.
		this.listEl.querySelectorAll('.inherited-source-link').forEach(el => {
			el.addEventListener('click', (e) => {
				e.stopPropagation();
			});
		});

		// Stats
		const localCount = commands.filter(c => !c.source || c.source === 'local').length;
		const inheritedCount = commands.filter(c => c.source && c.source !== 'local').length;
		const readyCount = Object.values(metaStatus).filter(s => s === 'ready').length;
		const totalScripts = Object.keys(metaStatus).length;

		let statsHtml = '<span>' + localCount + '</span> local';
		if (inheritedCount > 0) {
			statsHtml += '<span class="stats-sep"></span><span>' + inheritedCount + '</span> inherited';
		}
		if (!metaDone && totalScripts > 0) {
			statsHtml += '<span class="stats-sep"></span><span class="status-loading">' + readyCount + '/' + totalScripts + ' loaded</span>';
		}
		if (inheritedCount > 0) {
			const allCollapsed = this.closedGroups.size > 0 && this.listEl.querySelectorAll('.inherited-group:not([open])').length === this.listEl.querySelectorAll('.inherited-group').length;
			const label = allCollapsed ? 'expand' : 'collapse';
			statsHtml += '<span class="sidebar-stats-spacer"></span><button class="sidebar-toggle-btn" data-action="toggle-all">' + label + '</button>';
		}
		this.statsEl.innerHTML = statsHtml;

		// Bind collapse/expand all button.
		const toggleBtn = this.statsEl.querySelector('.sidebar-toggle-btn');
		if (toggleBtn) {
			toggleBtn.addEventListener('click', () => {
				const details = this.listEl.querySelectorAll('.inherited-group');
				const allClosed = Array.from(details).every(d => !d.open);
				details.forEach(d => {
					d.open = allClosed;
					const source = d.dataset.source;
					if (allClosed) {
						this.closedGroups.delete(source);
					} else {
						this.closedGroups.add(source);
					}
				});
				toggleBtn.textContent = allClosed ? 'collapse' : 'expand';
			});
		}
	}

	/**
	 * Render a list of commands with colon-prefix grouping.
	 * @param {DocCommand[]} commands - Commands to group and render.
	 * @param {MetaStatus} metaStatus - Current metadata loading status.
	 * @param {string | null} activeCommand - Currently selected command name.
	 * @returns {string} HTML string.
	 */
	renderCommandGroup(commands, metaStatus, activeCommand) {
		const groups = {};
		const topLevel = [];

		commands.forEach(cmd => {
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

		return html;
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

		return '<div class="sidebar-item' + (isTopLevel ? ' top-level' : '') + (isActive ? ' active' : '') + '" data-cmd="' + esc(cmd.name) + '">'
			+ statusIcon + esc(displayName) + badge + '</div>';
	}
}

customElements.define('forge-sidebar', ForgeSidebar);
