// ─── Data (loaded from server) ───
/** @type {DocData} */
let FORGE_DATA = {};

// ─── Meta status tracking ───
/** @type {MetaStatus} */
const metaStatus = {};
/** @type {boolean} */
let metaDone = false;

// ─── Heartbeat ───
setInterval(() => {
	fetch('/api/ping', { method: 'POST' }).catch(() => {});
}, 2000);

// Signal server shutdown when the window is closed.
window.addEventListener('beforeunload', () => {
	navigator.sendBeacon('/api/shutdown');
});

// ─── State ───
/** @type {string | null} */
let activeCommand = null;
/** @type {string | null} */
let activeTemplate = null;
/** @type {string} */
let searchQuery = '';

// ─── Initialization ───
/** Load command data and initialize the application. */
async function init() {
	const sidebar = document.querySelector('forge-sidebar');
	const commandDetail = document.querySelector('forge-command');
	const templateDetail = document.querySelector('forge-templates');

	setupSearch(sidebar);
	setupKeyboard(sidebar);

	// Listen for command selection from sidebar or command detail (step clicks).
	document.addEventListener('command-select', (e) => {
		selectCommand(e.detail.name, sidebar, commandDetail, templateDetail);
	});

	// Listen for template selection from sidebar.
	document.addEventListener('template-select', (e) => {
		selectTemplate(e.detail.name, sidebar, commandDetail, templateDetail);
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
	document.getElementById('version').textContent = FORGE_DATA.version ? 'v' + FORGE_DATA.version : '';

	(FORGE_DATA.commands || []).forEach(cmd => {
		if (cmd.commandType === 'script') metaStatus[cmd.name] = 'pending';
	});

	sidebarRender(sidebar);
	renderWelcome();
	connectSSE(sidebar, commandDetail, templateDetail);
}

// ─── Sidebar render helper ───
/**
 * Re-render the sidebar with current state.
 * @param {ForgeSidebar} sidebar
 */
function sidebarRender(sidebar) {
	sidebar.render(
		FORGE_DATA.commands || [],
		FORGE_DATA.templates || [],
		metaStatus,
		metaDone,
		searchQuery,
		activeCommand,
		activeTemplate
	);
}

// ─── SSE Connection ───
/**
 * Connect to the server-sent events endpoint for progressive metadata updates.
 * @param {ForgeSidebar} sidebar
 * @param {ForgeCommand} commandDetail
 * @param {ForgeTemplates} templateDetail
 */
function connectSSE(sidebar, commandDetail, templateDetail) {
	const source = new EventSource('/api/events');

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

			if (activeCommand === update.name) {
				const cmd = (FORGE_DATA.commands || []).find(c => c.name === update.name);
				if (cmd) commandDetail.render(cmd, metaStatus);
			}
		}

		sidebarRender(sidebar);
	});

	source.addEventListener('done', () => {
		metaDone = true;
		sidebarRender(sidebar);
		source.close();
	});

	source.onerror = () => {
		metaDone = true;
		sidebarRender(sidebar);
		source.close();
	};
}

// ─── Select Command ───
/**
 * Select a command and render its detail view.
 * @param {string} name - Command name to select.
 * @param {ForgeSidebar} sidebar
 * @param {ForgeCommand} commandDetail
 * @param {ForgeTemplates} templateDetail
 */
function selectCommand(name, sidebar, commandDetail, templateDetail) {
	activeCommand = name;
	activeTemplate = null;

	document.getElementById('main-content').style.display = '';
	document.getElementById('template-content').style.display = 'none';

	sidebarRender(sidebar);

	const cmd = (FORGE_DATA.commands || []).find(c => c.name === name);
	if (cmd) commandDetail.render(cmd, metaStatus);
}

// ─── Select Template ───
/**
 * Select a template and render its detail view.
 * @param {string} name - Template name to select.
 * @param {ForgeSidebar} sidebar
 * @param {ForgeCommand} commandDetail
 * @param {ForgeTemplates} templateDetail
 */
function selectTemplate(name, sidebar, commandDetail, templateDetail) {
	activeTemplate = name;
	activeCommand = null;

	document.getElementById('main-content').style.display = 'none';
	document.getElementById('template-content').style.display = '';

	sidebarRender(sidebar);

	const tpl = (FORGE_DATA.templates || []).find(t => t.name === name);
	if (tpl) templateDetail.render(tpl, FORGE_DATA.installTargets || []);
}

// ─── Welcome Screen ───
/** Render the welcome/landing page with command statistics. */
function renderWelcome() {
	const main = document.getElementById('main-content');
	const commands = FORGE_DATA.commands || [];
	const tpls = FORGE_DATA.templates || [];
	const scriptCount = commands.filter(c => c.commandType === 'script').length;
	const compositeCount = commands.filter(c => c.commandType === 'composite').length;
	const localCount = commands.filter(c => !c.source || c.source === 'local').length;
	const inheritedCount = commands.filter(c => c.source && c.source !== 'local').length;

	main.innerHTML = '<div class="welcome">'
		+ '<h1>Forge Documentation</h1>'
		+ '<p>Select a command from the sidebar to view its documentation, arguments, and usage.</p>'
		+ '<div class="welcome-stats">'
		+ '<div class="welcome-stat"><div class="number">' + commands.length + '</div><div class="label">Commands</div></div>'
		+ '<div class="welcome-stat"><div class="number">' + localCount + '</div><div class="label">Local</div></div>'
		+ '<div class="welcome-stat"><div class="number">' + inheritedCount + '</div><div class="label">Inherited</div></div>'
		+ '<div class="welcome-stat"><div class="number">' + scriptCount + '</div><div class="label">Scripts</div></div>'
		+ '<div class="welcome-stat"><div class="number">' + compositeCount + '</div><div class="label">Composites</div></div>'
		+ (tpls.length > 0
			? '<div class="welcome-stat"><div class="number">' + tpls.length + '</div><div class="label">Templates</div></div>'
			: '')
		+ '</div>'
		+ '<div class="welcome-hint">Press <kbd>/</kbd> to search · Click a command or template to view details</div>'
		+ '</div>';
}

// ─── Search ───
/**
 * Set up the search input handler.
 * @param {ForgeSidebar} sidebar
 */
function setupSearch(sidebar) {
	const input = document.getElementById('search');
	input.addEventListener('input', () => {
		searchQuery = input.value;
		sidebarRender(sidebar);
	});
}

// ─── Keyboard ───
/**
 * Set up global keyboard shortcuts (/ for search, Escape to clear).
 * @param {ForgeSidebar} sidebar
 */
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
			sidebarRender(sidebar);
		}
	});
}

// ─── Start ───
init();
