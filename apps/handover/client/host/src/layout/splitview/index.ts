// Main exports
export { type ISashLayoutProvider, type ISashOptions, Sash } from './sash.ts';
export { SplitView } from './split-view.ts';

// Types
export type {
	DragState,
	ISashEvent,
	ISplitViewOptions,
	IView,
	Sizing,
	SnapState,
	ViewConstraints,
	ViewState,
} from './types.ts';
export {
	Orientation,
	SashState,
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

// CSS
import './splitview.css';
