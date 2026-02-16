import { PluginContainer } from '@arcmantle/injector';
import type {
	ContentCtor,
	PivotPluginContext,
	ResolvedPluginDescriptor,
} from '@arcmantle/pivot-client-plugin';
import { router } from '@arcmantle/pivot-client-router';

import {
	loadPluginModule,
	loadPluginStyles,
	validateSharedDependencies,
} from './plugin-loader.js';


/** Tracks the activation state of each plugin. */
export interface PluginState {
	descriptor: ResolvedPluginDescriptor;
	status:     'pending' | 'loading' | 'active' | 'error';
	error?:     Error;
	container?: PluginContainer;
}


/**
 * Manages the lifecycle of client-side plugins.
 *
 * Responsibilities:
 * - Creates scoped child containers per plugin
 * - Activates plugins by loading & calling their activate function
 * - Validates shared dependency compatibility
 * - Tracks plugin state
 */
export class PluginManager {

	protected readonly states:        Map<string, PluginState> = new Map();
	protected readonly hostContainer: PluginContainer;
	protected readonly hostVersions:  Record<string, string>;

	constructor(
		hostContainer: PluginContainer,
		hostVersions: Record<string, string> = {},
	) {
		this.hostContainer = hostContainer;
		this.hostVersions = hostVersions;
	}

	/**
	 * Registers plugin descriptors (from the backend API) without activating them.
	 * This populates the state map so the UI can show available plugins.
	 */
	registerPlugins(descriptors: ResolvedPluginDescriptor[]): void {
		for (const descriptor of descriptors) {
			if (this.states.has(descriptor.name))
				continue;

			this.states.set(descriptor.name, {
				descriptor,
				status: 'pending',
			});
		}
	}

	/**
	 * Activates a single plugin by name.
	 * Loads the plugin module, creates a scoped container, and calls activate().
	 */
	async activatePlugin(name: string): Promise<void> {
		const state = this.states.get(name);
		if (!state)
			throw new Error(`Plugin "${ name }" not registered`);

		if (state.status === 'active' || state.status === 'loading')
			return;

		state.status = 'loading';

		try {
			const { descriptor } = state;
			const { clientManifest, baseUrl } = descriptor;

			// Validate shared dependencies
			const warnings = validateSharedDependencies(name, clientManifest, this.hostVersions);
			for (const warning of warnings)
				console.warn(`[pivot]`, warning);


			// Load CSS
			if (clientManifest.styles?.length)
				loadPluginStyles(baseUrl, clientManifest.styles);

			// Create scoped child container for this plugin
			const childContainer = new PluginContainer({ parent: this.hostContainer });
			state.container = childContainer;

			// Load and activate the plugin module
			const activate = await loadPluginModule(baseUrl, clientManifest.entryModule);

			if (activate) {
				const context = this.createPluginContext(descriptor, childContainer);
				await activate(context);
			}

			state.status = 'active';
			console.log(`[pivot] Plugin "${ name }" activated`);
		}
		catch (error) {
			state.status = 'error';
			state.error = error instanceof Error ? error : new Error(String(error));
			console.error(`[pivot] Failed to activate plugin "${ name }":`, error);
			throw error;
		}
	}

	/**
	 * Activates all registered plugins.
	 * Errors in individual plugins don't prevent other plugins from activating.
	 */
	async activateAll(): Promise<void> {
		const pending = [ ...this.states.entries() ]
			.filter(([ , state ]) => state.status === 'pending');

		await Promise.allSettled(
			pending.map(([ name ]) => this.activatePlugin(name)),
		);
	}

	/**
	 * Returns the current state of all plugins.
	 */
	getPluginStates(): ReadonlyMap<string, PluginState> {
		return this.states;
	}

	/**
	 * Returns all registered plugin descriptors.
	 */
	getDescriptors(): ResolvedPluginDescriptor[] {
		return [ ...this.states.values() ].map(s => s.descriptor);
	}

	/**
	 * Creates the context object passed to a plugin's activate function.
	 */
	protected createPluginContext(
		descriptor: ResolvedPluginDescriptor,
		childContainer: PluginContainer,
	): PivotPluginContext {
		return {
			container: childContainer,
			router,
			baseUrl:   descriptor.baseUrl,

			registerContent(contentCtor: ContentCtor): void {
				// Register on the host container so the layout can find it
				childContainer.bind('content').constant(contentCtor);
			},

			registerSharedService<T>(identifier: string, instance: T): void {
				// Register on the host (parent) container for cross-plugin access
				childContainer.parent!.bind(identifier).constant(instance);
			},
		};
	}

}
