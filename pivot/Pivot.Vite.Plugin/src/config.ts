import type { ClientManifest } from '@arcmantle/pivot-client-plugin';


/**
 * Configuration for the Pivot Vite plugin.
 * Passed to `pivotPlugin()` in the plugin's `vite.config.ts`.
 */
export interface PivotPluginOptions {
	/** Unique plugin name (must match the backend PluginManifest name). */
	name: string;

	/**
	 * Entry module path relative to the project root.
	 * @default 'src/index.ts'
	 */
	entry?: string;

	/**
	 * Output directory for the built client assets.
	 * @default 'dist/client'
	 */
	outDir?: string;

	/**
	 * Additional packages to externalize beyond the default shared set.
	 * These will be resolved via the host's import map at runtime.
	 */
	additionalExternals?: string[];

	/**
	 * Packages from the default shared set to NOT externalize.
	 * Use this if your plugin needs to bundle its own version of a shared dependency.
	 */
	bundleOverrides?: string[];

	/**
	 * Explicit client manifest to write. If not provided,
	 * the manifest is auto-generated from the plugin config.
	 */
	clientManifest?: ClientManifest;
}


/**
 * Default set of packages that are externalized and provided by the host
 * via import maps. Plugin authors should NOT bundle these.
 */
export const DEFAULT_SHARED_DEPENDENCIES = [
	'lit',
	'lit/decorators.js',
	'lit/directives/when.js',
	'lit/directives/map.js',
	'lit/directives/repeat.js',
	'lit/directives/class-map.js',
	'lit/directives/style-map.js',
	'lit/directives/if-defined.js',
	'lit/directives/guard.js',
	'lit/directives/cache.js',
	'lit/directives/live.js',
	'lit/directives/ref.js',
	'lit/directives/unsafe-html.js',
	'@lit/context',
	'@arcmantle/injector',
	'@arcmantle/pivot-client-router',
	'@arcmantle/pivot-client-plugin',
	'tslib',
] as const;
