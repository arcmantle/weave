import type { ContentLocation } from './content.js';


/**
 * Configuration object for defining a Pivot client plugin.
 * Used with `definePivotClientPlugin()` in the plugin's entry module.
 */
export interface PivotClientPluginConfig {
	/** Unique plugin name (must match the backend plugin name). */
	name:          string;
	/** Human-readable display name. */
	displayName?:  string;
	/** Plugin description. */
	description?:  string;
	/** Route declarations for the app shell. */
	routes?:       RouteConfig[];
	/** Content area declarations for the app shell layout. */
	contentAreas?: ContentAreaConfig[];
	/** Service declarations for DI registration. */
	services?:     ServiceConfig[];
	/** Statusbar contribution declarations. */
	statusbar?:    StatusbarConfig[];
}


export interface RouteConfig {
	/** URL path pattern. */
	path:   string;
	/** Unique route name. */
	name:   string;
	/** Display label for navigation. */
	label?: string;
	/** Icon identifier. */
	icon?:  string;
}


export interface ContentAreaConfig {
	/** Unique content area id. */
	id:                 string;
	/** Default layout location. */
	defaultLocation:    ContentLocation;
	/** All allowed locations. */
	availableLocations: ContentLocation[];
	/** Tab display info. */
	tab: {
		id:    string;
		title: string;
		icon:  string;
	};
}


export interface ServiceConfig {
	/** DI identifier. */
	identifier: string;
}


export interface StatusbarConfig {
	/** Unique identifier. */
	id:        string;
	/** Left or right alignment. */
	alignment: 'left' | 'right';
	/** Priority (higher = closer to edge). */
	priority?: number;
}


/**
 * Define a Pivot client plugin configuration.
 *
 * This is a compile-time helper used in the plugin's entry module
 * to declare what the plugin contributes. The Vite plugin reads this
 * configuration to generate the `client-manifest.json`.
 *
 * @example
 * ```ts
 * export const plugin = definePivotClientPlugin({
 *   name: 'WeatherPlugin',
 *   displayName: 'Weather',
 *   routes: [
 *     { path: '/weather', name: 'weather', label: 'Weather', icon: '🌤️' },
 *   ],
 * });
 * ```
 */
export const definePivotClientPlugin = (config: PivotClientPluginConfig): PivotClientPluginConfig => {
	return config;
};
