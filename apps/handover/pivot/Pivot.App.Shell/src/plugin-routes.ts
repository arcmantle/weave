import type {
	PluginRouteDeclaration,
	ResolvedPluginDescriptor,
} from '@arcmantle/pivot-client-plugin';
import type { RouteConfig } from '@arcmantle/pivot-client-router';
import { html, unsafeStatic } from 'lit/static-html.js';

import type { PluginManager } from './plugin-manager.js';


/**
 * Builds route configurations from all discovered plugin manifests.
 *
 * Each plugin route uses a `beforeEnter` guard to lazily activate the
 * owning plugin on first navigation. The plugin module (and its custom
 * element registration) is only loaded when the user actually navigates
 * to a route that requires it.
 */
export function buildPluginRoutes(
	plugins: ResolvedPluginDescriptor[],
	pluginManager: PluginManager,
): RouteConfig[] {
	const routes: RouteConfig[] = [];

	for (const plugin of plugins) {
		const manifest = plugin.clientManifest;
		if (!manifest.routes?.length)
			continue;

		for (const route of manifest.routes)
			routes.push(createPluginRouteConfig(plugin, route, pluginManager));
	}

	return routes;
}


/**
 * Creates a single `RouteConfig` from a plugin route declaration.
 *
 * The route's `beforeEnter` guard lazily activates the plugin (loading
 * its module and registering its custom elements) the first time the
 * user navigates to the route. Subsequent navigations are a no-op
 * because `activatePlugin` short-circuits for already-active plugins.
 */
function createPluginRouteConfig(
	plugin: ResolvedPluginDescriptor,
	route: PluginRouteDeclaration,
	pluginManager: PluginManager,
): RouteConfig {
	const tagName = route.lazyComponent
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.toLowerCase();

	return {
		path:     route.path,
		name:     route.name,
		metadata: {
			pluginName: plugin.name,
			label:      route.label,
			icon:       route.icon,
		},
		beforeEnter: async () => {
			await pluginManager.activatePlugin(plugin.name);

			return true;
		},
		template: () => {
			return html`<${ unsafeStatic(tagName) }></${ unsafeStatic(tagName) }>`;
		},
	};
}
