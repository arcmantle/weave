// Main exports
export { type ISashLayoutProvider, type ISashOptions, Sash } from './sash.ts';
export { SplitView } from './split-view.ts';
export {
	type EditorTemplateContext,
	type EditorTemplateFunction,
	EditorView,
	type IEditorView,
	NestedView,
	ViewManager,
} from './view-manager.ts';

// Types
export type {
	DragState,
	ISashEvent,
	ISplitViewOptions,
	IView,
	SnapState,
	ViewConstraints,
	ViewState,
} from './types.ts';
export {
	Orientation,
	SashState,
	Sizing,
} from './types.ts';

// Utilities
export {
	areViewsDistributed,
	calculateDeltaConstraints,
	clamp,
	distributeEmptySpace,
	resize,
	saveProportions,
} from './utils.ts';
