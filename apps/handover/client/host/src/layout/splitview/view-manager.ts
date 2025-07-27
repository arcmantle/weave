import { computed, type ReadonlySignal } from '@arcmantle/adapter-element/shared';

import { type DragDropConfig, DragDropManager } from './drag-drop-manager.ts';
import { SplitView } from './split-view.ts';
import { Orientation, Sizing } from './types.ts';
import { SignalMap } from './utilities/signal-map.ts';
import { EditorView } from './views/editor-view.ts';
import { NestedView } from './views/nested-view.ts';
import { type EditorTemplateFunction, type IEditorView, isEditorView, isNestedView, isTabView } from './views/shared.ts';
import { TabView } from './views/tab-view.ts';


export interface IViewManager {
	dragDropManager: DragDropManager | null;

	addViewToTracking(...view: IEditorView[]): void;
	removeViewFromTracking(...viewId: string[]): boolean;
	closeEditor(id: string): void;
	removeEmptyTabView(tabView: any): void;
	convertNestedViewToTab?(nestedView: NestedView): void;
}


export class ViewManager implements IViewManager {

	constructor(
		private container: HTMLElement,
		private defaultTemplateFn: EditorTemplateFunction,
		private dragDropConfig: DragDropConfig | undefined = undefined,
	) {}

	// Single source of truth for all views using SignalMap for automatic reactivity
	private _allViews: SignalMap<string, IEditorView> = new SignalMap();

	// Computed signals for filtered view types
	readonly views: ReadonlySignal<IEditorView[]> = computed(() =>
		this._allViews.values().toArray());

	readonly nestedViews: ReadonlySignal<NestedView[]> = computed(() =>
		this.views.value.filter((view): view is NestedView => isNestedView(view)));

	readonly tabViews: ReadonlySignal<TabView[]> = computed(() =>
		this.views.value.filter((view): view is TabView => isTabView(view)));

	private _view: SplitView<IEditorView> | null = null;
	private get view(): SplitView<IEditorView> {
		if (!this._view)
			throw new Error('ViewManager: SplitView not initialized yet');

		return this._view;
	}

	private set view(value: SplitView<IEditorView>) {
		if (this._view)
			throw new Error('ViewManager: SplitView already initialized');

		this._view = value;
	}

	dragDropManager: DragDropManager | null = null;

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
	 * Add a view to the central tracking map
	 */
	addViewToTracking(...view: IEditorView[]): void {
		view.forEach(v => this._allViews.set(v.id, v));
	}

	/**
	 * Remove a view from the central tracking map
	 */
	removeViewFromTracking(...viewId: string[]): boolean {
		return viewId.every(v => this._allViews.delete(v));
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
				if (view.findEditorById(editorId))
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


	/**
	 * Create a new NestedView with proper onRemoved callback for cleanup
	 */
	createNestedView(id: string, title: string, orientation: Orientation): NestedView {
		const nestedView = new NestedView(
			id,
			title,
			orientation,
			this,
			// onRemoved: called after successful removal for cleanup
			(editorId) => {
				// Check if this is the NestedView itself being removed (empty NestedView)
				if (editorId === nestedView.id) {
					// Remove the empty NestedView from the main view
					const removedView = this.view?.removeViewByReference(nestedView);
					if (removedView) {
						nestedView.dispose();
						this.removeViewFromTracking(nestedView.id);
					}

					return;
				}

				// Remove the editor from central tracking and dispose it
				const editor = this.getViewById(editorId);
				if (isEditorView(editor)) {
					this.removeViewFromTracking(editorId);
					editor.dispose();

					// If the NestedView is now empty, remove it from the main view
					if (nestedView.editorCount === 0) {
						const removedView = this.view?.removeViewByReference(nestedView);
						if (removedView) {
							nestedView.dispose();
							this.removeViewFromTracking(nestedView.id);
						}
					}
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
	): void {
		// Warn if adding a non-TabView to a NestedView (should not happen in normal usage)
		if (!isTabView(view))
			console.warn('Adding non-TabView to NestedView. NestedViews should only contain TabViews:', view.type);

		// Register the view with the ViewManager first
		this.addViewToTracking(view);

		// Add to the NestedView with the optional callback
		nestedView.addEditor(view);

		// Initialize drag functionality only for EditorViews (TabViews don't need it)
		if (isEditorView(view) && this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(view);
	}

	/**
	 * Create a new TabView with proper onRemoved callback for cleanup
	 */
	createTabView(): TabView {
		const tabView = new TabView(this);

		return tabView;
	}

	/**
	 * Add an editor to a TabView with optional per-editor onRemove callback
	 */
	addEditorToTabView(tabView: TabView, editor: EditorView): void {
		tabView.addEditor(editor);
	}

	/**
	 * Remove an empty TabView from its parent (either main view or NestedView)
	 */
	removeEmptyTabView(tabView: TabView): void {
		// First try to remove from main view
		const removedFromMain = this.view?.removeViewByReference(tabView);
		if (removedFromMain) {
			tabView.dispose();
			this.removeViewFromTracking(tabView.id);

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
					this.removeViewFromTracking(tabView.id);

					return;
				}
			}
		}

		console.warn('Could not find parent for empty TabView:', tabView.id);
	}

	/**
	 * Create a new editor within a TabView (does not add to main view)
	 */
	createEditor(
		id: string,
		title: string,
		templateFunction: EditorTemplateFunction,
	): TabView {
		const templateFn = templateFunction || this.defaultTemplateFn;

		// Create a TabView to contain the editor
		const tabView = new TabView(this);

		// Create the editor inside the TabView
		const editor = tabView.createEditor(id, title, templateFn);
		tabView.addEditor(editor);

		// Add to tracking
		this.addViewToTracking(tabView);
		this.addViewToTracking(editor);

		// Initialize drag functionality for the editor
		if (this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(editor);

		return tabView;
	}

	/**
	 * Create a new editor within a TabView and add it to the main view
	 */
	createAndAddTabView(
		id: string,
		title: string,
		templateFunction: EditorTemplateFunction,
		sizing: number | Sizing = Sizing.Distribute,
	): TabView {
		const tabView = this.createTabView();
		tabView.createAndAddEditor(id, title, templateFunction);

		this.view.addView(tabView, sizing);

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
					const newTabView = this.createEditor(newId, newTitle, this.defaultTemplateFn);

					this.addViewToNestedView(firstRow, newTabView);
				}
			}
		}
		else {
			// Add a new row to the main vertical split view with proportional sizing
			// Calculate target share: 1/(current_rows + 1) to maintain proportions
			const currentRowCount = this.view.length;
			const targetShare = 1 / (currentRowCount + 1);

			// Create editor without adding to main view, then add with proportional sizing
			const tabView = this.createEditor(newId, newTitle, this.defaultTemplateFn);

			// Add with proportional sizing to preserve current proportions
			this.view.addViewWithProportionalSizing(tabView, targetShare);
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
		this.removeViewFromTracking(nestedView.id);

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
	 * Register an editor with the ViewManager (for test scenarios)
	 */
	registerEditor(editor: EditorView): void {
		this.addViewToTracking(editor);

		// Initialize drag functionality for the registered editor
		if (this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(editor);
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
