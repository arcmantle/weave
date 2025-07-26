import { type IView } from '../types.ts';
import type { EditorView } from './editor-view.ts';
import type { NestedView } from './nested-view.ts';
import type { TabView } from './tab-view.ts';

/**
 * Common interface for all editor views in the split view system
 */
export interface IEditorView extends IView {
	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize: number;
	readonly maximumSize: number;
	readonly type:        'editor' | 'nested' | 'tab'; // 'editor' is for internal use only
	dispose(): void;
}

/**
 * Template context passed to editor template functions for rendering
 */
export interface EditorTemplateContext {
	handleClose: () => void;
	id:          string;
	title:       string;
}

/**
 * Function signature for editor template rendering
 */
export type EditorTemplateFunction = (context: EditorTemplateContext) => unknown;

/**
 * Interface for editors with their associated callbacks during conversions
 */
export interface EditorWithCallback {
	editor:    any; // Using any to avoid circular dependency
	callback?: (id: string) => boolean | void;
}

/**
 * Type guard to check if a view is an EditorView
 */
export function isEditorView(view?: IEditorView): view is EditorView {
	return view?.type === 'editor';
}

/**
 * Type guard to check if a view is a NestedView
 */
export function isNestedView(view?: IEditorView): view is NestedView {
	return view?.type === 'nested';
}

/**
 * Type guard to check if a view is a TabView
 */
export function isTabView(view?: IEditorView): view is TabView {
	return view?.type === 'tab';
}
