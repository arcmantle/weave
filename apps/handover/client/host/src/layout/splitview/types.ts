/**
 * Core types for the splitview system, inspired by VSCode's implementation
 */

export enum Orientation {
	VERTICAL = 0,
	HORIZONTAL = 1,
}

export enum LayoutPriority {
	Normal = 0,
	Low = 1,
	High = 2,
}

export enum SashState {
	/** Disable any UI interaction */
	Disabled = 0,
	/** Allow dragging down or to the right, depending on the sash orientation */
	AtMinimum = 1,
	/** Allow dragging up or to the left, depending on the sash orientation */
	AtMaximum = 2,
	/** Enable dragging */
	Enabled = 3,
}

export interface IView<TLayoutContext = undefined> {
	/** The DOM element for this view */
	readonly element: HTMLElement;

	/** Minimum size for this view */
	readonly minimumSize: number;

	/** Maximum size for this view */
	readonly maximumSize: number;

	/** Priority when the layout algorithm runs */
	readonly priority?: LayoutPriority;

	/** Whether the view participates in proportional layout */
	readonly proportionalLayout?: boolean;

	/** Whether the view will snap at minimum size */
	readonly snap?: boolean;

	/** Event fired when view constraints change */
	readonly onDidChange: (callback: (size?: number) => void) => void;

	/** Layout the view with given size and offset */
	layout(size: number, offset: number, context: TLayoutContext | undefined): void;

	/** Set view visibility */
	setVisible?(visible: boolean): void;
}

export interface ISashEvent {
	readonly startX:   number;
	readonly currentX: number;
	readonly startY:   number;
	readonly currentY: number;
}

export interface ISplitViewOptions<_TLayoutContext = undefined> {
	/** Which axis the views align on */
	readonly orientation?: Orientation;

	/** Use proportional resize behavior (true) vs sequential neighbor resize (false) */
	readonly proportionalResize?: boolean;
}

export interface ViewConstraints {
	minimumSize:        number;
	maximumSize:        number;
	priority:           LayoutPriority;
	snap:               boolean;
	proportionalLayout: boolean;
}

export interface ViewState {
	size:               number;
	visible:            boolean;
	cachedVisibleSize?: number;
}

export interface DragState {
	index:           number;
	startPosition:   number;
	currentPosition: number;
	startSizes:      number[];
	minDelta:        number;
	maxDelta:        number;
	snapBefore?:     SnapState;
	snapAfter?:      SnapState;
}

export interface SnapState {
	index:      number;
	limitDelta: number;
	size:       number;
}

export type Sizing =
	| { type: 'distribute'; }
	| { type: 'split'; index: number; }
	| { type: 'auto'; index: number; }
	| { type: 'invisible'; cachedVisibleSize: number; };

export namespace Sizing {
	export const Distribute: Sizing = { type: 'distribute' };
	export const Split = (index: number): Sizing => ({ type: 'split', index });
	export const Auto = (index: number): Sizing => ({ type: 'auto', index });
	export const Invisible = (cachedVisibleSize: number): Sizing => ({
		type: 'invisible',
		cachedVisibleSize,
	});
}
