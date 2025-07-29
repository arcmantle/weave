import { SplitView } from '../split-view.ts';
import { Orientation, Sizing } from '../types.ts';
import type { IViewManager } from '../view-manager.ts';
import { type EditorTemplateFunction, type IEditorView } from './shared.ts';
import type { TabView } from './tab-view.ts';


/**
 * NestedView wraps a SplitView to behave like an IEditorView for nesting.
 * It can contain multiple editors arranged in a split layout.
 */
export class NestedView implements IEditorView {

	constructor(
		viewManager: IViewManager,
		orientation: Orientation,
	) {
		this.id = `nested-view-${ crypto.randomUUID() }`;
		this.title = `Nested View ${ this.id }`;
		this._viewManager = new WeakRef(viewManager);
		this.element = document.createElement('div');
		this.element.className = 'nested-split-view';

		this.splitView = new SplitView(this.element, {
			orientation,
			proportionalResize: false,
		});
	}

	readonly type = 'nested' as const;
	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 100;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;

	private splitView:    SplitView<TabView>;
	private views:        TabView[] = [];
	private _viewManager: WeakRef<IViewManager>;

	private get viewManager(): IViewManager {
		const vm = this._viewManager.deref();
		if (!vm)
			throw new Error('ViewManager has been garbage collected');

		return vm;
	}

	get viewCount(): number {
		return this.views.length;
	}

	addTabView(view: TabView, sizing: number | Sizing = Sizing.Proportional): void {
		this.views.push(view);

		this.viewManager.addViewToTracking(view);

		if (this.views.length === 1) // First editor gets all available space
			this.splitView.addView(view, Sizing.Distribute);
		else // New editor gets equal share (1/n of total space)
			this.splitView.addView(view, sizing);
	}

	createAndAddTabView(
		sizing: number | Sizing = Sizing.Distribute,
		...editorViews: {
			id:               string;
			title:            string;
			templateFunction: EditorTemplateFunction;
		}[]
	): TabView {
		const tabView = this.viewManager.createTabView();
		editorViews.forEach(({ id, title, templateFunction }) => {
			tabView.createAndAddEditor(id, title, templateFunction);
		});

		this.addTabView(tabView, sizing);

		return tabView;
	}

	findEditorById(id: string): TabView | undefined {
		return this.views.find(e => e.id === id);
	}

	removeEditorById(id: string): boolean {
		const editorIndex = this.views.findIndex(e => e.id === id);
		if (editorIndex === -1)
			return false;

		const view = this.views[editorIndex];
		if (!view)
			return false;

		// Use split sizing to give space to adjacent editor
		// Give space to the editor immediately to the left,
		// or to the right if it's the leftmost
		const adjacentIndex = editorIndex > 0
			? editorIndex - 1
			: editorIndex + 1;

		let sizing: Sizing | undefined;
		if (adjacentIndex >= 0 && adjacentIndex < this.views.length)
			sizing = { type: 'split', index: adjacentIndex };

		this.splitView.removeView(editorIndex, sizing);

		view.dispose();
		this.views.splice(editorIndex, 1);

		// Remove the nested view if it becomes empty
		if (this.views.length === 0) {
			const removedView = this.viewManager.view.removeViewByReference(this);
			if (removedView) {
				this.dispose();
				this.viewManager.removeViewFromTracking(this.id);
			}
		}
		else if (this.views.length === 1) {
			// Convert to TabView when only one editor remains to reduce GUI complexity
			this.viewManager.convertView?.(this);
		}

		return true;
	}

	/**
	 * Manually layout the internal split view without calling finalizeLayout
	 * This allows us to size the nested view without triggering size redistribution
	 */
	layoutInternal(): void {
		const size = this.splitView.orientation === Orientation.HORIZONTAL
			? this.element.offsetWidth
			: this.element.offsetHeight;

		this.splitView.layout(size);
	}

	finalizeLayout(): void {
		const size = this.splitView.orientation === Orientation.HORIZONTAL
			? this.element.offsetWidth
			: this.element.offsetHeight;

		this.splitView.layout(size);

		// Only force equal distribution for initial setup with no user adjustments
		const shouldDistribute = !this.splitView.hasProportions && this.views.length <= 1;
		if (shouldDistribute)
			this.splitView.distributeViewSizes();
	}

	layout(size: number, offset: number): void {
		// Layout the nested split view with the correct dimension
		// For horizontal orientation, we use the full size (width)
		// For vertical orientation, we use the full size (height)
		this.splitView.layout(size);

		// Always finalize layout to ensure proper sizing, especially for newly converted views
		this.finalizeLayout();
	}

	/**
	 * Extract the single view from this NestedView without disposing it
	 * This is used for conversion when we want to preserve the contained view
	 * @returns The extracted view, or undefined if extraction is not possible
	 */
	extractSingleView(): TabView | void {
		if (this.views.length !== 1)
			return console.warn('Cannot extract single view: NestedView contains', this.viewCount, 'views');

		const view = this.views[0]!;

		this.splitView.removeView(0);
		this.views.splice(0, 1);

		return view;
	}

	dispose(): void {
		this.splitView.dispose();
		this.views.forEach(editor => editor.dispose());
		this.element.remove();
	}

}
