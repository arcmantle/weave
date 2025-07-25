import { type ISashLayoutProvider, Sash } from './sash.ts';
import {
	type DragState,
	type ISashEvent,
	type ISplitViewOptions,
	type IView,
	Orientation,
	SashState,
	type Sizing,
	type ViewConstraints,
	type ViewState,
} from './types.ts';
import {
	areViewsDistributed,
	calculateDeltaConstraints,
	clamp,
	distributeEmptySpace,
	resize,
} from './utils.ts';


interface ISashItem {
	sash:       Sash;
	disposable: () => void;
}


abstract class ViewItem<TLayoutContext, TView extends IView<TLayoutContext>> {

	constructor(
		protected container: HTMLElement,
		readonly view: TView,
		size: number | { cachedVisibleSize: number; },
	) {
		if (typeof size === 'number') {
			this._size = size;
			this._cachedVisibleSize = undefined;
			container.classList.add('visible');
		}
		else {
			this._size = 0;
			this._cachedVisibleSize = size.cachedVisibleSize;
		}

		container.appendChild(view.element);
	}

	private _size:              number;
	private _cachedVisibleSize: number | undefined = undefined;

	set enabled(enabled: boolean) {
		this.container.style.pointerEvents = enabled ? '' : 'none';
	}

	get size(): number {
		return this._size;
	}

	set size(size: number) {
		this._size = size;
	}

	get cachedVisibleSize(): number | undefined {
		return this._cachedVisibleSize;
	}

	get visible(): boolean {
		return typeof this._cachedVisibleSize === 'undefined';
	}

	get minimumSize(): number {
		return this.visible ? this.view.minimumSize : 0;
	}

	get viewMinimumSize(): number {
		return this.view.minimumSize;
	}

	get maximumSize(): number {
		return this.visible ? this.view.maximumSize : 0;
	}

	get viewMaximumSize(): number {
		return this.view.maximumSize;
	}

	setVisible(visible: boolean, size?: number): void {
		if (visible === this.visible)
			return;

		if (visible) {
			this.size = clamp(
				this.viewMinimumSize,
				this._cachedVisibleSize!,
				this.viewMaximumSize,
			);
			this._cachedVisibleSize = undefined;
		}
		else {
			this._cachedVisibleSize = typeof size === 'number' ? size : this.size;
			this.size = 0;
		}

		this.container.classList.toggle('visible', visible);

		try {
			this.view.setVisible?.(visible);
		}
		catch (error) {
			console.error('SplitView: Failed to set visible view', error);
		}
	}

	layout(offset: number, layoutContext: TLayoutContext | undefined): void {
		this.layoutContainer(offset);

		try {
			this.view.layout(this.size, offset, layoutContext);
		}
		catch (error) {
			console.error('SplitView: Failed to layout view', error);
		}
	}

	abstract layoutContainer(offset: number): void;

	dispose(): void {
		this.container.remove();
	}

}

class VerticalViewItem<TLayoutContext, TView extends IView<TLayoutContext>>
	extends ViewItem<TLayoutContext, TView> {

	layoutContainer(offset: number): void {
		this.container.style.top = `${ offset }px`;
		this.container.style.height = `${ this.size }px`;
	}

}

class HorizontalViewItem<TLayoutContext, TView extends IView<TLayoutContext>>
	extends ViewItem<TLayoutContext, TView> {

	layoutContainer(offset: number): void {
		this.container.style.left = `${ offset }px`;
		this.container.style.width = `${ this.size }px`;
	}

}

enum State {
	Idle,
	Busy,
}

/**
 * The SplitView is the UI component which implements a one dimensional
 * flex-like layout algorithm for a collection of IView instances.
 */
export class SplitView<
	TLayoutContext = undefined,
	TView extends IView<TLayoutContext> = IView<TLayoutContext>,
> implements ISashLayoutProvider {

	readonly orientation: Orientation;
	readonly el:          HTMLElement;

	private sashContainer:               HTMLElement;
	private viewContainer:               HTMLElement;
	private size = 0;
	private layoutContext:               TLayoutContext | undefined;
	private _contentSize = 0;
	private proportions:                 (number | undefined)[] | undefined = undefined;
	private viewItems:                   ViewItem<TLayoutContext, TView>[] = [];
	private sashItems:                   ISashItem[] = [];
	private sashDragState:               DragState | undefined;
	private sashPointerStatesBeforeDrag: boolean[] = [];
	private state:                       State = State.Idle;
	private proportionalResize:          boolean;

	private readonly onDidSashChangeCallbacks: ((index: number) => void)[] = [];
	private readonly onDidSashResetCallbacks:  ((index: number) => void)[] = [];
	private resizeObserver:                    ResizeObserver | null = null;

	get length(): number {
		return this.viewItems.length;
	}

	get hasProportions(): boolean {
		return this.proportions !== undefined;
	}

	constructor(container: HTMLElement, options: ISplitViewOptions<TLayoutContext> = {}) {
		this.orientation = options.orientation ?? Orientation.VERTICAL;
		this.proportionalResize = options.proportionalResize ?? true;

		this.el = document.createElement('div');
		this.el.classList.add('split-view');
		this.el.classList.add(this.orientation === Orientation.VERTICAL ? 'vertical' : 'horizontal');
		container.appendChild(this.el);

		this.sashContainer = document.createElement('div');
		this.sashContainer.classList.add('sash-container');
		this.el.appendChild(this.sashContainer);

		this.viewContainer = document.createElement('div');
		this.viewContainer.classList.add('view-container');
		this.el.appendChild(this.viewContainer);
	}

	onDidSashChange(callback: (index: number) => void): void {
		this.onDidSashChangeCallbacks.push(callback);
	}

	onDidSashReset(callback: (index: number) => void): void {
		this.onDidSashResetCallbacks.push(callback);
	}

	private fireOnDidSashChange(index: number): void {
		for (const callback of this.onDidSashChangeCallbacks)
			callback(index);
	}

	private fireOnDidSashReset(index: number): void {
		for (const callback of this.onDidSashResetCallbacks)
			callback(index);
	}

	addView(view: TView, size: number | Sizing, index: number = this.viewItems.length, skipLayout?: boolean): void {
		this.doAddView(view, size, index, skipLayout);
	}

	removeView(index: number, sizing?: Sizing): TView {
		if (index < 0 || index >= this.viewItems.length)
			throw new Error('Index out of bounds');

		if (this.state !== State.Idle)
			throw new Error('Cannot modify splitview');

		this.state = State.Busy;

		try {
			if (sizing?.type === 'auto') {
				if (this.areViewsDistributed())
					sizing = { type: 'distribute' };
				else
					sizing = { type: 'split', index: sizing.index };
			}

			// Validate split index for removeView first
			if (sizing?.type === 'split' && (sizing.index < 0 || sizing.index >= this.viewItems.length)) {
				throw new Error(
					`Invalid split index for removeView: ${ sizing.index }. ` +
					`Must be between 0 and ${ this.viewItems.length - 1 }`,
				);
			}

			// Save reference view, in case of `split` sizing (before removing the view)
			const referenceViewItem = sizing?.type === 'split' ?
				this.viewItems[sizing.index] : undefined;

			// Remove view
			const viewItemToRemove = this.viewItems.splice(index, 1)[0]!;

			// Resize reference view, in case of `split` sizing
			// Note: If the removed view was before the reference view, we need to adjust
			if (referenceViewItem && sizing?.type === 'split') {
				// Find the reference view after removal (its index may have shifted)
				const adjustedIndex = index < sizing.index ? sizing.index - 1 : sizing.index;
				const actualReferenceView = this.viewItems[adjustedIndex];
				if (actualReferenceView)
					actualReferenceView.size += viewItemToRemove.size;
			}

			// Remove sash
			if (this.viewItems.length >= 1) {
				const sashIndex = Math.max(index - 1, 0);
				const sashItem = this.sashItems.splice(sashIndex, 1)[0]!;
				sashItem.sash.dispose();
				sashItem.disposable();
			}

			this.reLayout();

			if (sizing?.type === 'distribute')
				this.distributeViewSizes();

			const result = viewItemToRemove.view;
			viewItemToRemove.dispose();

			return result;
		}
		finally {
			this.state = State.Idle;
		}
	}

	getViewSize(index: number): number {
		if (index < 0 || index >= this.viewItems.length)
			return -1;

		return this.viewItems[index]!.size;
	}

	setViewSize(index: number, size: number): void {
		if (index < 0 || index >= this.viewItems.length)
			return;

		const item = this.viewItems[index]!;
		const currentSize = item.size;
		const delta = size - currentSize;

		if (Math.abs(delta) > 0) {
			this.resize(index, delta);
			this.layoutViews();
		}
	}

	getView(index: number): TView | undefined {
		if (index < 0 || index >= this.viewItems.length)
			return undefined;

		return this.viewItems[index]!.view;
	}

	indexOf(view: TView): number {
		for (let i = 0; i < this.viewItems.length; i++) {
			if (this.viewItems[i]!.view === view)
				return i;
		}

		return -1;
	}

	removeViewByReference(view: TView, sizing?: Sizing): TView | undefined {
		const index = this.indexOf(view);
		if (index === -1)
			return undefined;

		// If no sizing specified, default to giving space to adjacent view
		if (!sizing) {
			// Give space to the view immediately to the right, or to the left if it's the rightmost
			const adjacentIndex = index < this.viewItems.length - 1 ? index + 1 : index - 1;
			if (adjacentIndex >= 0 && adjacentIndex < this.viewItems.length)
				sizing = { type: 'split', index: adjacentIndex };
		}

		return this.removeView(index, sizing);
	}

	/**
	 * Remove a view by reference with explicit control over which adjacent view gets the space
	 * @param view The view to remove
	 * @param preferRight If true, prefer giving space to the right neighbor; if false, prefer left
	 * @returns The removed view, or undefined if not found
	 */
	removeViewByReferenceWithDirection(view: TView, preferRight: boolean = true): TView | undefined {
		const index = this.indexOf(view);
		if (index === -1)
			return undefined;

		let adjacentIndex: number;
		if (preferRight) {
			// Try right first, then left
			adjacentIndex = index < this.viewItems.length - 1 ? index + 1 : index - 1;
		}
		else {
			// Try left first, then right
			adjacentIndex = index > 0 ? index - 1 : index + 1;
		}

		let sizing: Sizing | undefined;
		if (adjacentIndex >= 0 && adjacentIndex < this.viewItems.length)
			sizing = { type: 'split', index: adjacentIndex };

		return this.removeView(index, sizing);
	}

	/**
	 * Enable automatic resize handling for this split view
	 * This will observe the container element and automatically call layout() when it changes size
	 */
	enableAutoResize(): void {
		if (this.resizeObserver)
			return; // Already enabled

		this.resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				if (entry.target === this.el) {
					const newSize = this.orientation === Orientation.HORIZONTAL
						? entry.contentRect.width
						: entry.contentRect.height;

					this.layout(newSize);
				}
			}
		});

		this.resizeObserver.observe(this.el);
	}

	/**
	 * Disable automatic resize handling
	 */
	disableAutoResize(): void {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	/**
	 * Get all views in this split view
	 */
	getViews(): TView[] {
		return this.viewItems.map(item => item.view);
	}

	/**
	 * Execute a function for each view in this split view
	 */
	forEachView(callback: (view: TView, index: number) => void): void {
		this.viewItems.forEach((item, index) => callback(item.view, index));
	}

	layout(size: number, layoutContext?: TLayoutContext): void {
		const previousSize = Math.max(this.size, this._contentSize);

		this.size = size;
		this.layoutContext = layoutContext;

		if (!this.proportions) {
			this.resize(this.viewItems.length - 1, size - previousSize);
		}
		else {
			let total = 0;

			for (let i = 0; i < this.viewItems.length; i++) {
				const item = this.viewItems[i]!;
				const proportion = this.proportions[i];

				if (typeof proportion === 'number')
					total += proportion;
				else
					size -= item.size;
			}

			for (let i = 0; i < this.viewItems.length; i++) {
				const item = this.viewItems[i]!;
				const proportion = this.proportions[i];

				if (typeof proportion === 'number' && total > 0) {
					item.size = clamp(
						Math.round(proportion * size / total),
						item.minimumSize,
						item.maximumSize,
					);
				}
			}
		}

		this.distributeEmptySpace();
		this.layoutViews();
	}

	// ISashLayoutProvider implementation
	getVerticalSashLeft(sash: Sash): number {
		return this.getSashPosition(sash);
	}

	getVerticalSashTop(): number {
		return 0;
	}

	getVerticalSashHeight(): number {
		return this.size;
	}

	getHorizontalSashTop(sash: Sash): number {
		return this.getSashPosition(sash);
	}

	getHorizontalSashLeft(): number {
		return 0;
	}

	getHorizontalSashWidth(): number {
		return this.size;
	}

	private getSashPosition(sash: Sash): number {
		let position = 0;

		for (let i = 0; i < this.sashItems.length; i++) {
			position += this.viewItems[i]!.size;

			if (this.sashItems[i]!.sash === sash)
				return position;
		}

		return 0;
	}

	private doAddView(view: TView, size: number | Sizing, index = this.viewItems.length, skipLayout?: boolean): void {
		if (this.state !== State.Idle)
			throw new Error('Cannot modify splitview');

		this.state = State.Busy;

		try {
			// Add view
			const container = document.createElement('div');
			container.classList.add('split-view-view');

			if (index === this.viewItems.length)
				this.viewContainer.appendChild(container);
			else
				this.viewContainer.insertBefore(container, this.viewContainer.children.item(index));

			const _onChangeDisposable = () => {
				// Handle view change
			};

			let viewSize: number | { cachedVisibleSize: number; };

			if (typeof size === 'number') {
				viewSize = size;
			}
			else {
				if (size.type === 'auto') {
					if (this.areViewsDistributed())
						size = { type: 'distribute' };
					else
						size = { type: 'split', index: size.index };
				}

				if (size.type === 'split') {
					// Validate the split index
					if (size.index < 0 || size.index >= this.viewItems.length)
						throw new Error(`Invalid split index: ${ size.index }. Must be between 0 and ${ this.viewItems.length - 1 }`);

					const targetViewSize = this.getViewSize(size.index);
					const splitSize = targetViewSize / 2;

					// Check if splitting would violate minimum size constraints
					const targetView = this.viewItems[size.index]!;
					if (splitSize < targetView.minimumSize)
						throw new Error(`Cannot split: target view would be too small (${ splitSize } < ${ targetView.minimumSize })`);
					if (splitSize < view.minimumSize)
						throw new Error(`Cannot split: new view would be too small (${ splitSize } < ${ view.minimumSize })`);

					viewSize = splitSize;
					// Shrink the target view to make space for the new view
					targetView.size = splitSize;
				}
				else if (size.type === 'invisible') {
					// Validate cached visible size
					if (size.cachedVisibleSize < 0)
						throw new Error(`Invalid cachedVisibleSize: ${ size.cachedVisibleSize }. Must be non-negative`);
					if (size.cachedVisibleSize < view.minimumSize)
						throw new Error(`Invalid cachedVisibleSize: ${ size.cachedVisibleSize } < minimum size ${ view.minimumSize }`);
					if (size.cachedVisibleSize > view.maximumSize)
						throw new Error(`Invalid cachedVisibleSize: ${ size.cachedVisibleSize } > maximum size ${ view.maximumSize }`);

					viewSize = { cachedVisibleSize: size.cachedVisibleSize };
				}
				else {
					viewSize = view.minimumSize;
				}
			}

			const item = this.orientation === Orientation.VERTICAL
				? new VerticalViewItem(container, view, viewSize)
				: new HorizontalViewItem(container, view, viewSize);

			this.viewItems.splice(index, 0, item);

			// Add sash
			if (this.viewItems.length > 1) {
				const sash = new Sash(this.sashContainer, this, {
					orientation: this.orientation === Orientation.VERTICAL ?
						Orientation.HORIZONTAL : Orientation.VERTICAL,
				});

				sash.onDidStart((event: ISashEvent) => this.onSashStart(sash, event));
				sash.onDidChange(this.onSashChange.bind(this));
				sash.onDidEnd(this.onSashEnd.bind(this));
				sash.onDidReset(() => {
					const sashIndex = this.sashItems.findIndex(item => item.sash === sash);
					this.fireOnDidSashReset(sashIndex);
				});

				const disposable = () => {
					// Cleanup
				};

				const sashItem: ISashItem = { sash, disposable };
				this.sashItems.splice(index - 1, 0, sashItem);
			}

			if (!skipLayout)
				this.reLayout();

			if (!skipLayout && typeof size !== 'number' && size.type === 'distribute')
				this.distributeViewSizes();
		}
		finally {
			this.state = State.Idle;
		}
	}

	private onSashStart(sash: Sash, { currentX, currentY }: ISashEvent): void {
		// Disable all views during drag
		for (const item of this.viewItems)
			item.enabled = false;

		// Store original pointer event states and disable pointer events on all other sashes during drag
		this.sashPointerStatesBeforeDrag = [];
		for (const sashItem of this.sashItems) {
			this.sashPointerStatesBeforeDrag.push(sashItem.sash.pointerEventsEnabled);
			if (sashItem.sash !== sash)
				sashItem.sash.pointerEventsEnabled = false;
		}

		const index = this.sashItems.findIndex(item => item.sash === sash);
		const start = this.orientation === Orientation.VERTICAL ? currentY : currentX;

		this.sashDragState = {
			index,
			startPosition:   start,
			currentPosition: start,
			startSizes:      this.viewItems.map(i => i.size),
			minDelta:        0,
			maxDelta:        0,
		};

		this.resetSashDragState();
	}

	private onSashChange({ currentX, currentY }: ISashEvent): void {
		if (!this.sashDragState)
			return;

		const current = this.orientation === Orientation.VERTICAL ? currentY : currentX;
		this.sashDragState.currentPosition = current;

		// Use absolute positioning approach: calculate new sizes based on mouse position
		// relative to the container edge, but ensure all views respect their constraints
		const sashIndex = this.sashDragState.index;

		// Calculate new sizes for all views
		const viewStates: ViewState[] = [];

		if (this.proportionalResize) {
			// Proportional resize behavior: distribute changes proportionally across view groups
			// - A sash divides views into "left side" (views 0 to sashIndex) and "right side" (views sashIndex+1 to end)
			// - Dragging left: left side shrinks proportionally, right side grows proportionally
			// - Dragging right: left side grows proportionally, right side shrinks proportionally

			// Initialize all view states with current sizes
			for (const viewItem of this.viewItems) {
				viewStates.push({
					size:              viewItem.size,
					visible:           viewItem.visible,
					cachedVisibleSize: viewItem.cachedVisibleSize,
				});
			}

			// Calculate the total movement (how much space is being redistributed)
			const currentSashPosition = this.viewItems.slice(0, sashIndex + 1).reduce((sum, item) => sum + item.size, 0);
			let requestedSashPosition = current;

			// Calculate constraints to prevent views from going out of bounds
			let leftMinimumTotal = 0;
			let rightMinimumTotal = 0;

			for (let i = 0; i <= sashIndex; i++)
				leftMinimumTotal += this.viewItems[i]!.minimumSize;

			for (let i = sashIndex + 1; i < this.viewItems.length; i++)
				rightMinimumTotal += this.viewItems[i]!.minimumSize;

			// Constrain the requested position to respect minimum sizes
			const minSashPosition = leftMinimumTotal;
			const maxSashPosition = this.size - rightMinimumTotal;
			requestedSashPosition = Math.max(minSashPosition, Math.min(maxSashPosition, requestedSashPosition));

			const totalMovement = requestedSashPosition - currentSashPosition;

			if (Math.abs(totalMovement) > 0.1) {
				// Get left side views (0 to sashIndex) and right side views (sashIndex+1 to end)
				interface ViewGroup {
					index:       number;
					currentSize: number;
				}

				const leftViews: ViewGroup[] = [];
				const rightViews: ViewGroup[] = [];
				let leftTotalSize = 0;
				let rightTotalSize = 0;

				for (let i = 0; i <= sashIndex; i++) {
					const viewItem = this.viewItems[i]!;
					leftViews.push({ index: i, currentSize: viewItem.size });
					leftTotalSize += viewItem.size;
				}

				for (let i = sashIndex + 1; i < this.viewItems.length; i++) {
					const viewItem = this.viewItems[i]!;
					rightViews.push({ index: i, currentSize: viewItem.size });
					rightTotalSize += viewItem.size;
				}

				// Distribute the movement proportionally
				if (totalMovement > 0) {
					// Moving right: left side grows, right side shrinks
					if (leftTotalSize > 0) {
						const newLeftTotalSize = leftTotalSize + totalMovement;
						for (const leftView of leftViews) {
							const proportion = leftView.currentSize / leftTotalSize;
							const newSize = newLeftTotalSize * proportion;
							const clampedSize = Math.max(
								this.viewItems[leftView.index]!.minimumSize,
								Math.min(this.viewItems[leftView.index]!.maximumSize, newSize),
							);
							viewStates[leftView.index]!.size = clampedSize;
						}
					}

					if (rightTotalSize > 0) {
						const newRightTotalSize = rightTotalSize - totalMovement;
						for (const rightView of rightViews) {
							const proportion = rightView.currentSize / rightTotalSize;
							const newSize = newRightTotalSize * proportion;
							const clampedSize = Math.max(
								this.viewItems[rightView.index]!.minimumSize,
								Math.min(this.viewItems[rightView.index]!.maximumSize, newSize),
							);
							viewStates[rightView.index]!.size = clampedSize;
						}
					}
				}
				else {
					// Moving left: left side shrinks, right side grows
					const movementMagnitude = -totalMovement;

					if (leftTotalSize > 0) {
						const newLeftTotalSize = leftTotalSize - movementMagnitude;
						for (const leftView of leftViews) {
							const proportion = leftView.currentSize / leftTotalSize;
							const newSize = newLeftTotalSize * proportion;
							const clampedSize = Math.max(
								this.viewItems[leftView.index]!.minimumSize,
								Math.min(this.viewItems[leftView.index]!.maximumSize, newSize),
							);
							viewStates[leftView.index]!.size = clampedSize;
						}
					}

					if (rightTotalSize > 0) {
						const newRightTotalSize = rightTotalSize + movementMagnitude;
						for (const rightView of rightViews) {
							const proportion = rightView.currentSize / rightTotalSize;
							const newSize = newRightTotalSize * proportion;
							const clampedSize = Math.max(
								this.viewItems[rightView.index]!.minimumSize,
								Math.min(this.viewItems[rightView.index]!.maximumSize, newSize),
							);
							viewStates[rightView.index]!.size = clampedSize;
						}
					}
				}
			}
		}
		else {
			// Sequential neighbor resize behavior: take space from nearest neighbors first
			// Initialize all view states with current sizes
			for (const viewItem of this.viewItems) {
				viewStates.push({
					size:              viewItem.size,
					visible:           viewItem.visible,
					cachedVisibleSize: viewItem.cachedVisibleSize,
				});
			}

			// Calculate the total movement and constrain it to available space
			const currentSashPosition = this.viewItems.slice(0, sashIndex + 1).reduce((sum, item) => sum + item.size, 0);
			let requestedSashPosition = current;

			// Calculate maximum available space in each direction
			let maxRightMovement = 0;  // How much we can move right (take from right neighbors)
			let maxLeftMovement = 0;   // How much we can move left (take from left neighbors)

			// Calculate available space from right neighbors
			for (let i = sashIndex + 1; i < this.viewItems.length; i++) {
				const viewItem = this.viewItems[i]!;
				maxRightMovement += viewItem.size - viewItem.minimumSize;
			}

			// Calculate available space from left neighbors
			for (let i = 0; i <= sashIndex; i++) {
				const viewItem = this.viewItems[i]!;
				maxLeftMovement += viewItem.size - viewItem.minimumSize;
			}

			// Constrain the requested position to available space
			const minSashPosition = currentSashPosition - maxLeftMovement;
			const maxSashPosition = currentSashPosition + maxRightMovement;
			requestedSashPosition = Math.max(minSashPosition, Math.min(maxSashPosition, requestedSashPosition));

			const totalMovement = requestedSashPosition - currentSashPosition;

			if (Math.abs(totalMovement) > 0.1) {
				if (totalMovement > 0) {
					// Moving right: grow the immediate left neighbor, shrink right neighbors sequentially
					let remainingMovement = totalMovement;

					// First, calculate how much space we actually need and can get from right neighbors
					let availableSpace = 0;
					for (let i = sashIndex + 1; i < this.viewItems.length; i++) {
						const viewItem = this.viewItems[i]!;
						availableSpace += viewItem.size - viewItem.minimumSize;
					}

					// Limit movement to available space
					const actualMovement = Math.min(totalMovement, availableSpace);
					remainingMovement = actualMovement;

					// Grow only the immediate left neighbor (the view at sashIndex)
					const leftNeighbor = this.viewItems[sashIndex]!;
					const newLeftNeighborSize = leftNeighbor.size + actualMovement;
					const clampedLeftNeighborSize = Math.max(
						leftNeighbor.minimumSize,
						Math.min(leftNeighbor.maximumSize, newLeftNeighborSize),
					);
					viewStates[sashIndex]!.size = clampedLeftNeighborSize;

					// Take space from right neighbors sequentially (nearest first)
					for (let i = sashIndex + 1; i < this.viewItems.length && remainingMovement > 0.1; i++) {
						const viewItem = this.viewItems[i]!;
						const currentSize = viewStates[i]!.size;
						const availableSpace = currentSize - viewItem.minimumSize;
						const spaceToTake = Math.min(availableSpace, remainingMovement);

						if (spaceToTake > 0) {
							viewStates[i]!.size = currentSize - spaceToTake;
							remainingMovement -= spaceToTake;
						}
					}
				}
				else {
					// Moving left: grow the immediate right neighbor, shrink left neighbors sequentially
					const movementMagnitude = -totalMovement;

					// First, calculate how much space we actually need and can get from left neighbors
					let availableSpace = 0;
					for (let i = 0; i <= sashIndex; i++) {
						const viewItem = this.viewItems[i]!;
						availableSpace += viewItem.size - viewItem.minimumSize;
					}

					// Limit movement to available space
					const actualMovement = Math.min(movementMagnitude, availableSpace);
					let remainingMovement = actualMovement;

					// Grow only the immediate right neighbor (the view at sashIndex + 1)
					if (sashIndex + 1 < this.viewItems.length) {
						const rightNeighbor = this.viewItems[sashIndex + 1]!;
						const newRightNeighborSize = rightNeighbor.size + actualMovement;
						const clampedRightNeighborSize = Math.max(
							rightNeighbor.minimumSize,
							Math.min(rightNeighbor.maximumSize, newRightNeighborSize),
						);
						viewStates[sashIndex + 1]!.size = clampedRightNeighborSize;
					}

					// Take space from left neighbors sequentially (nearest first)
					for (let i = sashIndex; i >= 0 && remainingMovement > 0.1; i--) {
						const viewItem = this.viewItems[i]!;
						const currentSize = viewStates[i]!.size;
						const availableSpace = currentSize - viewItem.minimumSize;
						const spaceToTake = Math.min(availableSpace, remainingMovement);

						if (spaceToTake > 0) {
							viewStates[i]!.size = currentSize - spaceToTake;
							remainingMovement -= spaceToTake;
						}
					}
				}
			}
		}

		// Validate and adjust total size to match container
		let totalCalculatedSize = 0;
		for (const state of viewStates)
			totalCalculatedSize += state.size;

		const sizeDifference = this.size - totalCalculatedSize;
		if (Math.abs(sizeDifference) > 0.1) {
			// Distribute the difference proportionally among all views
			const adjustmentRatio = this.size / totalCalculatedSize;
			for (const state of viewStates) {
				state.size = Math.max(
					this.viewItems[viewStates.indexOf(state)]!.minimumSize,
					state.size * adjustmentRatio,
				);
			}
		}

		// Apply the changes back to view items
		for (let i = 0; i < this.viewItems.length; i++) {
			const item = this.viewItems[i]!;
			const state = viewStates[i]!;
			item.size = state.size;
			if (state.visible !== item.visible)
				item.setVisible(state.visible, state.cachedVisibleSize);
		}

		this.layoutViews();
	}

	private onSashEnd(): void {
		if (!this.sashDragState)
			return;

		// Re-enable all views
		for (const item of this.viewItems)
			item.enabled = true;

		// Restore original pointer event states
		for (let i = 0; i < this.sashItems.length && i < this.sashPointerStatesBeforeDrag.length; i++)
			this.sashItems[i]!.sash.pointerEventsEnabled = this.sashPointerStatesBeforeDrag[i]!;

		this.sashPointerStatesBeforeDrag = [];

		this.fireOnDidSashChange(this.sashDragState.index);
		this.saveProportions();

		this.sashDragState = undefined;
	}

	private resetSashDragState(): void {
		if (!this.sashDragState)
			return;

		const { index } = this.sashDragState;

		let minDelta = Number.NEGATIVE_INFINITY;
		let maxDelta = Number.POSITIVE_INFINITY;

		// Normal behavior - calculate constraints from all views
		const upIndexes: number[] = [];
		for (let i = index; i >= 0; i--)
			upIndexes.push(i);

		const downIndexes: number[] = [];
		for (let i = index + 1; i < this.viewItems.length; i++)
			downIndexes.push(i);

		const viewStates: ViewState[] = this.viewItems.map(item => ({
			size:              item.size,
			visible:           item.visible,
			cachedVisibleSize: item.cachedVisibleSize,
		}));

		const constraints: ViewConstraints[] = this.viewItems.map(item => ({
			minimumSize: item.minimumSize,
			maximumSize: item.maximumSize,
		}));

		const { minDelta: calcMinDelta, maxDelta: calcMaxDelta } = calculateDeltaConstraints(
			index,
			viewStates,
			constraints,
		);

		minDelta = calcMinDelta;
		maxDelta = calcMaxDelta;

		this.sashDragState.minDelta = minDelta;
		this.sashDragState.maxDelta = maxDelta;
	}

	private reLayout(): void {
		const contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
		this.resize(this.viewItems.length - 1, this.size - contentSize);
		this.distributeEmptySpace();
		this.layoutViews();
		this.saveProportions();
	}

	resize(
		index: number,
		delta: number,
	): number {
		const viewStates: ViewState[] = this.viewItems.map(item => ({
			size:              item.size,
			visible:           item.visible,
			cachedVisibleSize: item.cachedVisibleSize,
		}));

		const constraints: ViewConstraints[] = this.viewItems.map(item => ({
			minimumSize: item.minimumSize,
			maximumSize: item.maximumSize,
		}));

		const actualDelta = resize(index, delta, viewStates, constraints);

		// Apply the changes back to view items
		for (let i = 0; i < this.viewItems.length; i++) {
			const item = this.viewItems[i]!;
			const state = viewStates[i]!;
			item.size = state.size;
		}

		return actualDelta;
	}

	private distributeEmptySpace(): void {
		const contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
		const emptyDelta = this.size - contentSize;

		const viewStates: ViewState[] = this.viewItems.map(item => ({
			size:              item.size,
			visible:           item.visible,
			cachedVisibleSize: item.cachedVisibleSize,
		}));

		const constraints: ViewConstraints[] = this.viewItems.map(item => ({
			minimumSize: item.minimumSize,
			maximumSize: item.maximumSize,
		}));

		distributeEmptySpace(emptyDelta, viewStates, constraints);

		// Apply the changes back to view items
		for (let i = 0; i < this.viewItems.length; i++) {
			const item = this.viewItems[i]!;
			const state = viewStates[i]!;
			item.size = state.size;
		}
	}

	private layoutViews(): void {
		// Save new content size
		this._contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);

		// Layout views
		let offset = 0;
		for (const viewItem of this.viewItems) {
			viewItem.layout(offset, this.layoutContext);
			offset += viewItem.size;
		}

		// Layout sashes
		for (const sashItem of this.sashItems)
			sashItem.sash.layout();

		this.updateSashEnablement();
	}

	private updateSashEnablement(): void {
		// Calculate which sashes can be moved
		let previous = false;
		const collapsesDown = this.viewItems.map(i => {
			previous = (i.size - i.minimumSize > 0) || previous;

			return previous;
		});

		previous = false;
		const expandsDown = this.viewItems.map(i => {
			previous = (i.maximumSize - i.size > 0) || previous;

			return previous;
		});

		const reverseViews = [ ...this.viewItems ].reverse();
		previous = false;
		const collapsesUp = reverseViews.map(i => {
			previous = (i.size - i.minimumSize > 0) || previous;

			return previous;
		}).reverse();

		previous = false;
		const expandsUp = reverseViews.map(i => {
			previous = (i.maximumSize - i.size > 0) || previous;

			return previous;
		}).reverse();

		for (let index = 0; index < this.sashItems.length; index++) {
			const { sash } = this.sashItems[index]!;

			const min = !(collapsesDown[index] && expandsUp[index + 1]);
			const max = !(expandsDown[index] && collapsesUp[index + 1]);

			if (min && max)
				sash.state = SashState.Disabled;
			else if (min && !max)
				sash.state = SashState.AtMinimum;
			else if (!min && max)
				sash.state = SashState.AtMaximum;
			else
				sash.state = SashState.Enabled;
		}
	}

	private saveProportions(): void {
		// Always save proportions for container resize, regardless of proportionalResize setting
		// The proportionalResize setting only affects sash dragging behavior
		if (this._contentSize > 0)
			this.proportions = this.viewItems.map(v => v.visible ? v.size / this._contentSize : undefined);
	}

	private areViewsDistributed(): boolean {
		const viewStates: ViewState[] = this.viewItems.map(item => ({
			size:              item.size,
			visible:           item.visible,
			cachedVisibleSize: item.cachedVisibleSize,
		}));

		return areViewsDistributed(viewStates);
	}

	distributeViewSizes(): void {
		// Distribute sizes equally among flexible views
		const flexibleViewItems: ViewItem<TLayoutContext, TView>[] = [];
		let flexibleSize = 0;

		for (const item of this.viewItems) {
			if (item.maximumSize - item.minimumSize > 0) {
				flexibleViewItems.push(item);
				flexibleSize += item.size;
			}
		}

		const size = Math.floor(flexibleSize / flexibleViewItems.length);

		for (const item of flexibleViewItems)
			item.size = clamp(size, item.minimumSize, item.maximumSize);

		// Apply any remaining size adjustments
		const contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
		const delta = this.size - contentSize;

		if (delta !== 0)
			this.resize(this.viewItems.length - 1, delta);

		this.distributeEmptySpace();
		this.layoutViews();
		this.saveProportions();
	}

	dispose(): void {
		// Dispose resize observer
		this.disableAutoResize();

		// Dispose all sashes
		for (const sashItem of this.sashItems) {
			sashItem.sash.dispose();
			sashItem.disposable();
		}

		// Dispose all view items
		for (const viewItem of this.viewItems)
			viewItem.dispose();

		// Clean up callbacks
		this.onDidSashChangeCallbacks.length = 0;
		this.onDidSashResetCallbacks.length = 0;

		// Remove the element
		this.el.remove();
	}

}
