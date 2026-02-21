import type { PluginContainer } from '@arcmantle/injector';
import type { Router } from '@arcmantle/pivot-client-router';

import type { ContentCtor } from './content.js';


/**
 * Context object passed to a plugin's `activate` function.
 * Provides access to the host's DI container, router, and registration APIs.
 */
export interface PivotPluginContext {
	/**
	 * A child `PluginContainer` scoped to this plugin.
	 * Services registered here are isolated to the plugin unless
	 * explicitly promoted to the shared (parent) container.
	 */
	readonly container: PluginContainer;

	/**
	 * Read-only access to the host router for programmatic navigation.
	 */
	readonly router: Router;

	/**
	 * The base URL where this plugin's client assets are served from.
	 * e.g. `/plugins/weather/client/`
	 */
	readonly baseUrl: string;

	/**
	 * Register a content area component into the app shell layout.
	 * The component's static `manifest` declares its default and available locations.
	 */
	registerContent(contentCtor: ContentCtor): void;

	/**
	 * Register a service into the shared (parent) DI container,
	 * making it available to other plugins and the host.
	 */
	registerSharedService<T>(identifier: string, instance: T): void;
}


/**
 * Function signature for a plugin's entry point.
 * The app shell calls this when the plugin's code is loaded.
 */
export type PluginActivator = (context: PivotPluginContext) => void | Promise<void>;
