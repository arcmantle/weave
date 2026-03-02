import { html, LitElement, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { when } from 'lit/directives/when.js';

import type { DocCommand, DocTemplate, MetaStatus } from './types';
import { chevronSvg, linkSvg, spinnerSvg, vscodeFileUrl } from './utils';


type GroupEntry =
	| { type: 'command'; cmd: DocCommand; }
	| { type: 'group'; name: string; children: DocCommand[]; }
	| { type: 'group-only'; name: string; children: DocCommand[]; };


class ForgeSidebar extends LitElement {

	protected commands:              DocCommand[] = [];
	protected templates:             DocTemplate[] = [];
	protected metaStatus:            MetaStatus = {};
	protected metaDone = false;
	protected searchQuery = '';
	protected activeCommand:         string | null = null;
	protected activeTemplate:        string | null = null;
	protected closedGroups:          Set<string> = new Set();
	protected collapsedPrefixGroups: Set<string> = new Set();

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	setData(
		commands: DocCommand[],
		templates: DocTemplate[],
		metaStatus: MetaStatus,
		metaDone: boolean,
		searchQuery: string,
		activeCommand: string | null,
		activeTemplate: string | null,
	): void {
		this.commands = commands;
		this.templates = templates;
		this.metaStatus = metaStatus;
		this.metaDone = metaDone;
		this.searchQuery = searchQuery;
		this.activeCommand = activeCommand;
		this.activeTemplate = activeTemplate;
		this.requestUpdate();
	}

	protected override render(): TemplateResult {
		const filtered = this.commands.filter(command => {
			if (!this.searchQuery)
				return true;

			const query = this.searchQuery.toLowerCase();

			return command.name.toLowerCase().includes(query)
				|| (command.description || '').toLowerCase().includes(query);
		});

		const localCommands = filtered.filter(command => !command.source || command.source === 'local');
		const inheritedCommands = filtered.filter(command => command.source && command.source !== 'local');
		const groupedInherited = this.groupInheritedCommands(inheritedCommands);

		const filteredTemplates = (this.templates || []).filter(template => {
			if (!this.searchQuery)
				return true;

			const query = this.searchQuery.toLowerCase();

			return template.name.toLowerCase().includes(query)
				|| (template.description || '').toLowerCase().includes(query)
				|| (template.languages || []).some(language => language.toLowerCase().includes(query));
		});

		return html`
			<div class="sidebar-content" id="sidebar-list">
				${ this.sidebarTemplate({
					filtered,
					localCommands,
					groupedInherited,
					filteredTemplates,
					metaStatus:     this.metaStatus,
					searchQuery:    this.searchQuery,
					activeCommand:  this.activeCommand,
					activeTemplate: this.activeTemplate,
				}) }
			</div>
			<div class="sidebar-stats" id="sidebar-stats">
				${ this.statsTemplate(this.commands, this.templates, this.metaStatus, this.metaDone, groupedInherited) }
			</div>
		`;
	}

	protected sidebarTemplate(data: {
		filtered:          DocCommand[];
		localCommands:     DocCommand[];
		groupedInherited:  Record<string, { commands: DocCommand[]; sourcePath?: string; }>;
		filteredTemplates: DocTemplate[];
		metaStatus:        MetaStatus;
		searchQuery:       string;
		activeCommand:     string | null;
		activeTemplate:    string | null;
	}): TemplateResult {
		const inheritedSources = Object.keys(data.groupedInherited).sort();

		return html`
			${ this.renderCommandGroup(data.localCommands, data.metaStatus, data.activeCommand) }

			${ repeat(inheritedSources, source => source, source => {
				const group = data.groupedInherited[source];
				if (!group)
					return html``;

				const isOpen = data.searchQuery ? true : !this.closedGroups.has(source);
				const sourceUrl = vscodeFileUrl(group.sourcePath || '');

				return html`
					<details
						class="inherited-group"
						data-source=${ source }
						?open=${ isOpen }
						@toggle=${ (event: Event) => this.onDetailsToggle(event) }
					>
						<summary class="inherited-group-header">
							${ unsafeHTML(chevronSvg()) }
							<span class="inherited-group-name">${ source }</span>
							<span class="inherited-count">${ group.commands.length }</span>
							${ when(!!sourceUrl, () => html`
								<a
									class="inherited-source-link"
									href=${ sourceUrl }
									title="Open in VS Code"
									@click=${ (event: Event) => event.stopPropagation() }
								>
									${ unsafeHTML(linkSvg()) }
								</a>
							`, () => null) }
						</summary>
						<div class="inherited-group-items">
							${ this.renderCommandGroup(group.commands, data.metaStatus, data.activeCommand) }
						</div>
					</details>
				`;
			}) }

			${ this.renderTemplateGroups(data.filteredTemplates, data.searchQuery, data.activeTemplate) }

			${ when(data.filtered.length === 0 && data.filteredTemplates.length === 0 && !!data.searchQuery,
				() => html`<div class="no-results"><p>No commands or templates match "${ data.searchQuery }"</p></div>`,
				() => null) }
		`;
	}

	protected renderTemplateGroups(templates: DocTemplate[], searchQuery: string, activeTemplate: string | null): TemplateResult {
		if (templates.length === 0)
			return html``;


		const grouped: Record<string, DocTemplate[]> = {};
		templates.forEach(template => {
			const source = template.source || 'templates';
			if (!grouped[source])
				grouped[source] = [];

			grouped[source].push(template);
		});

		const sources = Object.keys(grouped).sort();

		return html`
			${ repeat(sources, source => source, source => {
				const entries = grouped[source];
				if (!entries)
					return html``;

				const sourceKey = 'tpl:' + source;
				const isOpen = searchQuery ? true : !this.closedGroups.has(sourceKey);

				return html`
					<details
						class="template-group"
						data-source=${ sourceKey }
						?open=${ isOpen }
						@toggle=${ (event: Event) => this.onDetailsToggle(event) }
					>
						<summary class="template-group-header">
							${ unsafeHTML(chevronSvg()) }
							<span class="template-group-name">${ source } templates</span>
							<span class="template-count">${ entries.length }</span>
						</summary>
						<div class="template-group-items">
							${ repeat(entries, template => template.name, template => html`
								<div
									class=${ 'sidebar-item sidebar-template-item' + (activeTemplate === template.name ? ' active' : '') }
									data-tpl=${ template.name }
									@click=${ () => this.dispatchTemplate(template.name) }
								>
									${ template.name }
									<span class="badge badge-template">template</span>
								</div>
							`) }
						</div>
					</details>
				`;
			}) }
		`;
	}

	protected renderCommandGroup(commands: DocCommand[], metaStatus: MetaStatus, activeCommand: string | null): TemplateResult {
		const groups: Record<string, DocCommand[]> = {};
		const topLevel: DocCommand[] = [];

		commands.forEach(command => {
			const colonIndex = command.name.indexOf(':');
			if (colonIndex !== -1) {
				const prefix = command.name.substring(0, colonIndex);
				if (!groups[prefix])
					groups[prefix] = [];

				groups[prefix].push(command);
			}
			else {
				topLevel.push(command);
			}
		});

		const displayOrder: GroupEntry[] = [];
		const seenGroups: Set<string> = new Set();

		topLevel.forEach(command => {
			displayOrder.push({ type: 'command', cmd: command });
			const nested = groups[command.name];
			if (nested) {
				displayOrder.push({ type: 'group', name: command.name, children: nested });
				seenGroups.add(command.name);
			}
		});

		Object.keys(groups).sort().forEach(prefix => {
			const groupedChildren = groups[prefix];
			if (!seenGroups.has(prefix) && groupedChildren)
				displayOrder.push({ type: 'group-only', name: prefix, children: groupedChildren });
		});

		return html`
			${ repeat(displayOrder, (_, index) => index, entry => {
				if (entry.type === 'command')
					return this.renderItem(entry.cmd, true, metaStatus, activeCommand);


				return html`
					<div class="sidebar-group">
						<div
							class=${ 'sidebar-group-header' + (this.collapsedPrefixGroups.has(entry.name) ? ' collapsed' : '') }
							data-group=${ entry.name }
							@click=${ () => this.togglePrefixGroup(entry.name) }
						>
							${ unsafeHTML(chevronSvg()) }
							${ entry.type === 'group-only' ? entry.name : `${ entry.name } subcommands` }
						</div>
						<div class=${ 'sidebar-group-items' + (this.collapsedPrefixGroups.has(entry.name) ? ' collapsed' : '') }>
							${ repeat(
								entry.children,
								child => child.name,
								child => this.renderItem(child, false, metaStatus, activeCommand),
							) }
						</div>
					</div>
				`;
			}) }
		`;
	}

	protected renderItem(
		command: DocCommand,
		isTopLevel: boolean,
		metaStatus: MetaStatus,
		activeCommand: string | null,
	): TemplateResult {
		const displayName = isTopLevel ? command.name : command.name.substring(command.name.lastIndexOf(':') + 1);
		const status = metaStatus[command.name];
		const statusIcon = command.commandType === 'script' && (status === 'compiling' || status === 'pending')
			? html`<span class="status-icon compiling" title="Loading...">${ unsafeHTML(spinnerSvg()) }</span>`
			: null;

		return html`
			<div
				class=${ 'sidebar-item' + (isTopLevel ? ' top-level' : '') + (activeCommand === command.name ? ' active' : '') }
				data-cmd=${ command.name }
				@click=${ () => this.dispatchCommand(command.name) }
			>
				${ statusIcon }
				${ displayName }
				<span class=${ 'badge ' + (command.commandType === 'composite' ? 'badge-composite' : 'badge-script') }>
					${ command.commandType }
				</span>
			</div>
		`;
	}

	protected statsTemplate(
		commands: DocCommand[],
		templates: DocTemplate[],
		metaStatus: MetaStatus,
		metaDone: boolean,
		groupedInherited: Record<string, { commands: DocCommand[]; sourcePath?: string; }>,
	): TemplateResult {
		const localCount = commands.filter(command => !command.source || command.source === 'local').length;
		const inheritedCount = commands.filter(command => command.source && command.source !== 'local').length;
		const templateCount = (templates || []).length;
		const readyCount = Object.values(metaStatus).filter(value => value === 'ready').length;
		const totalScripts = Object.keys(metaStatus).length;
		const inheritedSources = Object.keys(groupedInherited);
		const allCollapsed = inheritedSources.length > 0 && inheritedSources.every(source => this.closedGroups.has(source));

		return html`
			<div class="sidebar-stats-main">
				<span>${ localCount }</span> local
				${ when(
					inheritedCount > 0,
					() => html`<span class="stats-sep"></span><span>${ inheritedCount }</span> inherited`,
					() => null,
				) }
				${ when(
					templateCount > 0,
					() => html`<span class="stats-sep"></span><span>${ templateCount }</span> templates`,
					() => null,
				) }
				${ when(
					!metaDone && totalScripts > 0,
					() => html`
						<span class="stats-sep"></span>
						<span class="status-loading">${ readyCount }/${ totalScripts } loaded</span>
					`,
					() => null,
				) }
			</div>
			${ when(inheritedCount > 0, () => html`
				<div class="sidebar-stats-action">
					<button
						class="sidebar-toggle-btn"
						data-action="toggle-all"
						@click=${ () => this.toggleAllInherited() }
					>
						${ allCollapsed ? 'expand' : 'collapse' }
					</button>
				</div>
			`, () => null) }
		`;
	}

	protected onDetailsToggle(event: Event): void {
		const details = event.currentTarget as HTMLDetailsElement;
		const source = details.dataset['source'];
		if (!source)
			return;


		if (details.open)
			this.closedGroups.delete(source);
		else
			this.closedGroups.add(source);
	}

	protected togglePrefixGroup(group: string): void {
		if (!group)
			return;


		if (this.collapsedPrefixGroups.has(group))
			this.collapsedPrefixGroups.delete(group);
		else
			this.collapsedPrefixGroups.add(group);


		this.requestUpdate();
	}

	protected toggleAllInherited(): void {
		const inheritedSources = this.commands
			.filter(command => command.source && command.source !== 'local')
			.map(command => command.source || '')
			.filter(source => source !== '');
		const uniqueSources = Array.from(new Set(inheritedSources));
		const allClosed = uniqueSources.every(source => this.closedGroups.has(source));

		uniqueSources.forEach(source => {
			if (allClosed)
				this.closedGroups.delete(source);
			else
				this.closedGroups.add(source);
		});

		this.requestUpdate();
	}

	protected dispatchCommand(name: string): void {
		this.dispatchEvent(new CustomEvent('command-select', {
			detail:  { name },
			bubbles: true,
		}));
	}

	protected dispatchTemplate(name: string): void {
		this.dispatchEvent(new CustomEvent('template-select', {
			detail:  { name },
			bubbles: true,
		}));
	}

	protected groupInheritedCommands(commands: DocCommand[]): Record<string, { commands: DocCommand[]; sourcePath?: string; }> {
		const groups: Record<string, { commands: DocCommand[]; sourcePath?: string; }> = {};
		commands.forEach(command => {
			const source = command.source || 'inherited';
			if (!groups[source])
				groups[source] = { commands: [], sourcePath: command.sourcePath };

			groups[source].commands.push(command);
		});

		return groups;
	}

}

customElements.define('forge-sidebar', ForgeSidebar);
