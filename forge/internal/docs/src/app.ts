import './utils';
import './markdown';
import './runner';
import './forge-sidebar';
import './forge-command';
import './forge-templates';
import './forge-registry';

let FORGE_DATA: DocData = {};

const metaStatus: MetaStatus = {};
let metaDone = false;
let metaSource: EventSource | null = null;
let refreshInProgress = false;

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

let activeCommand: string | null = null;
let searchQuery = '';
let activeView: 'tasks' | 'registry' = 'tasks';

function getElement<T extends Element>(selector: string): T {
	const element = document.querySelector(selector);
	if (!element) {
		throw new Error(`Expected element for selector: ${selector}`);
	}

	return element as T;
}

function getElementById<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`Expected element for id: ${id}`);
	}

	return element as T;
}

async function init(): Promise<void> {
	const sidebar = getElement<SidebarRenderer>('forge-sidebar');
	const commandDetail = getElement<CommandRenderer>('forge-command');
	const templateDetail = getElement<TemplateRenderer>('forge-templates');
	const registryDetail = getElement<RegistryRenderer>('forge-registry');

	setupSearch(sidebar);
	setupKeyboard(sidebar);
	setupNavigation(sidebar, commandDetail, templateDetail, registryDetail);
	setupRefresh(sidebar, commandDetail, templateDetail, registryDetail);

	document.addEventListener('command-select', (event: Event) => {
		const customEvent = event as CustomEvent<{ name: string }>;
		selectCommand(customEvent.detail.name, sidebar, commandDetail);
	});

	try {
		const response = await fetch('/api/data');
		FORGE_DATA = await response.json() as DocData;
	} catch {
		getElementById<HTMLElement>('main-content').innerHTML =
			'<div class="no-results"><p>Failed to load command data.</p></div>';
		return;
	}

	getElementById<HTMLElement>('project-name').textContent = FORGE_DATA.projectName || 'forge';
	const headerVersion = getElementById<HTMLElement>('version');
	if (FORGE_DATA.version && FORGE_DATA.version !== 'dev') {
		headerVersion.textContent = 'v' + FORGE_DATA.version;
	} else {
		headerVersion.textContent = '';
	}

	(FORGE_DATA.commands || []).forEach(command => {
		if (command.commandType === 'script') {
			metaStatus[command.name] = 'pending';
		}
	});

	sidebarRender(sidebar);
	renderWelcome();
	connectSSE(sidebar, commandDetail);

	if (registryDetail && registryDetail.initialize) {
		registryDetail.initialize(FORGE_DATA.registrySources || [], FORGE_DATA.installTargets || []);
	}

	applyViewFromHash(sidebar, commandDetail, templateDetail, registryDetail);
}

function sidebarRender(sidebar: SidebarRenderer): void {
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

function connectSSE(sidebar: SidebarRenderer, commandDetail: CommandRenderer): void {
	if (metaSource) {
		metaSource.close();
		metaSource = null;
	}

	const source = new EventSource('/api/events');
	metaSource = source;

	source.addEventListener('meta', (event: MessageEvent) => {
		const update = JSON.parse(event.data) as {
			name: string;
			status: MetaStatusValue;
			positionals?: DocArg[];
			flags?: DocArg[];
			description?: string;
		};
		metaStatus[update.name] = update.status;

		if (update.status === 'ready') {
			const command = (FORGE_DATA.commands || []).find(entry => entry.name === update.name);
			if (command) {
				if (update.positionals) {
					command.positionals = update.positionals;
				}
				if (update.flags) {
					command.flags = update.flags;
				}
				if (update.description && !command.description) {
					command.description = update.description;
				}
			}

			if (activeView === 'tasks' && activeCommand === update.name) {
				const current = (FORGE_DATA.commands || []).find(entry => entry.name === update.name);
				if (current) {
					commandDetail.render(current, metaStatus);
				}
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

function resetMetaState(): void {
	Object.keys(metaStatus).forEach(key => delete metaStatus[key]);
	(FORGE_DATA.commands || []).forEach(command => {
		if (command.commandType === 'script') {
			metaStatus[command.name] = 'pending';
		}
	});
	metaDone = false;
}

async function handleRefresh(
	sidebar: SidebarRenderer,
	commandDetail: CommandRenderer,
	templateDetail: TemplateRenderer,
	registryDetail: RegistryRenderer
): Promise<void> {
	if (refreshInProgress) {
		return;
	}

	const refreshButton = document.getElementById('refresh-commands') as HTMLButtonElement | null;
	const previousLabel = refreshButton ? refreshButton.textContent : 'Refresh';
	refreshInProgress = true;
	if (refreshButton) {
		refreshButton.disabled = true;
		refreshButton.textContent = 'Refreshing...';
	}

	try {
		const response = await fetch('/api/refresh', { method: 'POST' });
		if (!response.ok) {
			throw new Error(await response.text());
		}

		FORGE_DATA = await response.json() as DocData;
		getElementById<HTMLElement>('project-name').textContent = FORGE_DATA.projectName || 'forge';

		const headerVersion = getElementById<HTMLElement>('version');
		if (FORGE_DATA.version && FORGE_DATA.version !== 'dev') {
			headerVersion.textContent = 'v' + FORGE_DATA.version;
		} else {
			headerVersion.textContent = '';
		}

		if (!(FORGE_DATA.commands || []).some(command => command.name === activeCommand)) {
			activeCommand = null;
		}

		resetMetaState();
		sidebarRender(sidebar);

		if (registryDetail && registryDetail.initialize) {
			registryDetail.initialize(FORGE_DATA.registrySources || [], FORGE_DATA.installTargets || []);
		}

		if (activeView === 'tasks') {
			if (activeCommand) {
				const command = (FORGE_DATA.commands || []).find(entry => entry.name === activeCommand);
				if (command) {
					commandDetail.render(command, metaStatus);
				} else {
					renderWelcome();
				}
			} else {
				renderWelcome();
			}
		}

		connectSSE(sidebar, commandDetail);
		applyViewFromHash(sidebar, commandDetail, templateDetail, registryDetail);
	} catch (error) {
		const main = document.getElementById('main-content');
		if (main && activeView === 'tasks') {
			const message = error instanceof Error ? error.message : String(error);
			main.innerHTML = '<div class="no-results"><p>Refresh failed: ' + esc(message) + '</p></div>';
		}
	} finally {
		refreshInProgress = false;
		if (refreshButton) {
			refreshButton.disabled = false;
			refreshButton.textContent = previousLabel;
		}
	}
}

function setupRefresh(
	sidebar: SidebarRenderer,
	commandDetail: CommandRenderer,
	templateDetail: TemplateRenderer,
	registryDetail: RegistryRenderer
): void {
	const refreshButton = document.getElementById('refresh-commands');
	if (!refreshButton) {
		return;
	}

	refreshButton.addEventListener('click', () => {
		handleRefresh(sidebar, commandDetail, templateDetail, registryDetail);
	});
}

function selectCommand(name: string, sidebar: SidebarRenderer, commandDetail: CommandRenderer): void {
	activeCommand = name;
	if (activeView !== 'tasks') {
		window.location.hash = '#tasks';
	}

	sidebarRender(sidebar);

	const command = (FORGE_DATA.commands || []).find(entry => entry.name === name);
	if (command) {
		commandDetail.render(command, metaStatus);
	}
}

function renderWelcome(): void {
	const main = getElementById<HTMLElement>('main-content');
	const commands = FORGE_DATA.commands || [];
	const scriptCount = commands.filter(command => command.commandType === 'script').length;
	const compositeCount = commands.filter(command => command.commandType === 'composite').length;
	const localCount = commands.filter(command => !command.source || command.source === 'local').length;
	const inheritedCount = commands.filter(command => command.source && command.source !== 'local').length;
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

function setupSearch(sidebar: SidebarRenderer): void {
	const input = getElementById<HTMLInputElement>('search');
	input.addEventListener('input', () => {
		searchQuery = input.value;
		if (activeView === 'tasks') {
			sidebarRender(sidebar);
		}
	});
}

function setupKeyboard(sidebar: SidebarRenderer): void {
	document.addEventListener('keydown', event => {
		if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
			event.preventDefault();
			getElementById<HTMLInputElement>('search').focus();
		}
		if (event.key === 'Escape') {
			const search = getElementById<HTMLInputElement>('search');
			search.blur();
			search.value = '';
			searchQuery = '';
			if (activeView === 'tasks') {
				sidebarRender(sidebar);
			}
		}
	});
}

function setupNavigation(
	sidebar: SidebarRenderer,
	commandDetail: CommandRenderer,
	templateDetail: TemplateRenderer,
	registryDetail: RegistryRenderer
): void {
	const tasksButton = getElementById<HTMLButtonElement>('nav-tasks');
	const registryButton = getElementById<HTMLButtonElement>('nav-registry');

	tasksButton.addEventListener('click', () => {
		window.location.hash = '#tasks';
	});
	registryButton.addEventListener('click', () => {
		window.location.hash = '#registry';
	});

	window.addEventListener('hashchange', () => {
		applyViewFromHash(sidebar, commandDetail, templateDetail, registryDetail);
	});
}

function applyViewFromHash(
	sidebar: SidebarRenderer,
	commandDetail: CommandRenderer,
	templateDetail: TemplateRenderer,
	registryDetail: RegistryRenderer
): void {
	const hash = (window.location.hash || '').toLowerCase();
	activeView = hash === '#registry' ? 'registry' : 'tasks';

	const tasksButton = getElementById<HTMLButtonElement>('nav-tasks');
	const registryButton = getElementById<HTMLButtonElement>('nav-registry');
	const layout = getElement<HTMLElement>('.layout');
	const search = getElement<HTMLElement>('.search-wrapper');
	const main = getElementById<HTMLElement>('main-content');
	const template = getElementById<HTMLElement>('template-content');
	const registry = getElementById<HTMLElement>('registry-content');

	tasksButton.classList.toggle('active', activeView === 'tasks');
	registryButton.classList.toggle('active', activeView === 'registry');
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
		const command = (FORGE_DATA.commands || []).find(entry => entry.name === activeCommand);
		if (command) {
			commandDetail.render(command, metaStatus);
		}
	}
}

void init();