import type { ContentLocation } from './content.js';


/**
 * Route declaration from a plugin's client manifest.
 * Describes a route the plugin contributes to the app shell.
 */
export interface PluginRouteDeclaration {
	/** URL path pattern (e.g. `/weather`, `/weather/:city`). */
	path:          string;
	/** Unique route name for programmatic navigation. */
	name:          string;
	/** Display label for navigation menus. */
	label?:        string;
	/** Icon identifier for navigation menus. */
	icon?:         string;
	/**
	 * Export name of the component in the plugin's entry module.
	 * Resolved via dynamic import at navigation time.
	 */
	lazyComponent: string;
}


/**
 * Content area declaration from a plugin's client manifest.
 * Describes a UI panel/sidebar/editor area the plugin contributes.
 */
export interface PluginContentDeclaration {
	/** Unique content area identifier. */
	id:                 string;
	/** Where the content appears by default. */
	defaultLocation:    ContentLocation;
	/** All locations where this content can be placed. */
	availableLocations: ContentLocation[];
	/** Tab display metadata. */
	tab: {
		id:    string;
		title: string;
		icon:  string;
	};
	/**
	 * Export name of the content component in the plugin's entry module.
	 * Resolved via dynamic import when the content area is activated.
	 */
	lazyComponent: string;
}


/**
 * Service declaration from a plugin's client manifest.
 * Describes a service the plugin registers into the DI container on activation.
 */
export interface PluginServiceDeclaration {
	/** DI identifier to register the service under. */
	identifier: string;
	/** Export name of the service factory/class in the plugin's entry module. */
	exportName: string;
}


/**
 * Statusbar contribution from a plugin's client manifest.
 */
export interface PluginStatusbarDeclaration {
	/** Unique identifier. */
	id:            string;
	/** Alignment in the statusbar. */
	alignment:     'left' | 'right';
	/** Priority (higher = closer to edge). */
	priority?:     number;
	/** Export name of the statusbar component in the plugin's entry module. */
	lazyComponent: string;
}


/**
 * Shared dependency declaration.
 * Specifies a package the plugin expects the host to provide.
 */
export interface SharedDependency {
	/** npm package name (e.g. `lit`, `@arcmantle/injector`). */
	name:         string;
	/** Semver range the plugin is compatible with (e.g. `^3.0.0`). */
	versionRange: string;
}


/**
 * The client-side manifest for a Pivot plugin.
 * Serialized as `client-manifest.json` in the plugin's `/client/` directory.
 *
 * This manifest is loaded eagerly by the app shell on boot.
 * Actual plugin code is loaded lazily when routes or content areas are activated.
 */
export interface ClientManifest {
	/** Relative path to the ES module entry point (e.g. `index.js`). */
	entryModule:   string;
	/** Optional CSS files to load with the plugin. */
	styles?:       string[];
	/** Routes the plugin contributes to the app shell. */
	routes?:       PluginRouteDeclaration[];
	/** Content areas the plugin contributes to the layout. */
	contentAreas?: PluginContentDeclaration[];
	/** Services the plugin registers on activation. */
	services?:     PluginServiceDeclaration[];
	/** Statusbar items the plugin contributes. */
	statusbar?:    PluginStatusbarDeclaration[];
	/** Dependency declarations. */
	dependencies?: {
		/** Packages the plugin expects the host to provide via import map. */
		shared?:  Record<string, string>;
		/** Packages the plugin bundles itself (informational). */
		bundled?: string[];
	};
	/**
	 * Pre-built shared dependency bundles shipped by this plugin.
	 *
	 * Each entry maps a root package name to its exact version and the
	 * list of specifier-to-file mappings within the `shared/` output directory.
	 *
	 * During startup the backend resolves version conflicts across all
	 * plugins (highest version per major wins) and serves the winning
	 * plugin's bundles at `/shared/`.
	 *
	 * Generated automatically by the Vite plugin at build time.
	 */
	sharedBundles?: Record<string, SharedBundle>;
}


/**
 * Describes a pre-built shared dependency bundle shipped with a plugin.
 */
export interface SharedBundle {
	/** Exact installed version of the root package (e.g. `3.2.1`). */
	version: string;
	/**
	 * Maps each bare specifier to its output file path relative to
	 * the plugin's `/client/shared/` directory.
	 *
	 * @example
	 * ```json
	 * {
	 *   "lit":                   "lit.js",
	 *   "lit/decorators.js":     "lit__decorators.js",
	 *   "lit/directives/when.js": "lit__directives__when.js"
	 * }
	 * ```
	 */
	files:   Record<string, string>;
}


/**
 * A resolved plugin descriptor returned by the backend API.
 * Combines the plugin identity with its client manifest and asset base URL.
 */
export interface ResolvedPluginDescriptor {
	/** Plugin name (matches the backend PluginManifest.Name). */
	name:           string;
	/** Semantic version of the plugin. */
	version:        string;
	/** Base URL where the plugin's client assets are served. */
	baseUrl:        string;
	/** The plugin's client manifest. */
	clientManifest: ClientManifest;
}
