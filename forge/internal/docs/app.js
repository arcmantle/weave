// ─── Data (loaded from server) ───
/** @type {DocData} */
let FORGE_DATA = {};

// ─── Meta status tracking ───
/** @type {MetaStatus} */
const metaStatus = {};
/** @type {boolean} */
let metaDone = false;
/** @type {EventSource | null} */
let metaSource = null;
/** @type {boolean} */
let refreshInProgress = false;

// ─── Heartbeat ───
setInterval(() => {
	fetch('/api/ping', { method: 'POST' }).catch(() => {});
}, 2000);

window.addEventListener('beforeunload', () => {
	if (metaSource) {
		metaSource.close();
		metaSource = null;
	}
	navigator.sendBeacon('/api/shutdown');
});

// ─── State ───
/** @type {string | null} */
let activeCommand = null;
/** @type {string} */
let searchQuery = '';
/** @type {'tasks'|'registry'} */
let activeView = 'tasks';

async function init() {
	const sidebar = document.querySelector('forge-sidebar');
	const commandDetail = document.querySelector('forge-command');
	const templateDetail = document.querySelector('forge-templates');
	const registryDetail = document.querySelector('forge-registry');

	setupSearch(sidebar);
	setupKeyboard(sidebar);
	setupNavigation(sidebar, commandDetail, templateDetail, registryDetail);
	setupRefresh(sidebar, commandDetail, templateDetail, registryDetail);

	document.addEventListener('command-select', (e) => {
		selectCommand(e.detail.name, sidebar, commandDetail);
	});

	try {
		const res = await fetch('/api/data');
		FORGE_DATA = await res.json();
	} catch {
		document.getElementById('main-content').innerHTML =
			'<div class="no-results"><p>Failed to load command data.</p></div>';
		return;
	}

	document.getElementById('project-name').textContent = FORGE_DATA.projectName || 'forge';
	const headerVersion = document.getElementById('version');
	if (FORGE_DATA.version && FORGE_DATA.version !== 'dev') {
		headerVersion.textContent = 'v' + FORGE_DATA.version;
	} else {
		headerVersion.textContent = '';
	}

	(FORGE_DATA.commands || []).forEach(cmd => {
		if (cmd.commandType === 'script') metaStatus[cmd.name] = 'pending';
	});

	sidebarRender(sidebar);
	renderWelcome();
	connectSSE(sidebar, commandDetail);

	if (registryDetail && registryDetail.initialize) {
		registryDetail.initialize(FORGE_DATA.registrySources || [], FORGE_DATA.installTargets || []);
	}

	applyViewFromHash(sidebar, commandDetail, templateDetail, registryDetail);
}

function sidebarRender(sidebar) {
	sidebar.render(
		FORGE_DATA.commands || [],
		[],
		metaStatus,
		metaDone,
		searchQuery,
		activeCommand,
		null
	);
}

function connectSSE(sidebar, commandDetail) {
	if (metaSource) {
		metaSource.close();
		metaSource = null;
	}

	const source = new EventSource('/api/events');
	metaSource = source;

	source.addEventListener('meta', (e) => {
		const update = JSON.parse(e.data);
		metaStatus[update.name] = update.status;

		if (update.status === 'ready') {
			const cmd = (FORGE_DATA.commands || []).find(c => c.name === update.name);
			if (cmd) {
				if (update.positionals) cmd.positionals = update.positionals;
				if (update.flags) cmd.flags = update.flags;
				if (update.description && !cmd.description) cmd.description = update.description;
			}

			if (activeView === 'tasks' && activeCommand === update.name) {
				const current = (FORGE_DATA.commands || []).find(c => c.name === update.name);
				if (current) commandDetail.render(current, metaStatus);
			}
		}

		sidebarRender(sidebar);
	});

	source.addEventListener('done', () => {
		metaDone = true;
		sidebarRender(sidebar);
		source.close();
		if (metaSource === source) {
			metaSource = null;
		}
	});

	source.onerror = () => {
		metaDone = true;
		sidebarRender(sidebar);
		source.close();
		if (metaSource === source) {
			metaSource = null;
		}
	};
}

function resetMetaState() {
	Object.keys(metaStatus).forEach(key => delete metaStatus[key]);
	(FORGE_DATA.commands || []).forEach(cmd => {
		if (cmd.commandType === 'script') {
			metaStatus[cmd.name] = 'pending';
		}
	});
	metaDone = false;
}

async function handleRefresh(sidebar, commandDetail, templateDetail, registryDetail) {
	if (refreshInProgress) return;

	const refreshBtn = document.getElementById('refresh-commands');
	const previousLabel = refreshBtn ? refreshBtn.textContent : 'Refresh';
	refreshInProgress = true;
	if (refreshBtn) {
		refreshBtn.disabled = true;
		refreshBtn.textContent = 'Refreshing...';
	}

	try {
		const res = await fetch('/api/refresh', { method: 'POST' });
		if (!res.ok) {
			throw new Error(await res.text());
		}

		FORGE_DATA = await res.json();
		document.getElementById('project-name').textContent = FORGE_DATA.projectName || 'forge';

		const headerVersion = document.getElementById('version');
		if (FORGE_DATA.version && FORGE_DATA.version !== 'dev') {
			headerVersion.textContent = 'v' + FORGE_DATA.version;
		} else {
			headerVersion.textContent = '';
		}

		if (!(FORGE_DATA.commands || []).some(c => c.name === activeCommand)) {
			activeCommand = null;
		}

		resetMetaState();
		sidebarRender(sidebar);

		if (registryDetail && registryDetail.initialize) {
			registryDetail.initialize(FORGE_DATA.registrySources || [], FORGE_DATA.installTargets || []);
		}

		if (activeView === 'tasks') {
			if (activeCommand) {
				const cmd = (FORGE_DATA.commands || []).find(c => c.name === activeCommand);
				if (cmd) {
					commandDetail.render(cmd, metaStatus);
				} else {
					renderWelcome();
				}
			} else {
				renderWelcome();
			}
		}

		connectSSE(sidebar, commandDetail);
		applyViewFromHash(sidebar, commandDetail, templateDetail, registryDetail);
	} catch (err) {
		const main = document.getElementById('main-content');
		if (main && activeView === 'tasks') {
			main.innerHTML = '<div class="no-results"><p>Refresh failed: ' + esc(String(err && err.message ? err.message : err)) + '</p></div>';
		}
	} finally {
		refreshInProgress = false;
		if (refreshBtn) {
			refreshBtn.disabled = false;
			refreshBtn.textContent = previousLabel;
		}
	}
}

function setupRefresh(sidebar, commandDetail, templateDetail, registryDetail) {
	const refreshBtn = document.getElementById('refresh-commands');
	if (!refreshBtn) return;

	refreshBtn.addEventListener('click', () => {
		handleRefresh(sidebar, commandDetail, templateDetail, registryDetail);
	});
}

function selectCommand(name, sidebar, commandDetail) {
	activeCommand = name;
	if (activeView !== 'tasks') {
		window.location.hash = '#tasks';
	}

	sidebarRender(sidebar);

	const cmd = (FORGE_DATA.commands || []).find(c => c.name === name);
	if (cmd) commandDetail.render(cmd, metaStatus);
}

function renderWelcome() {
	const main = document.getElementById('main-content');
	const commands = FORGE_DATA.commands || [];
	const scriptCount = commands.filter(c => c.commandType === 'script').length;
	const compositeCount = commands.filter(c => c.commandType === 'composite').length;
	const localCount = commands.filter(c => !c.source || c.source === 'local').length;
	const inheritedCount = commands.filter(c => c.source && c.source !== 'local').length;
	const templateCount = FORGE_DATA.templateCount || 0;

	main.innerHTML = '<div class="welcome">'
		+ '<h1>Forge Tasks</h1>'
		+ '<p>Select a task from the sidebar to view details, arguments, and usage.</p>'
		+ '<div class="welcome-stats">'
		+ '<div class="welcome-stat"><div class="number">' + commands.length + '</div><div class="label">Tasks</div></div>'
		+ '<div class="welcome-stat"><div class="number">' + localCount + '</div><div class="label">Local</div></div>'
		+ '<div class="welcome-stat"><div class="number">' + inheritedCount + '</div><div class="label">Inherited</div></div>'
		+ '<div class="welcome-stat"><div class="number">' + scriptCount + '</div><div class="label">Scripts</div></div>'
		+ '<div class="welcome-stat"><div class="number">' + compositeCount + '</div><div class="label">Composites</div></div>'
		+ (templateCount > 0
			? '<div class="welcome-stat"><div class="number">' + templateCount + '</div><div class="label">Templates</div></div>'
			: '')
		+ '</div>'
		+ '<div class="welcome-hint">Press <kbd>/</kbd> to search tasks · Switch to <strong>Registry</strong> for template discovery</div>'
		+ '</div>';
}

function setupSearch(sidebar) {
	const input = document.getElementById('search');
	input.addEventListener('input', () => {
		searchQuery = input.value;
		if (activeView === 'tasks') sidebarRender(sidebar);
	});
}

function setupKeyboard(sidebar) {
	document.addEventListener('keydown', (e) => {
		if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
			e.preventDefault();
			document.getElementById('search').focus();
		}
		if (e.key === 'Escape') {
			document.getElementById('search').blur();
			document.getElementById('search').value = '';
			searchQuery = '';
			if (activeView === 'tasks') sidebarRender(sidebar);
		}
	});
}

function setupNavigation(sidebar, commandDetail, templateDetail, registryDetail) {
	const tasksBtn = document.getElementById('nav-tasks');
	const registryBtn = document.getElementById('nav-registry');

	tasksBtn.addEventListener('click', () => {
		window.location.hash = '#tasks';
	});
	registryBtn.addEventListener('click', () => {
		window.location.hash = '#registry';
	});

	window.addEventListener('hashchange', () => {
		applyViewFromHash(sidebar, commandDetail, templateDetail, registryDetail);
	});
}

function applyViewFromHash(sidebar, commandDetail, templateDetail, registryDetail) {
	const hash = (window.location.hash || '').toLowerCase();
	activeView = hash === '#registry' ? 'registry' : 'tasks';

	const tasksBtn = document.getElementById('nav-tasks');
	const registryBtn = document.getElementById('nav-registry');
	const layout = document.querySelector('.layout');
	const search = document.querySelector('.search-wrapper');
	const main = document.getElementById('main-content');
	const template = document.getElementById('template-content');
	const registry = document.getElementById('registry-content');

	tasksBtn.classList.toggle('active', activeView === 'tasks');
	registryBtn.classList.toggle('active', activeView === 'registry');
	layout.classList.toggle('registry-view', activeView === 'registry');
	search.classList.toggle('hidden', activeView !== 'tasks');

	if (activeView === 'registry') {
		main.style.display = 'none';
		template.style.display = 'none';
		registry.style.display = '';
		activeCommand = null;
		sidebarRender(sidebar);
		return;
	}

	registry.style.display = 'none';
	template.style.display = 'none';
	main.style.display = '';
	sidebarRender(sidebar);

	if (activeCommand) {
		const cmd = (FORGE_DATA.commands || []).find(c => c.name === activeCommand);
		if (cmd) commandDetail.render(cmd, metaStatus);
	}
}

init();
