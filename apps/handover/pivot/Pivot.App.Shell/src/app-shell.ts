import '@arcmantle/pivot-client-router';

import { PluginContainer } from '@arcmantle/injector';
import type { ResolvedPluginDescriptor } from '@arcmantle/pivot-client-plugin';
import { type RouteConfig, router } from '@arcmantle/pivot-client-router';
import { css, type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { when } from 'lit/directives/when.js';

import { fetchClientManifests, fetchImportMap, injectImportMap } from './plugin-loader.js';
import { PluginManager } from './plugin-manager.js';
import { buildPluginRoutes } from './plugin-routes.js';


/**
 * The main Pivot App Shell component.
 *
 * Responsibilities:
 * - Fetches enabled plugin manifests from the backend
 * - Builds routes from plugin declarations + host routes
 * - Activates plugins (loading their code lazily)
 * - Renders the application layout with router outlet
 */
@customElement('pivot-app-shell')
export class PivotAppShell extends LitElement {

	@state() protected initialized = false;
	@state() protected error:   string | undefined;
	@state() protected plugins: ResolvedPluginDescriptor[] = [];

	protected pluginManager: PluginManager | undefined;
	protected container:     PluginContainer = new PluginContainer();

	override connectedCallback(): void {
		super.connectedCallback();
		this.initialize();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		router.dispose();
	}

	protected async initialize(): Promise<void> {
		try {
			// Fetch plugin manifests and import map in parallel
			const [ plugins, importMap ] = await Promise.all([
				fetchClientManifests(),
				fetchImportMap(),
			]);

			this.plugins = plugins;

			// Inject the import map before any plugin modules are loaded.
			// This maps bare specifiers (e.g. "lit") to served URLs.
			injectImportMap(importMap);

			// Set up plugin manager.
			// Derive host-provided versions from the import map keys so that
			// shared dependency validation knows which deps the host provides.
			const hostVersions = Object.fromEntries(
				Object.keys(importMap.imports).map(k => [ k, '*' ]),
			);

			this.pluginManager = new PluginManager(this.container, hostVersions);
			this.pluginManager.registerPlugins(this.plugins);

			// Build routes from plugins + host defaults.
			// Plugin routes use beforeEnter guards to lazily activate
			// each plugin only when the user navigates to its route.
			const hostRoutes = this.getHostRoutes();
			const pluginRoutes = buildPluginRoutes(this.plugins, this.pluginManager);
			const allRoutes: RouteConfig[] = [
				...hostRoutes,
				...pluginRoutes,
			];

			router.setRoutes(allRoutes);

			this.initialized = true;

			// Navigate to current URL
			await router.navigate(window.location.pathname);
		}
		catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
			console.error('[pivot] App shell initialization failed:', err);
		}
	}

	/**
	 * Returns the host application's built-in routes.
	 * Override this in a subclass to provide custom host routes.
	 */
	protected getHostRoutes(): RouteConfig[] {
		return [
			{
				path:     '/',
				name:     'home',
				template: () => html`
				<div class="home">
					<h1>Pivot</h1>
					<p>Select a plugin from the sidebar to get started.</p>
				</div>
				`,
			},
		];
	}

	override render(): unknown {
		return when(this.error,
			() => html`
			<div class="error">
				<h2>Initialization Error</h2>
				<p>${ this.error }</p>
			</div>
			`,
			() => html`
			<div class="shell">
				<nav class="sidebar">
					<div class="sidebar-header">
						<h2>Pivot</h2>
					</div>
					<ul class="nav-list">
						<li>
							<a href="/">Home</a>
						</li>
						${ map(this.getNavItems(), item => html`
						<li>
							<a href="${ item.path }">
								${ when(item.icon, () => html`<span class="icon">${ item.icon }</span>`) }
								${ item.label }
							</a>
						</li>
						`) }
					</ul>
				</nav>
				<main class="content">
					${ when(this.initialized,
						() => html`<router-outlet></router-outlet>`,
						() => html`<div class="loading">Loading plugins...</div>`) }
				</main>
			</div>
			`);
	}

	/**
	 * Extracts navigation items from plugin route declarations.
	 */
	protected getNavItems(): { path: string; label: string; icon?: string; }[] {
		const items: { path: string; label: string; icon?: string; }[] = [];

		for (const plugin of this.plugins) {
			const routes = plugin.clientManifest.routes;
			if (!routes?.length)
				continue;

			for (const route of routes) {
				if (route.label) {
					items.push({
						path:  route.path,
						label: route.label,
						icon:  route.icon,
					});
				}
			}
		}

		return items;
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: block;
			height: 100%;
			overflow: hidden;
			font-family: system-ui, -apple-system, sans-serif;
		}
		.shell {
			display: grid;
			grid-template-columns: 240px 1fr;
			height: 100%;
		}
		.sidebar {
			background: var(--sidebar-bg, #1e1e2e);
			color: var(--sidebar-fg, #cdd6f4);
			padding: 1rem 0;
			overflow-y: auto;
		}
		.sidebar-header {
			padding: 0 1rem 1rem;
			border-bottom: 1px solid var(--sidebar-border, #313244);
		}
		.sidebar-header h2 {
			margin: 0;
			font-size: 1.2rem;
		}
		.nav-list {
			list-style: none;
			margin: 0;
			padding: 0.5rem 0;
		}
		.nav-list li a {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.5rem 1rem;
			color: inherit;
			text-decoration: none;
			transition: background 0.15s;
		}
		.nav-list li a:hover {
			background: var(--sidebar-hover, #313244);
		}
		.icon {
			font-size: 1.1rem;
		}
		.content {
			display: grid;
			padding: 1.5rem;
			overflow-y: auto;
			background: var(--content-bg, #181825);
			color: var(--content-fg, #cdd6f4);
		}
		.home h1 {
			margin-top: 0;
		}
		.loading, .error {
			padding: 2rem;
		}
		.error {
			color: var(--error-fg, #f38ba8);
		}
	`;

}


declare global {
	interface HTMLElementTagNameMap {
		'pivot-app-shell': PivotAppShell;
	}
}
