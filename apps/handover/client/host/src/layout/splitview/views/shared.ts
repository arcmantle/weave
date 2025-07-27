import { type IView } from '../types.ts';
import type { EditorView } from './editor-view.ts';
import type { NestedView } from './nested-view.ts';
import type { TabView } from './tab-view.ts';


/**
 * Common interface for all editor views in the split view system
 */
export interface IEditorView extends IView {
	readonly id:    string;
	readonly title: string;
	readonly type:  'editor' | 'nested' | 'tab';
}

/**
 * Template context passed to editor template functions for rendering
 */
export interface EditorTemplateContext {
	id:          string;
	title:       string;
	handleClose: () => void;
}

/**
 * Function signature for editor template rendering
 */
export type EditorTemplateFunction = (context: EditorTemplateContext) => unknown;


export const isEditorView = (view?: IEditorView): view is EditorView => view?.type === 'editor';
export const isNestedView = (view?: IEditorView): view is NestedView => view?.type === 'nested';
export const isTabView = (view?: IEditorView): view is TabView => view?.type === 'tab';
