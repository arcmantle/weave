import { computed, type ReadonlySignal } from '@arcmantle/adapter-element/shared';

import { SplitView } from './split-view.ts';
import { Orientation, Sizing } from './types.ts';
import { SignalMap } from './utilities/signal-map.ts';
import { EditorView } from './views/editor-view.ts';
import { NestedView } from './views/nested-view.ts';
import { type EditorTemplateFunction, type IEditorView, isNestedView, isTabView } from './views/shared.ts';
import { TabView } from './views/tab-view.ts';


//export interface IViewManager {
//	dragDropManager: DragDropManager | null;
//	view:            SplitView<IEditorView>;

//	addViewToTracking(...view: IEditorView[]): void;
//	removeViewFromTracking(...viewId: string[]): boolean;
//	closeEditor(id: string): void;

//	convertView<T extends TabView | NestedView>(
//		sourceView: T,
//		options?: { orientation?: Orientation; },
//	): T extends TabView ? NestedView : T extends NestedView ? TabView : void;
//}

export type IViewManager = ViewManager;


export class ViewManager implements IViewManager {

	constructor(
		private container: HTMLElement,
		private defaultTemplateFn: EditorTemplateFunction,
	) {}

	private _allViews: SignalMap<string, IEditorView> = new SignalMap();

	readonly views: ReadonlySignal<IEditorView[]> = computed(() =>
		this._allViews.values().toArray());

	readonly nestedViews: ReadonlySignal<NestedView[]> = computed(() =>
		this.views.value.filter((view): view is NestedView => isNestedView(view)));

	readonly tabViews: ReadonlySignal<TabView[]> = computed(() =>
		this.views.value.filter((view): view is TabView => isTabView(view)));

	private _view: SplitView<IEditorView> | null = null;
	get view(): SplitView<IEditorView> {
		if (!this._view)
			throw new Error('ViewManager: SplitView not initialized yet');

		return this._view;
	}

	private set view(value: SplitView<IEditorView>) {
		if (this._view)
			throw new Error('ViewManager: SplitView already initialized');

		this._view = value;
	}

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

		// Listen to the main split view's resize events to update nested views
		this.view.onDidSashChange(() => {
			// Force all nested split views to redistribute their spaces
			// This ensures proportional behavior is maintained during resize
			for (const nestedView of this.nestedViews.value)
				nestedView.finalizeLayout();
		});
	}

	addViewToTracking(...view: IEditorView[]): void {
		view.forEach(v => this._allViews.set(v.id, v));
	}

	removeViewFromTracking(viewId: string): boolean {
		return this._allViews.delete(viewId);
	}

	private findEditorLineage(editorId: string): IEditorView[] {
		const lineage: Set<IEditorView> = new Set();
		let currentId = editorId;

		outer: do {
			for (const view of this._allViews.values()) {
				if (!isTabView(view) && !isNestedView(view))
					continue;

				const foundEditor = view.findEditorById(currentId);
				if (!foundEditor)
					continue;

				lineage.add(foundEditor);
				lineage.add(view);

				currentId = view.id;

				continue outer;
			}

			break;
		}
		// eslint-disable-next-line no-constant-condition
		while (true);

		return lineage.values().toArray();
	}

	createNestedView(orientation: Orientation): NestedView {
		const nestedView = new NestedView(this, orientation);

		return nestedView;
	}

	createTabView(): TabView {
		const tabView = new TabView(this);

		return tabView;
	}

	createEditorView(id: string, title: string, templateFunction: EditorTemplateFunction): EditorView {
		const editorView = new EditorView(id, title, this, templateFunction);

		return editorView;
	}

	/**
	 * Close an editor by ID
	 * This method handles editors within TabViews and NestedViews
	 */
	closeEditor(id: string): void {
		const editorLineage = this.findEditorLineage(id) as [
			EditorView,
			TabView,
			...NestedView[],
		];

		if (editorLineage.length < 2)
			return console.warn('Editor lineage could not be found:', id);

		const editorView = editorLineage[0];
		const tabView = editorLineage[1];
		const nestedViews = editorLineage.slice(2) as NestedView[];

		tabView.removeEditorById(editorView.id);

		// If the TabView is now empty, remove it from the main view
		if (!tabView.editorCount) {
			if (nestedViews[0]) {
				nestedViews[0]?.removeEditorById(tabView.id);
			}
			else {
				// If no nested views, remove the TabView from the main split view
				this.view.removeViewByReference(tabView);
				this.removeViewFromTracking(tabView.id);
				tabView.dispose();
			}
		}

		for (let i = 1; i < nestedViews.length; i++) {
			// Here we can iteratively remove empty nested views
			const _childView = nestedViews[i - 1];
			const _parentView = nestedViews[i];
		}
	}

	splitEditor(orientation: Orientation = Orientation.HORIZONTAL): void {
		const newId = `editor-${ Date.now() }`;
		const newTitle = `Editor ${ this.tabViews.value.length + 1 }`;

		if (orientation === Orientation.HORIZONTAL) {
			// Add a new column to the first row (NestedView)
			if (this.nestedViews.value.length > 0) {
				const firstRow = this.nestedViews.value[0];
				if (firstRow) {
					firstRow.createAndAddTabView(
						Sizing.Distribute,
						{ id: newId, title: newTitle, templateFunction: this.defaultTemplateFn },
					);
				}
			}
		}
		else {
			// Add a new row to the main vertical split view with proportional sizing
			// Calculate target share: 1/(current_rows + 1) to maintain proportions
			const currentRowCount = this.view.length;
			const targetShare = 1 / (currentRowCount + 1);

			// Create editor without adding to main view, then add with proportional sizing
			const tabView = this.createTabView();
			tabView.createAndAddEditor(newId, newTitle, this.defaultTemplateFn);

			// Add with proportional sizing to preserve current proportions
			this.view.addViewWithProportionalSizing(tabView, targetShare);
			this.addViewToTracking(tabView);
		}
	}

	convertTabViewToNested(tabView: TabView, orientation: Orientation): NestedView | void {
		const viewIndex = this.view.indexOf(tabView);
		if (viewIndex === -1)
			return console.warn('TabView not found in main split view');

		const nestedView = this.createNestedView(orientation);

		// Replace the TabView with the NestedView, preserving size and preventing disposal
		this.view.replaceView(viewIndex, nestedView, { preventDisposal: true });
		this.addViewToTracking(nestedView);

		// Move the existing TabView directly into the NestedView to preserve DOM elements
		nestedView.addTabView(tabView);

		// Finalize the layout
		nestedView.layoutInternal();

		return nestedView;
	}

	convertNestedViewToTab(nestedView: NestedView): TabView | void {
		const viewIndex = this.view.indexOf(nestedView);
		if (viewIndex === -1)
			return console.warn('NestedView not found in main split view');


		// Get all views from the NestedView (should only be TabViews)
		const viewCount = nestedView.viewCount;

		if (viewCount === 0)
			return console.warn('Cannot convert NestedView to TabView: no views found');


		if (viewCount !== 1)
			return console.warn('Cannot convert NestedView to TabView: expected exactly 1 TabView, found', viewCount);


		// Extract the TabView from the NestedView without disposing it
		const extractedTabView = nestedView.extractSingleView();
		if (!extractedTabView)
			return console.warn('Failed to extract TabView from NestedView');


		// Replace the NestedView with the extracted TabView, preserving size
		this.view.replaceView(viewIndex, extractedTabView);

		// Remove the NestedView from tracking (TabView stays tracked)
		this.removeViewFromTracking(nestedView.id);

		// Dispose the now-empty NestedView wrapper
		nestedView.dispose();

		return extractedTabView;
	}

	convertView<T extends TabView | NestedView>(
		sourceView: T,
		options?: { orientation?: Orientation; },
	): T extends TabView ? NestedView : T extends NestedView ? TabView : void {
		if (isNestedView(sourceView))
			return this.convertNestedViewToTab(sourceView) as any;

		if (isTabView(sourceView)) {
			const orientation = options?.orientation ?? Orientation.HORIZONTAL;

			return this.convertTabViewToNested(sourceView, orientation) as any;
		}

		throw new Error('Unsupported view type for conversion: ' + sourceView);
	}

	addNestedView(nestedView: NestedView, sizing: number | Sizing = Sizing.Distribute): void {
		this.addViewToTracking(nestedView);
		this.view.addView(nestedView, sizing);
	}

	addTabView(tabView: TabView, sizing: number | Sizing = Sizing.Distribute): void {
		this.addViewToTracking(tabView);
		this.view.addView(tabView, sizing);
	}

	dispose(): void {
		this.view?.dispose();

		// Dispose all views
		this.views.value.forEach(view => view.dispose());

		// Clear the central map
		this._allViews.clear();
	}

}
