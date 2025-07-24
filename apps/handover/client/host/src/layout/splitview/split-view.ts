import { type ISashLayoutProvider, Sash } from './sash.ts';
import {
	type DragState,
	type ISashEvent,
	type ISplitViewOptions,
	type IView,
	LayoutPriority,
	Orientation,
	SashState,
	type Sizing,
	type SnapState,
	type ViewConstraints,
	type ViewState,
} from './types.ts';
import {
	areViewsDistributed,
	calculateDeltaConstraints,
	clamp,
	distributeEmptySpace,
	findFirstSnapIndex,
	resize,
} from './utils.ts';

interface ISashItem {
	sash:       Sash;
	disposable: () => void;
}

abstract class ViewItem<TLayoutContext, TView extends IView<TLayoutContext>> {

	private _size:              number;
	private _cachedVisibleSize: number | undefined = undefined;

	set enabled(enabled: boolean) {
		this.container.style.pointerEvents = enabled ? '' : 'none';
	}

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

	get priority(): LayoutPriority | undefined {
		return this.view.priority;
	}

	get proportionalLayout(): boolean {
		return this.view.proportionalLayout ?? true;
	}

	get snap(): boolean {
		return Boolean(this.view.snap);
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
export class SplitView<TLayoutContext = undefined, TView extends IView<TLayoutContext> = IView<TLayoutContext>>
implements ISashLayoutProvider {

	readonly orientation: Orientation;
	readonly el:          HTMLElement;

	private sashContainer:      HTMLElement;
	private viewContainer:      HTMLElement;
	private size = 0;
	private layoutContext:      TLayoutContext | undefined;
	private _contentSize = 0;
	private proportions:        (number | undefined)[] | undefined = undefined;
	private viewItems:          ViewItem<TLayoutContext, TView>[] = [];
	private sashItems:          ISashItem[] = [];
	private sashDragState:      DragState | undefined;
	private state:              State = State.Idle;
	private proportionalLayout: boolean;
	private inverseAltBehavior: boolean;

	private readonly onDidSashChangeCallbacks: ((index: number) => void)[] = [];
	private readonly onDidSashResetCallbacks:  ((index: number) => void)[] = [];

	get contentSize(): number {
		return this._contentSize;
	}

	get length(): number {
		return this.viewItems.length;
	}

	get minimumSize(): number {
		return this.viewItems.reduce((r, item) => r + item.minimumSize, 0);
	}

	get maximumSize(): number {
		return this.length === 0 ? Number.POSITIVE_INFINITY :
			this.viewItems.reduce((r, item) => r + item.maximumSize, 0);
	}

	constructor(container: HTMLElement, options: ISplitViewOptions<TLayoutContext> = {}) {
		this.orientation = options.orientation ?? Orientation.VERTICAL;
		this.proportionalLayout = options.proportionalLayout ?? true;
		this.inverseAltBehavior = options.inverseAltBehavior ?? false;

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

			// Save reference view, in case of `split` sizing
			const referenceViewItem = sizing?.type === 'split' ?
				this.viewItems[sizing.index] : undefined;

			// Remove view
			const viewItemToRemove = this.viewItems.splice(index, 1)[0]!;

			// Resize reference view, in case of `split` sizing
			if (referenceViewItem)
				referenceViewItem.size += viewItemToRemove.size;

			// Remove sash
			if (this.viewItems.length >= 1) {
				const sashIndex = Math.max(index - 1, 0);
				const sashItem = this.sashItems.splice(sashIndex, 1)[0]!;
				sashItem.sash.dispose();
				sashItem.disposable();
			}

			this.relayout();

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

	layout(size: number, layoutContext?: TLayoutContext): void {
		const previousSize = Math.max(this.size, this._contentSize);
		this.size = size;
		this.layoutContext = layoutContext;

		if (!this.proportions) {
			const indexes: number[] = [];
			for (let i = this.viewItems.length - 1; i >= 0; i--)
				indexes.push(i);

			const lowPriorityIndexes = indexes.filter(i =>
				this.viewItems[i]!.priority === LayoutPriority.Low);
			const highPriorityIndexes = indexes.filter(i =>
				this.viewItems[i]!.priority === LayoutPriority.High);

			this.resize(this.viewItems.length - 1, size - previousSize, lowPriorityIndexes, highPriorityIndexes);
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

				if (size.type === 'split')
					viewSize = this.getViewSize(size.index) / 2;
				else if (size.type === 'invisible')
					viewSize = { cachedVisibleSize: size.cachedVisibleSize };
				else
					viewSize = view.minimumSize;
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
				this.relayout();

			if (!skipLayout && typeof size !== 'number' && size.type === 'distribute')
				this.distributeViewSizes();
		}
		finally {
			this.state = State.Idle;
		}
	}

	private onSashStart(sash: Sash, { currentX, currentY, altKey }: ISashEvent): void {
		// Disable all views during drag
		for (const item of this.viewItems)
			item.enabled = false;

		const index = this.sashItems.findIndex(item => item.sash === sash);
		const start = this.orientation === Orientation.VERTICAL ? currentY : currentX;

		this.sashDragState = {
			index,
			startPosition:   start,
			currentPosition: start,
			startSizes:      this.viewItems.map(i => i.size),
			minDelta:        0,
			maxDelta:        0,
			altKeyPressed:   altKey,
		};

		this.resetSashDragState(start, altKey);
	}

	private onSashChange({ currentX, currentY }: ISashEvent): void {
		if (!this.sashDragState)
			return;

		const current = this.orientation === Orientation.VERTICAL ? currentY : currentX;
		this.sashDragState.currentPosition = current;

		// Use absolute positioning approach: calculate new sizes based on mouse position
		// relative to the container edge, but ensure all views respect their constraints
		const sashIndex = this.sashDragState.index;

		// Calculate minimum space needed for all views after the sash
		let minSpaceForRemainingViews = 0;
		for (let i = sashIndex + 1; i < this.viewItems.length; i++)
			minSpaceForRemainingViews += this.viewItems[i]!.minimumSize;

		// Calculate maximum space available for views before and including the sash
		const maxSpaceForViewsBeforeSash = this.size - minSpaceForRemainingViews;

		// Calculate actual space taken by views before the sash
		let actualSpaceForViewsBeforeSash = 0;
		for (let i = 0; i < sashIndex; i++)
			actualSpaceForViewsBeforeSash += this.viewItems[i]!.size;

		// The requested size for the view at sashIndex
		// Mouse position minus the actual space taken by all views before this sash
		let requestedSizeForSashView = current - actualSpaceForViewsBeforeSash;

		// Clamp the requested size to respect constraints
		const sashView = this.viewItems[sashIndex]!;
		const maxAllowedForSashView = maxSpaceForViewsBeforeSash - actualSpaceForViewsBeforeSash;
		requestedSizeForSashView = Math.max(
			sashView.minimumSize,
			Math.min(sashView.maximumSize, Math.min(requestedSizeForSashView, maxAllowedForSashView)),
		);		// Calculate new sizes for all views
		const viewStates: ViewState[] = [];

		if (this.proportionalLayout) {
			// For proportional layout:
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
			// Non-proportional layout: only adjust adjacent view
			let currentPosition = 0;

			// Handle views before the sash (keep their current sizes)
			for (let i = 0; i < sashIndex; i++) {
				const viewItem = this.viewItems[i]!;
				viewStates.push({
					size:              viewItem.size,
					visible:           viewItem.visible,
					cachedVisibleSize: viewItem.cachedVisibleSize,
				});
				currentPosition += viewItem.size;
			}

			// Handle the view at the sash index (the one being resized)
			viewStates.push({
				size:              requestedSizeForSashView,
				visible:           sashView.visible,
				cachedVisibleSize: sashView.cachedVisibleSize,
			});
			currentPosition += requestedSizeForSashView;

			// Handle views after the sash (distribute remaining space)
			const remainingSpace = this.size - currentPosition;
			const remainingViews = this.viewItems.length - sashIndex - 1;

			if (remainingViews > 0) {
				const spacePerView = remainingSpace / remainingViews;

				for (let i = sashIndex + 1; i < this.viewItems.length; i++) {
					const viewItem = this.viewItems[i]!;
					const newSize = Math.max(viewItem.minimumSize, spacePerView);

					viewStates.push({
						size:              newSize,
						visible:           viewItem.visible,
						cachedVisibleSize: viewItem.cachedVisibleSize,
					});
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

		this.fireOnDidSashChange(this.sashDragState.index);
		this.saveProportions();

		this.sashDragState = undefined;
	}

	private resetSashDragState(start: number, alt: boolean): void {
		if (!this.sashDragState)
			return;

		const { index } = this.sashDragState;

		if (this.inverseAltBehavior)
			alt = !alt;

		let minDelta = Number.NEGATIVE_INFINITY;
		let maxDelta = Number.POSITIVE_INFINITY;
		let snapBefore: SnapState | undefined;
		let snapAfter: SnapState | undefined;

		if (alt) {
			// Alt behavior - resize only adjacent views
			const isLastSash = index === this.sashItems.length - 1;

			if (isLastSash) {
				const viewItem = this.viewItems[index]!;
				minDelta = (viewItem.minimumSize - viewItem.size) / 2;
				maxDelta = (viewItem.maximumSize - viewItem.size) / 2;
			}
			else {
				const viewItem = this.viewItems[index + 1]!;
				minDelta = (viewItem.size - viewItem.maximumSize) / 2;
				maxDelta = (viewItem.size - viewItem.minimumSize) / 2;
			}
		}
		else {
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
				minimumSize:        item.minimumSize,
				maximumSize:        item.maximumSize,
				priority:           item.priority ?? LayoutPriority.Normal,
				snap:               item.snap,
				proportionalLayout: item.proportionalLayout,
			}));

			const { minDelta: calcMinDelta, maxDelta: calcMaxDelta } = calculateDeltaConstraints(
				index,
				viewStates,
				constraints,
			);

			minDelta = calcMinDelta;
			maxDelta = calcMaxDelta;

			// Calculate snap states
			const snapBeforeIndex = findFirstSnapIndex(upIndexes, viewStates, constraints);
			const snapAfterIndex = findFirstSnapIndex(downIndexes, viewStates, constraints);

			if (typeof snapBeforeIndex === 'number') {
				const viewItem = this.viewItems[snapBeforeIndex]!;
				const halfSize = Math.floor(viewItem.viewMinimumSize / 2);

				snapBefore = {
					index:      snapBeforeIndex,
					limitDelta: viewItem.visible ? minDelta - halfSize : minDelta + halfSize,
					size:       viewItem.size,
				};
			}

			if (typeof snapAfterIndex === 'number') {
				const viewItem = this.viewItems[snapAfterIndex]!;
				const halfSize = Math.floor(viewItem.viewMinimumSize / 2);

				snapAfter = {
					index:      snapAfterIndex,
					limitDelta: viewItem.visible ? maxDelta + halfSize : maxDelta - halfSize,
					size:       viewItem.size,
				};
			}
		}

		this.sashDragState.minDelta = minDelta;
		this.sashDragState.maxDelta = maxDelta;
		this.sashDragState.snapBefore = snapBefore;
		this.sashDragState.snapAfter = snapAfter;
	}

	private relayout(): void {
		const contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
		this.resize(this.viewItems.length - 1, this.size - contentSize);
		this.distributeEmptySpace();
		this.layoutViews();
		this.saveProportions();
	}

	private resize(
		index: number,
		delta: number,
		lowPriorityIndexes?: number[],
		highPriorityIndexes?: number[],
	): number {
		const viewStates: ViewState[] = this.viewItems.map(item => ({
			size:              item.size,
			visible:           item.visible,
			cachedVisibleSize: item.cachedVisibleSize,
		}));

		const constraints: ViewConstraints[] = this.viewItems.map(item => ({
			minimumSize:        item.minimumSize,
			maximumSize:        item.maximumSize,
			priority:           item.priority ?? LayoutPriority.Normal,
			snap:               item.snap,
			proportionalLayout: item.proportionalLayout,
		}));

		// Apply priority ordering
		if (highPriorityIndexes) {
			// Move high priority indexes to the front
			for (const priorityIndex of highPriorityIndexes)
				constraints[priorityIndex]!.priority = LayoutPriority.High;
		}

		if (lowPriorityIndexes) {
			// Move low priority indexes to the back
			for (const priorityIndex of lowPriorityIndexes)
				constraints[priorityIndex]!.priority = LayoutPriority.Low;
		}

		const actualDelta = resize(index, delta, viewStates, constraints);

		// Apply the changes back to view items
		for (let i = 0; i < this.viewItems.length; i++) {
			const item = this.viewItems[i]!;
			const state = viewStates[i]!;
			item.size = state.size;
		}

		return actualDelta;
	}

	private distributeEmptySpace(lowPriorityIndex?: number): void {
		const contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
		const emptyDelta = this.size - contentSize;

		const viewStates: ViewState[] = this.viewItems.map(item => ({
			size:              item.size,
			visible:           item.visible,
			cachedVisibleSize: item.cachedVisibleSize,
		}));

		const constraints: ViewConstraints[] = this.viewItems.map(item => ({
			minimumSize:        item.minimumSize,
			maximumSize:        item.maximumSize,
			priority:           item.priority ?? LayoutPriority.Normal,
			snap:               item.snap,
			proportionalLayout: item.proportionalLayout,
		}));

		distributeEmptySpace(emptyDelta, viewStates, constraints, lowPriorityIndex);

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
		if (this.proportionalLayout && this._contentSize > 0) {
			this.proportions = this.viewItems.map(v =>
				v.proportionalLayout && v.visible ? v.size / this._contentSize : undefined);
		}
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

		// Calculate priority indexes for proper distribution
		const indexes: number[] = [];
		for (let i = 0; i < this.viewItems.length; i++)
			indexes.push(i);

		const lowPriorityIndexes = indexes.filter(i =>
			this.viewItems[i]!.priority === LayoutPriority.Low);
		const highPriorityIndexes = indexes.filter(i =>
			this.viewItems[i]!.priority === LayoutPriority.High);

		// Apply any remaining size adjustments with priority consideration
		const contentSize = this.viewItems.reduce((r, i) => r + i.size, 0);
		const delta = this.size - contentSize;

		if (delta !== 0)
			this.resize(this.viewItems.length - 1, delta, lowPriorityIndexes, highPriorityIndexes);

		this.distributeEmptySpace();
		this.layoutViews();
		this.saveProportions();
	}

	dispose(): void {
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
