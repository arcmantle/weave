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

	private _view: SplitView<undefined, IEditorView> | null = null;
	private get view(): SplitView<undefined, IEditorView> {
		if (!this._view)
			throw new Error('ViewManager: SplitView not initialized yet');

		return this._view;
	}

	private set view(value: SplitView<undefined, IEditorView>) {
		if (this._view)
			throw new Error('ViewManager: SplitView already initialized');

		this._view = value;
	}


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
			this, // Pass ViewManager reference
			// onRemoved: called after successful removal for cleanup
			(editorId) => {
				// Check if this is the NestedView itself being removed (empty NestedView)
				if (editorId === nestedView.id) {
					// Remove the empty NestedView from the main view
					const removedView = this.view?.removeViewByReference(nestedView);
					if (removedView) {
						nestedView.dispose();
						this.removeViewFromMap(nestedView.id);
					}

					// If no TabViews remain, create a welcome editor
					if (this.tabViews.value.length === 0)
						this.createEditor('welcome', 'Welcome');

					return;
				}

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
	 * Add a view to a NestedView
	 * Note: NestedViews should only contain TabViews, not standalone EditorViews
	 */
	addViewToNestedView(
		nestedView: NestedView,
		view: IEditorView,
		onRemove?: (id: string) => boolean | void,
	): void {
		// Warn if adding a non-TabView to a NestedView (should not happen in normal usage)
		if (!isTabView(view))
			console.warn('Adding non-TabView to NestedView. NestedViews should only contain TabViews:', view.type);

		// Register the view with the ViewManager first
		this.addViewToTracking(view);

		// Add to the NestedView with the optional callback
		nestedView.addEditorWithCallback(view, onRemove);

		// Initialize drag functionality only for EditorViews (TabViews don't need it)
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
			this, // Pass ViewManager reference first (now required)
			onRemove,
			// onRemoved: called after successful removal for cleanup
			onRemoved || ((editorId) => {
				// Remove the editor from central tracking and dispose it
				const editor = this.getViewById(editorId);
				if (isEditorView(editor)) {
					this.removeViewFromMap(editorId);
					editor.dispose();

					// If the TabView is now empty, remove it from its parent
					if (tabView.editorCount === 0)
						this.removeEmptyTabView(tabView);

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
	 * Remove an empty TabView from its parent (either main view or NestedView)
	 */
	removeEmptyTabView(tabView: TabView): void {
		// First try to remove from main view
		const removedFromMain = this.view?.removeViewByReference(tabView);
		if (removedFromMain) {
			tabView.dispose();
			this.removeViewFromMap(tabView.id);

			return;
		}

		// If not in main view, find which NestedView contains it
		for (const nestedView of this.nestedViews.value) {
			// Check if the TabView is directly in the NestedView's editors array
			const isContained = nestedView.allEditors.some(editor => editor.id === tabView.id);
			if (isContained) {
				// Remove from the NestedView (this will call dispose on the TabView)
				const removed = nestedView.removeEditor(tabView.id);
				if (removed) {
					// Also remove from ViewManager tracking
					this.removeViewFromMap(tabView.id);

					return;
				}
			}
		}

		console.warn('Could not find parent for empty TabView:', tabView.id);
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
					// Check if TabView is now empty and remove it if so
					if (tabView.editorCount === 0)
						this.removeEmptyTabView(tabView);

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
		const totalSize = this.view.orientation === Orientation.HORIZONTAL
			? this.container.offsetWidth
			: this.container.offsetHeight;

		const targetSize = totalSize * targetShare;

		// Capture current sizes and calculate reduction factor
		const currentSizes = Array.from({ length: this.view.length },
			(_, i) => this.view!.getViewSize(i));

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
		const newId = `editor-${ Date.now() }`;
		const newTitle = `Editor ${ this.tabViews.value.length + 1 }`;

		if (direction === 'horizontal') {
			// Add a new column to the first row (NestedView)
			if (this.nestedViews.value.length > 0) {
				const firstRow = this.nestedViews.value[0];
				if (firstRow) {
					// Create a TabView with a single editor for the nested view
					const newTabView = this.createTabView(`${ newId }-tab`, newTitle);
					newTabView.createEditor(newId, newTitle, this.defaultTemplateFunction);

					this.addViewToNestedView(firstRow, newTabView);
				}
			}
		}
		else {
			// Add a new row to the main vertical split view with proportional sizing
			// Calculate target share: 1/(current_rows + 1) to maintain proportions
			const currentRowCount = this.view.length;
			const targetShare = 1 / (currentRowCount + 1);

			// Use the existing createEditor method but with proportional sizing
			// We need to manually handle proportional sizing since createEditor uses addView with the sizing parameter
			const tabView = this.createTabView(`${ newId }-tab`, newTitle);
			tabView.createEditor(newId, newTitle, this.defaultTemplateFunction);

			// Add to tracking
			this.addViewToTracking(tabView);
			this.addViewToTracking(tabView.getAllEditors()[0]!);

			if (this.dragDropManager)
				this.dragDropManager.initializeEditorDrag(tabView.getAllEditors()[0]!);

			// Add with proportional sizing to preserve current proportions
			this.addViewWithProportionalSizing(tabView, targetShare);
		}
	}

	/**
	 * Convert a TabView to a NestedView in place
	 * @param tabView The TabView to convert
	 * @param orientation The orientation for the new NestedView
	 * @returns The new NestedView, or null if conversion failed
	 */
	convertTabViewToNested(tabView: TabView, orientation: Orientation): NestedView | null {
		const viewIndex = this.view.indexOf(tabView);
		if (viewIndex === -1) {
			console.warn('TabView not found in main split view');

			return null;
		}

		// Create NestedView with proper cleanup callback
		const nestedView = this.createNestedView(
			`nested-from-tab-${ tabView.id }`,
			`Nested ${ tabView.title }`,
			orientation,
		);

		// Replace the TabView with the NestedView, preserving size and preventing disposal
		this.view.replaceView(viewIndex, nestedView, { preventDisposal: true });
		this.addViewToTracking(nestedView);

		// Move the existing TabView directly into the NestedView to preserve DOM elements
		this.addViewToNestedView(nestedView, tabView);

		// Finalize the layout
		nestedView.layoutInternal();

		return nestedView;
	}

	/**
	 * Convert a NestedView to a TabView in place
	 * @param nestedView The NestedView to convert
	 * @returns The new TabView, or null if conversion failed
	 */
	convertNestedViewToTab(nestedView: NestedView): TabView | null {
		const viewIndex = this.view.indexOf(nestedView);
		if (viewIndex === -1) {
			console.warn('NestedView not found in main split view');

			return null;
		}

		// Get all views from the NestedView (should only be TabViews)
		const allViews = nestedView.allEditors;

		if (allViews.length === 0) {
			console.warn('Cannot convert NestedView to TabView: no views found');

			return null;
		}

		if (allViews.length !== 1) {
			console.warn('Cannot convert NestedView to TabView: expected exactly 1 TabView, found', allViews.length);

			return null;
		}

		const view = allViews[0];
		if (!isTabView(view)) {
			console.warn('Cannot convert NestedView to TabView: contained view is not a TabView');

			return null;
		}

		// Extract the TabView from the NestedView without disposing it
		const extractedTabView = nestedView.extractSingleView();
		if (!extractedTabView || !isTabView(extractedTabView)) {
			console.warn('Failed to extract TabView from NestedView');

			return null;
		}

		// Replace the NestedView with the extracted TabView, preserving size
		this.view.replaceView(viewIndex, extractedTabView);

		// Remove the NestedView from tracking (TabView stays tracked)
		this.removeViewFromMap(nestedView.id);

		// Dispose the now-empty NestedView wrapper
		nestedView.dispose();

		return extractedTabView as TabView;
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
		// Same type - no conversion needed
		if (sourceView.type === targetType)
			return sourceView;

		// NestedView conversions
		if (isNestedView(sourceView) && targetType === 'tab')
			return this.convertNestedViewToTab(sourceView);

		// TabView conversions
		if (isTabView(sourceView) && targetType === 'nested')
			return this.convertTabViewToNested(sourceView, options?.orientation ?? Orientation.HORIZONTAL);

		console.warn(`Unsupported conversion: ${ sourceView.type } -> ${ targetType }`);

		return null;
	}

	/**
	 * Add a nested view to the main split view
	 */
	addNestedView(nestedView: NestedView, sizing: number | Sizing = Sizing.Distribute): void {
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
