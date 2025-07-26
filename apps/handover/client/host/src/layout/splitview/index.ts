// Main exports
export {
	type DragDropConfig,
	DragDropManager,
	type DragOperation,
	type DropTarget,
} from './drag-drop-manager.ts';
export { type ISashLayoutProvider, type ISashOptions, Sash } from './sash.ts';
export { SignalMap } from './utilities/signal-map.ts';
export { SplitView } from './split-view.ts';
export { TabView } from './views/tab-view.ts';

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
} from './utilities/utils.ts';
