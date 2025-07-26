import { computed, type ReadonlySignal } from '@arcmantle/adapter-element/shared';

import { type DragDropConfig, DragDropManager } from './drag-drop-manager.ts';
import { SplitView } from './split-view.ts';
import { Orientation, Sizing } from './types.ts';
import { SignalMap } from './utilities/signal-map.ts';
import { EditorView } from './views/editor-view.ts';
import { NestedView } from './views/nested-view.ts';
import { type EditorTemplateFunction, type IEditorView, isEditorView, isNestedView, isTabView } from './views/shared.ts';
import { TabView } from './views/tab-view.ts';


export class ViewManager {

	// Single source of truth for all views using SignalMap for automatic reactivity
	private _allViews: SignalMap<string, IEditorView> = new SignalMap();

	// Computed signals for filtered view types
	readonly nestedViews: ReadonlySignal<NestedView[]> = computed(() => {
		return Array.from(this._allViews.values())
			.filter((view): view is NestedView => isNestedView(view));
	});

	readonly tabViews: ReadonlySignal<TabView[]> = computed(() => {
		return Array.from(this._allViews.values())
			.filter((view): view is TabView => isTabView(view));
	});

	readonly views: ReadonlySignal<IEditorView[]> = computed(() => {
		return Array.from(this._allViews.values());
	});

	private view:            SplitView<undefined, IEditorView> | null = null;
	private dragDropManager: DragDropManager | null = null;

	/**
	 * Add a view to the central tracking map
	 */
	addViewToTracking(view: IEditorView): void {
		this._allViews.set(view.id, view);
	}

	/**
	 * Remove a view from the central tracking map
	 */
	private removeViewFromMap(viewId: string): boolean {
		return this._allViews.delete(viewId);
	}

	/**
	 * Get a view by ID
	 */
	private getViewById(id: string): IEditorView | undefined {
		return this._allViews.get(id);
	}

	/**
	 * Find views that contain a specific editor (for nested searches)
	 */
	private findViewsContainingEditor(editorId: string): IEditorView[] {
		const containingViews: IEditorView[] = [];

		for (const view of this._allViews.values()) {
			switch (true) {
			case isTabView(view): {
				if (view.findEditor(editorId))
					containingViews.push(view);

				break;
			}
			case isNestedView(view): {
				if (view.findEditor(editorId))
					containingViews.push(view);

				break;
			}
			}
		}

		return containingViews;
	}

	constructor(
		private container: HTMLElement,
		private defaultTemplateFunction: EditorTemplateFunction,
		private dragDropConfig: DragDropConfig | undefined = undefined,
	) {}

	/**
	 * Initialize the ViewManager with a root split view
	 */
	initialize(orientation: Orientation = Orientation.VERTICAL): void {
		// Ensure container has dimensions before creating SplitView
		if (this.container.offsetWidth === 0 || this.container.offsetHeight === 0) {
			setTimeout(() => this.initialize(orientation), 50);

			return console.warn('ViewManager: Container has no dimensions, retrying...');
		}

		this.view = new SplitView(this.container, {
			orientation,
			proportionalResize: false,
		});

		this.view.enableAutoResize();

		// Initialize drag-drop manager
		this.dragDropManager = new DragDropManager(this, this.dragDropConfig);

		// Listen to the main split view's resize events to update nested views
		this.view.onDidSashChange(() => {
			// Force all nested split views to redistribute their spaces
			// This ensures proportional behavior is maintained during resize
			for (const nestedView of this.nestedViews.value)
				nestedView.finalizeLayout();
		});
	}

	/**
	 * Create a new NestedView with proper onRemoved callback for cleanup
	 */
	createNestedView(id: string, title: string, orientation: Orientation): NestedView {
		const nestedView = new NestedView(
			id,
			title,
			orientation,
			// onRemoved: called after successful removal for cleanup
			(editorId) => {
				// Remove the editor from central tracking and dispose it
				const editor = this.getViewById(editorId);
				if (isEditorView(editor)) {
					this.removeViewFromMap(editorId);
					editor.dispose();

					// If the NestedView is now empty, remove it from the main view
					if (nestedView.editorCount === 0) {
						const removedView = this.view?.removeViewByReference(nestedView);
						if (removedView) {
							nestedView.dispose();
							this.removeViewFromMap(nestedView.id);
						}
					}

					// If no TabViews remain, create a welcome editor
					if (this.tabViews.value.length === 0)
						this.createEditor('welcome', 'Welcome');
				}
			},
		);

		return nestedView;
	}

	/**
	 * Add a view to a NestedView with optional per-view onRemove callback
	 */
	addViewToNestedView(
		nestedView: NestedView,
		view: IEditorView,
		onRemove?: (id: string) => boolean | void,
	): void {
		// Register the view with the ViewManager first
		this.addViewToTracking(view);

		// Add to the NestedView with the optional callback
		nestedView.addEditorWithCallback(view, onRemove);

		// Initialize drag functionality for EditorViews
		if (isEditorView(view) && this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(view);
	}

	/**
	 * Create a new TabView with proper onRemoved callback for cleanup
	 */
	createTabView(
		id: string,
		title: string,
		onRemove?: (id: string) => boolean | void,
		onRemoved?: (id: string) => void,
		defaultTemplateFn?: EditorTemplateFunction,
	): TabView {
		const tabView = new TabView(
			id,
			title,
			onRemove,
			// onRemoved: called after successful removal for cleanup
			onRemoved || ((editorId) => {
				// Remove the editor from central tracking and dispose it
				const editor = this.getViewById(editorId);
				if (isEditorView(editor)) {
					this.removeViewFromMap(editorId);
					editor.dispose();

					// If the TabView is now empty, remove it from the main view
					if (tabView.editorCount === 0) {
						const removedView = this.view?.removeViewByReference(tabView);
						if (removedView) {
							tabView.dispose();
							this.removeViewFromMap(tabView.id);
						}
					}

					// If no TabViews remain, create a welcome editor
					if (this.tabViews.value.length === 0)
						this.createEditor('welcome', 'Welcome');
				}
			}),
			defaultTemplateFn,
		);

		return tabView;
	}

	/**
	 * Add an editor to a TabView with optional per-editor onRemove callback
	 */
	addEditorToTabView(
		tabView: TabView,
		editor: EditorView,
		onRemove?: (id: string) => boolean | void,
	): void {
		// Register the editor with the ViewManager first
		this.addViewToTracking(editor);

		// Add to the TabView with the optional callback
		tabView.addEditor(editor, onRemove);

		// Initialize drag functionality
		if (this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(editor);
	}

	/**
	 * Create a new TabView and add it to the view manager
	 */
	createAndAddTabView(
		id: string,
		title: string,
		sizing: number | Sizing = Sizing.Distribute,
		defaultTemplateFn?: EditorTemplateFunction,
	): TabView {
		const tabView = this.createTabView(id, title, undefined, undefined, defaultTemplateFn);
		this.addView(tabView, sizing);

		return tabView;
	}

	/**
	 * Create a new editor within a TabView (replaces standalone EditorView creation)
	 */
	createEditor(
		id: string,
		title: string,
		templateFunction?: EditorTemplateFunction,
		sizing: number | Sizing = Sizing.Distribute,
		onRemove?: (id: string) => boolean | void,
	): TabView {
		const templateFn = templateFunction || this.defaultTemplateFunction;

		// Create a TabView to contain the editor
		const tabViewId = `tab-${ id }`;
		const tabView = this.createTabView(tabViewId, title, undefined, undefined, templateFn);

		// Create the editor inside the TabView
		const editor = tabView.createEditor(id, title, templateFn, onRemove);

		// Add TabView to the main view
		if (this.view)
			this.view.addView(tabView, sizing);

		this.addViewToTracking(tabView);
		this.addViewToTracking(editor);

		// Initialize drag functionality for the editor
		if (this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(editor);

		return tabView;
	}

	/**
	 * Close an editor by ID
	 * This method handles editors within TabViews and NestedViews
	 */
	closeEditor(id: string): void {
		// Get the editor from central tracking
		const editor = this.getViewById(id);
		if (!isEditorView(editor)) {
			console.warn('Editor not found:', id);

			return;
		}

		// Find containing views (TabView or NestedView)
		const containingViews = this.findViewsContainingEditor(id);

		if (containingViews.length === 0) {
			console.warn('Editor not found in any container view:', id);

			return;
		}

		// Handle removal from containing view
		for (const containingView of containingViews) {
			if (isTabView(containingView)) {
				const tabView = containingView as TabView;
				const removed = tabView.removeEditor(id);
				if (removed) {
					// TabView handles cleanup via its callback system
					return;
				}
			}
			else if (isNestedView(containingView)) {
				const nestedView = containingView as NestedView;
				const removed = nestedView.removeEditor(id);
				if (removed) {
					// NestedView handles cleanup via its callback system
					return;
				}
			}
		}

		console.warn('Failed to remove editor from containing views:', id);
	}

	/**
	 * Add a new view with proportional sizing that preserves existing layout proportions
	 * @param view The view to add
	 * @param targetShare The fraction of total space the new view should get (e.g., 0.25 for 1/4)
	 */
	private addViewWithProportionalSizing(view: IEditorView, targetShare: number): void {
		if (!this.view)
			return;

		const totalSize = this.view.orientation === Orientation.HORIZONTAL
			? this.container.offsetWidth
			: this.container.offsetHeight;

		const targetSize = totalSize * targetShare;

		// Capture current sizes and calculate reduction factor
		const currentSizes = Array.from({ length: this.view.length }, (_, i) =>
			this.view!.getViewSize(i));
		const currentTotal = currentSizes.reduce((sum, size) => sum + size, 0);
		const reductionFactor = Math.max(0, (currentTotal - targetSize) / currentTotal);

		// Add new view and resize existing ones
		this.view.addView(view, targetSize);

		currentSizes.forEach((currentSize, i) => {
			const newSize = Math.max(100, currentSize * reductionFactor);
			this.view!.setViewSize(i, newSize);
		});
	}

	/**
	 * Split editor - add new editor either horizontally or vertically
	 */
	splitEditor(direction: 'horizontal' | 'vertical' = 'horizontal'): void {
		if (!this.view)
			return;

		const newId = `editor-${ Date.now() }`;
		const newTitle = `Editor ${ this.tabViews.value.length + 1 }`;

		if (direction === 'horizontal') {
			// Add a new column to the first row (NestedView)
			if (this.nestedViews.value.length > 0) {
				const firstRow = this.nestedViews.value[0];
				if (firstRow) {
					// Create a TabView with a single editor for the nested view
					const newTabView = new TabView(
						`${ newId }-tab`,
						newTitle,
						undefined,
						undefined,
						this.defaultTemplateFunction,
					);
					newTabView.createEditor(newId, newTitle, this.defaultTemplateFunction);

					this.addViewToNestedView(firstRow, newTabView);
				}
			}
		}
		else {
			// Add a new row to the main vertical split view using createEditor
			this.createEditor(newId, newTitle, undefined, Sizing.Distribute);
		}
	}

	/**
	 * Convert a TabView to a NestedView in place
	 * @param tabView The TabView to convert
	 * @param orientation The orientation for the new NestedView
	 * @returns The new NestedView, or null if conversion failed
	 */
	convertTabViewToNested(tabView: TabView, orientation: Orientation): NestedView | null {
		if (!this.view)
			return null;

		const viewIndex = this.view.indexOf(tabView);
		if (viewIndex === -1) {
			console.warn('TabView not found in main split view');

			return null;
		}

		// Capture sizes and convert
		const allSizes = this.captureViewSizes();

		// Create NestedView with proper cleanup callback
		const nestedView = this.createNestedView(
			`nested-from-tab-${ tabView.id }`,
			`Nested ${ tabView.title }`,
			orientation,
		);

		// Extract editors with their callbacks from TabView
		const editorsWithCallbacks = tabView.extractEditorsWithCallbacks();

		// Remove TabView from main view and tracking
		this.view.removeView(viewIndex);
		this.removeViewFromMap(tabView.id);
		tabView.dispose();

		// Add NestedView and transfer editors
		this.view.addView(nestedView, allSizes[viewIndex]!, viewIndex, true);
		this.addViewToTracking(nestedView);

		// Transfer editors to NestedView
		editorsWithCallbacks.forEach(({ editor, callback }) => {
			this.addViewToNestedView(nestedView, editor, callback);
		});

		// Restore layout and sizes
		this.restoreViewSizes(allSizes);
		nestedView.layoutInternal();

		return nestedView;
	}

	/**
	 * Convert a NestedView to a TabView in place
	 * @param nestedView The NestedView to convert
	 * @returns The new TabView, or null if conversion failed
	 */
	convertNestedViewToTab(nestedView: NestedView): TabView | null {
		if (!this.view)
			return null;

		const viewIndex = this.view.indexOf(nestedView);
		if (viewIndex === -1) {
			console.warn('NestedView not found in main split view');

			return null;
		}

		// Capture sizes and convert
		const allSizes = this.captureViewSizes();

		// Create TabView with proper cleanup callback
		const tabView = this.createTabView(
			`tab-from-nested-${ nestedView.id }`,
			`Tab ${ nestedView.title }`,
		);

		// Extract editors with their callbacks from NestedView
		const editorsWithCallbacks = nestedView.extractEditorsWithCallbacks();

		if (editorsWithCallbacks.length === 0) {
			console.warn('Cannot convert NestedView to TabView: no EditorViews found');

			return null;
		}

		// Remove NestedView from main view and tracking
		this.view.removeView(viewIndex);
		this.removeViewFromMap(nestedView.id);
		nestedView.dispose();

		// Add TabView and transfer editors
		this.view.addView(tabView, allSizes[viewIndex]!, viewIndex, true);
		this.addViewToTracking(tabView);

		// Transfer editors to TabView
		editorsWithCallbacks.forEach(({ editor, callback }) => {
			this.addEditorToTabView(tabView, editor, callback);
		});

		// Restore layout and sizes
		this.restoreViewSizes(allSizes);

		return tabView;
	}

	/**
	 * Unified conversion method that can convert between any view types
	 * @param sourceView The view to convert from
	 * @param targetType The type to convert to
	 * @param options Additional options for conversion (e.g., orientation for NestedView)
	 * @returns The converted view, or null if conversion failed
	 */
	convertView(
		sourceView: IEditorView,
		targetType: 'nested' | 'tab',
		options?: { orientation?: Orientation; },
	): IEditorView | null {
		const sourceType = sourceView.type;

		// Same type - no conversion needed
		if (sourceType === targetType)
			return sourceView;

		// NestedView conversions
		if (sourceType === 'nested' && isNestedView(sourceView)) {
			if (targetType === 'tab')
				return this.convertNestedViewToTab(sourceView);
		}

		// TabView conversions
		if (sourceType === 'tab' && isTabView(sourceView)) {
			const tabView = sourceView as TabView;
			if (targetType === 'nested')
				return this.convertTabViewToNested(tabView, options?.orientation ?? Orientation.HORIZONTAL);
		}

		console.warn(`Unsupported conversion: ${ sourceType } -> ${ targetType }`);

		return null;
	}

	/**
	 * Capture all current view sizes for restoration after layout changes
	 */
	private captureViewSizes(): number[] {
		return this.view ? Array.from({ length: this.view.length }, (_, i) => this.view!.getViewSize(i)) : [];
	}

	/**
	 * Restore view sizes and trigger layout to preserve proportions after view changes
	 */
	private restoreViewSizes(allSizes: number[]): void {
		if (!this.view)
			return;

		const size = this.view.orientation === Orientation.HORIZONTAL
			? this.container.offsetWidth
			: this.container.offsetHeight;

		this.view.layout(size);

		// Restore sizes for views that have changed significantly (> 1px difference)
		const tolerance = 1;
		allSizes.forEach((targetSize, i) => {
			if (i < this.view!.length && targetSize !== undefined) {
				const currentSize = this.view!.getViewSize(i);
				if (Math.abs(currentSize - targetSize) > tolerance)
					this.view!.setViewSize(i, targetSize);
			}
		});
	}

	/**
	 * Add a nested view to the main split view
	 */
	addNestedView(nestedView: NestedView, sizing: number | Sizing = Sizing.Distribute): void {
		if (!this.view)
			return;

		this.addViewToTracking(nestedView);
		this.view.addView(nestedView, sizing);
	}

	/**
	 * Get the first TabView with a single editor (for testing purposes)
	 */
	getFirstSingleEditorTabView(): TabView | null {
		return this.tabViews.value.find(tv => tv.editorCount === 1) || null;
	}

	/**
	 * Get the first convertible nested view (for testing purposes)
	 */
	getFirstConvertibleNested(): NestedView | null {
		return this.nestedViews.value.find(nv => nv.editorCount === 1) || null;
	}

	/**
	 * Check if the ViewManager is initialized
	 */
	get isInitialized(): boolean {
		return this.view !== null;
	}

	/**
	 * Register an editor with the ViewManager (for test scenarios)
	 */
	registerEditor(editor: EditorView): void {
		this.addViewToTracking(editor);

		// Initialize drag functionality for the registered editor
		if (this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(editor);
	}

	/**
	 * Get the index of a view in the main split view (for drag-drop operations)
	 */
	getViewIndex(view: IEditorView): number {
		return this.view?.indexOf(view) ?? -1;
	}

	/**
	 * Add a view (like TabView) to the main split view
	 */
	addView(view: IEditorView, sizing: number | Sizing = Sizing.Distribute): void {
		if (!this.view)
			return;

		this.view.addView(view, sizing);

		// Track the view in the central map
		this.addViewToTracking(view);

		// Initialize drag functionality for EditorViews
		if (isEditorView(view) && this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(view);
	}

	/**
	 * Dispose all resources
	 */
	dispose(): void {
		this.dragDropManager?.dispose();
		this.view?.dispose();

		// Dispose all views
		this.views.value.forEach(view => view.dispose());

		// Clear the central map
		this._allViews.clear();
	}

}
