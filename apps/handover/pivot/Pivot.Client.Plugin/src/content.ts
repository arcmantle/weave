import type { TemplateResult } from 'lit';


/**
 * Location where content can be placed in the app shell layout.
 */
export type ContentLocation =
	| 'editor'
	| 'primary-sidebar'
	| 'secondary-sidebar'
	| 'panel';


/**
 * Metadata describing how a content area should be displayed and where it can live.
 */
export interface ContentManifest {
	/** Unique identifier for this content area. */
	id:                 string;
	/** Where the content appears by default. */
	defaultLocation:    ContentLocation;
	/** All locations where this content can be moved to. */
	availableLocations: ContentLocation[];
	/** Tab metadata for the content area. */
	tab: {
		id:    string;
		title: string;
		icon:  string;
	};
}


/**
 * Interface that plugin content components must implement.
 */
export interface Content {
	/** Called once when the content is first loaded. Use for async setup. */
	initialize(): Promise<void> | void;
	/** Returns the renderable template for this content area. */
	render(): TemplateResult | unknown;
}


/**
 * Constructor type for Content implementations.
 * Must have a static `manifest` property declaring the content's metadata.
 */
export type ContentCtor = (new () => Content) & {
	manifest: ContentManifest;
};
