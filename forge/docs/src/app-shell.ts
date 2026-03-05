import './markdown-renderer';
import './forge-runner';
import './forge-sidebar';
import './forge-command';
import './forge-templates';
import './forge-registry';

import { html, LitElement, type TemplateResult } from 'lit';
import { when } from 'lit/directives/when.js';

import { forgeAppShellStyles } from './app-shell-styles';
import type {
	CommandRenderer,
	DocArg,
	DocData,
	MetaStatus,
	MetaStatusValue,
	RegistryRenderer,
	SidebarRenderer,
} from './types';
import { esc } from './utils';

export class ForgeDocsApp extends LitElement {

	static override styles = [ forgeAppShellStyles ];

	protected forgeData:     DocData = {};
	protected metaStatus:    MetaStatus = {};
	protected metaDone = false;
	protected metaSource:    EventSource | null = null;
	protected refreshInProgress = false;
	protected activeCommand: string | null = null;
	protected searchQuery = '';
	protected activeView:    'tasks' | 'registry' = 'tasks';
	protected pingTimer:     ReturnType<typeof setInterval> | null = null;
	protected initialized = false;
	protected hostConnectionState: 'checking' | 'connected' | 'disconnected' = 'checking';

	protected readonly handleHashChange = (): void => {
		if (!this.initialized)
			return;

		this.applyViewFromHash();
	};

	protected readonly handleKeyboardDown = (event: KeyboardEvent): void => {
		if (event.key === '/' && this.shadowRoot?.activeElement?.tagName !== 'INPUT') {
			event.preventDefault();
			this.getElementById<HTMLInputElement>('search').focus();
		}

		if (event.key === 'Escape') {
			const search = this.getElementById<HTMLInputElement>('search');
			search.blur();
			search.value = '';
			this.searchQuery = '';
			if (this.activeView === 'tasks')
				this.sidebarRender();
		}
	};

	protected readonly handleCommandSelect = (event: Event): void => {
		const customEvent = event as CustomEvent<{ name?: string; }>;
		const name = customEvent.detail?.name;
		if (!name)
			return;

		this.selectCommand(name);
	};

	protected readonly handleSearchInput = (): void => {
		this.searchQuery = this.getElementById<HTMLInputElement>('search').value;
		if (this.activeView === 'tasks')
			this.sidebarRender();
	};

	protected readonly handleTasksClick = (): void => {
		window.location.hash = '#tasks';
	};

	protected readonly handleRegistryClick = (): void => {
		window.location.hash = '#registry';
	};

	protected readonly handleRefreshClick = (): void => {
		void this.handleRefresh();
	};

	override connectedCallback(): void {
		super.connectedCallback();

		if (!this.pingTimer) {
			void this.pingHost();
			this.pingTimer = setInterval(() => {
				void this.pingHost();
			}, 2000);
		}

		window.addEventListener('hashchange', this.handleHashChange);
		document.addEventListener('keydown', this.handleKeyboardDown);

		if (!this.initialized)
			this.initializeApp();
	}

	override disconnectedCallback(): void {
		window.removeEventListener('hashchange', this.handleHashChange);
		document.removeEventListener('keydown', this.handleKeyboardDown);

		if (this.pingTimer) {
			clearInterval(this.pingTimer);
			this.pingTimer = null;
		}

		if (this.metaSource) {
			this.metaSource.close();
			this.metaSource = null;
		}

		super.disconnectedCallback();
	}

	protected initializeApp(): void {
		void this.initializeAppAsync();
	}

	protected async initializeAppAsync(): Promise<void> {
		await this.updateComplete;

		this.setupSearch();
		this.setupNavigation();
		this.setupRefresh();
		this.setupSelection();

		try {
			const response = await fetch('/api/data');
			this.forgeData = await response.json() as DocData;
		}
		catch {
			const commandDetail = this.getElement<CommandRenderer>('forge-command');
			if (commandDetail.setError)
				commandDetail.setError('Failed to load command data.');

			return;
		}

		this.getElementById<HTMLElement>('project-name').textContent = this.forgeData.projectName || 'forge';
		const headerVersion = this.getElementById<HTMLElement>('version');
		if (this.forgeData.version && this.forgeData.version !== 'dev')
			headerVersion.textContent = 'v' + this.forgeData.version;
		else
			headerVersion.textContent = '';

		(this.forgeData.commands || []).forEach(command => {
			if (command.commandType === 'script')
				this.metaStatus[command.name] = 'pending';
		});

		this.sidebarRender();
		this.renderWelcome();
		this.connectSSE();

		const registryDetail = this.getElement<RegistryRenderer>('forge-registry');
		if (registryDetail.initialize)
			registryDetail.initialize(this.forgeData.registrySources || [], this.forgeData.installTargets || []);

		this.initialized = true;
		this.applyViewFromHash();
	}

	protected getElement<T extends Element>(selector: string): T {
		const element = this.renderRoot.querySelector(selector);
		if (!element)
			throw new Error(`Expected element for selector: ${ selector }`);

		return element as T;
	}

	protected getElementById<T extends HTMLElement>(id: string): T {
		const element = this.renderRoot.querySelector('#' + id);
		if (!element)
			throw new Error(`Expected element for id: ${ id }`);

		return element as T;
	}

	protected sidebarRender(): void {
		this.getElement<SidebarRenderer>('forge-sidebar').setData(
			this.forgeData.commands || [],
			[],
			this.metaStatus,
			this.metaDone,
			this.searchQuery,
			this.activeCommand,
			null,
		);
	}

	protected updateHostConnectionState(nextState: 'checking' | 'connected' | 'disconnected'): void {
		if (this.hostConnectionState === nextState)
			return;

		this.hostConnectionState = nextState;
		this.requestUpdate();
	}

	protected async pingHost(): Promise<void> {
		try {
			const response = await fetch('/api/ping', { method: 'POST' });
			this.updateHostConnectionState(response.ok ? 'connected' : 'disconnected');
		}
		catch {
			this.updateHostConnectionState('disconnected');
		}
	}

	protected getActivePathLabel(): string {
		if (this.activeView !== 'tasks')
			return '';

		const fallbackPath = this.forgeData.runCwd || '';
		if (!this.activeCommand)
			return fallbackPath;

		const command = (this.forgeData.commands || []).find(entry => entry.name === this.activeCommand);
		if (!command)
			return fallbackPath;

		return command.runPath || fallbackPath;
	}

	protected hostConnectionLabel(): string {
		if (this.hostConnectionState === 'connected')
			return 'Host connected';

		if (this.hostConnectionState === 'disconnected')
			return 'Host disconnected';

		return 'Checking host';
	}

	protected hostConnectionDotClass(): string {
		if (this.hostConnectionState === 'connected')
			return 'header-connection-dot connected';

		if (this.hostConnectionState === 'disconnected')
			return 'header-connection-dot disconnected';

		return 'header-connection-dot checking';
	}

	protected connectSSE(): void {
		if (this.metaSource) {
			this.metaSource.close();
			this.metaSource = null;
		}

		const source = new EventSource('/api/events');
		this.metaSource = source;

		source.addEventListener('meta', (event: MessageEvent) => {
			const update = JSON.parse(event.data) as {
				name:         string;
				status:       MetaStatusValue;
				positionals?: DocArg[];
				flags?:       DocArg[];
				description?: string;
			};
			this.metaStatus[update.name] = update.status;

			if (update.status === 'ready') {
				const command = (this.forgeData.commands || []).find(entry => entry.name === update.name);
				if (command) {
					if (update.positionals)
						command.positionals = update.positionals;

					if (update.flags)
						command.flags = update.flags;

					if (update.description && !command.description)
						command.description = update.description;
				}

				if (this.activeView === 'tasks' && this.activeCommand === update.name) {
					const current = (this.forgeData.commands || []).find(entry => entry.name === update.name);
					if (current)
						this.getElement<CommandRenderer>('forge-command').setCommand(current, this.metaStatus);
				}
			}

			this.sidebarRender();
		});

		source.addEventListener('done', () => {
			this.metaDone = true;
			this.sidebarRender();
			source.close();
			if (this.metaSource === source)
				this.metaSource = null;
		});

		source.onerror = () => {
			this.metaDone = true;
			this.sidebarRender();
			source.close();
			if (this.metaSource === source)
				this.metaSource = null;
		};
	}

	protected resetMetaState(): void {
		Object.keys(this.metaStatus).forEach(key => delete this.metaStatus[key]);
		(this.forgeData.commands || []).forEach(command => {
			if (command.commandType === 'script')
				this.metaStatus[command.name] = 'pending';
		});
		this.metaDone = false;
	}

	protected async handleRefresh(): Promise<void> {
		if (this.refreshInProgress)
			return;

		const commandDetail = this.getElement<CommandRenderer>('forge-command');
		const registryDetail = this.getElement<RegistryRenderer>('forge-registry');
		const refreshButton = this.getElementById<HTMLButtonElement>('refresh-commands');
		const previousLabel = refreshButton.textContent || 'Refresh';
		this.refreshInProgress = true;
		refreshButton.disabled = true;
		refreshButton.textContent = 'Refreshing...';

		try {
			const response = await fetch('/api/refresh', { method: 'POST' });
			if (!response.ok)
				throw new Error(await response.text());

			this.forgeData = await response.json() as DocData;
			this.getElementById<HTMLElement>('project-name').textContent = this.forgeData.projectName || 'forge';

			const headerVersion = this.getElementById<HTMLElement>('version');
			if (this.forgeData.version && this.forgeData.version !== 'dev')
				headerVersion.textContent = 'v' + this.forgeData.version;
			else
				headerVersion.textContent = '';

			if (!(this.forgeData.commands || []).some(command => command.name === this.activeCommand))
				this.activeCommand = null;

			this.resetMetaState();
			this.sidebarRender();

			if (registryDetail.initialize)
				registryDetail.initialize(this.forgeData.registrySources || [], this.forgeData.installTargets || []);

			if (this.activeView === 'tasks') {
				if (this.activeCommand) {
					const command = (this.forgeData.commands || []).find(entry => entry.name === this.activeCommand);
					if (command)
						commandDetail.setCommand(command, this.metaStatus);
					else
						this.renderWelcome();
				}
				else {
					this.renderWelcome();
				}
			}

			this.connectSSE();
			this.applyViewFromHash();
		}
		catch (error) {
			if (this.activeView === 'tasks' && commandDetail.setError) {
				const message = error instanceof Error ? error.message : String(error);
				commandDetail.setError('Refresh failed: ' + esc(message));
			}
		}
		finally {
			this.refreshInProgress = false;
			refreshButton.disabled = false;
			refreshButton.textContent = previousLabel;
		}
	}

	protected setupSelection(): void {
		this.getElement<SidebarRenderer>('forge-sidebar').addEventListener('command-select', this.handleCommandSelect);
		this.getElement<CommandRenderer>('forge-command').addEventListener('command-select', this.handleCommandSelect);
	}

	protected setupRefresh(): void {
		this.getElementById<HTMLButtonElement>('refresh-commands').addEventListener('click', this.handleRefreshClick);
	}

	protected selectCommand(name: string): void {
		this.activeCommand = name;
		if (this.activeView !== 'tasks')
			window.location.hash = '#tasks';

		this.sidebarRender();

		const command = (this.forgeData.commands || []).find(entry => entry.name === name);
		if (command)
			this.getElement<CommandRenderer>('forge-command').setCommand(command, this.metaStatus);
	}

	protected renderWelcome(): void {
		const commands = this.forgeData.commands || [];
		const scriptCount = commands.filter(command => command.commandType === 'script').length;
		const compositeCount = commands.filter(command => command.commandType === 'composite').length;
		const localCount = commands.filter(command => !command.source || command.source === 'local').length;
		const inheritedCount = commands.filter(command => command.source && command.source !== 'local').length;
		const templateCount = this.forgeData.templateCount || 0;

		const commandDetail = this.getElement<CommandRenderer>('forge-command');
		if (commandDetail.setWelcome) {
			commandDetail.setWelcome({
				total:      commands.length,
				local:      localCount,
				inherited:  inheritedCount,
				scripts:    scriptCount,
				composites: compositeCount,
				templates:  templateCount,
			});
		}
	}

	protected setupSearch(): void {
		this.getElementById<HTMLInputElement>('search').addEventListener('input', this.handleSearchInput);
	}

	protected setupNavigation(): void {
		this.getElementById<HTMLButtonElement>('nav-tasks').addEventListener('click', this.handleTasksClick);
		this.getElementById<HTMLButtonElement>('nav-registry').addEventListener('click', this.handleRegistryClick);
	}

	protected applyViewFromHash(): void {
		const hash = (window.location.hash || '').toLowerCase();
		this.activeView = hash === '#registry' ? 'registry' : 'tasks';

		const tasksButton = this.getElementById<HTMLButtonElement>('nav-tasks');
		const registryButton = this.getElementById<HTMLButtonElement>('nav-registry');
		const layout = this.getElement<HTMLElement>('.layout');
		const search = this.getElement<HTMLElement>('.search-wrapper');
		const sidebarElement = this.getElement<HTMLElement>('forge-sidebar');
		const main = this.getElementById<HTMLElement>('main-content');
		const template = this.getElementById<HTMLElement>('template-content');
		const registry = this.getElementById<HTMLElement>('registry-content');

		tasksButton.classList.toggle('active', this.activeView === 'tasks');
		registryButton.classList.toggle('active', this.activeView === 'registry');
		layout.classList.toggle('registry-view', this.activeView === 'registry');
		search.classList.toggle('hidden', this.activeView !== 'tasks');

		if (this.activeView === 'registry') {
			sidebarElement.style.display = 'none';
			main.style.display = 'none';
			template.style.display = 'none';
			registry.style.display = '';
			this.activeCommand = null;
			this.sidebarRender();

			return;
		}

		sidebarElement.style.display = '';
		registry.style.display = 'none';
		template.style.display = 'none';
		main.style.display = '';
		this.sidebarRender();

		if (this.activeCommand) {
			const command = (this.forgeData.commands || []).find(entry => entry.name === this.activeCommand);
			if (command)
				this.getElement<CommandRenderer>('forge-command').setCommand(command, this.metaStatus);
		}
	}

	protected override render(): TemplateResult {
		const activePathLabel = this.getActivePathLabel() || 'Unknown run path';

		return html`
			<div class="header">
				<div class="header-logo">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M12 2L2 7l10 5 10-5-10-5z"></path>
						<path d="M2 17l10 5 10-5"></path>
						<path d="M2 12l10 5 10-5"></path>
					</svg>
					<span class="header-title">Forge Tasks</span>
				</div>
				<span class="header-project" id="project-name"></span>
				<div class="header-nav" id="header-nav">
					<button class="header-nav-btn active" id="nav-tasks" type="button">Tasks</button>
					<button class="header-nav-btn" id="nav-registry" type="button">Registry</button>
				</div>
				<button class="header-refresh-btn" id="refresh-commands" type="button" title="Rediscover commands">Refresh</button>
				<div class="header-connection" title=${ this.hostConnectionLabel() }>
					<span class=${ this.hostConnectionDotClass() }></span>
					<span>${ this.hostConnectionLabel() }</span>
				</div>
				${ when(
					this.activeView === 'tasks',
					() => html`
						<div class="header-active-path" title=${ activePathLabel }>
							<span class="header-active-path-label">Active path</span>
							<span class="header-active-path-value">${ activePathLabel }</span>
						</div>
					`,
					() => null,
				) }
				<div class="header-spacer"></div>
				<div class="search-wrapper">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
					</svg>
					<input type="text" class="search-input" id="search" placeholder="Search tasks..." autocomplete="off">
				</div>
				<span class="header-version" id="version"></span>
			</div>

			<div class="layout">
				<forge-sidebar class="sidebar"></forge-sidebar>
				<forge-command class="main" id="main-content"></forge-command>
				<forge-templates class="main" id="template-content" style="display:none"></forge-templates>
				<forge-registry class="main registry-main" id="registry-content" style="display:none"></forge-registry>
			</div>
		`;
	}

}
