import { SplitView } from '../split-view.ts';
import { Orientation, Sizing } from '../types.ts';
import type { IViewManager } from '../view-manager.ts';
import { type IEditorView } from './shared.ts';


/**
 * NestedView wraps a SplitView to behave like an IEditorView for nesting.
 * It can contain multiple editors arranged in a split layout.
 */
export class NestedView implements IEditorView {

	constructor(
		id: string,
		title: string,
		orientation: Orientation,
		viewManager: IViewManager,
	) {
		this.id = id;
		this.title = title;
		this._viewManager = new WeakRef(viewManager);
		this.element = document.createElement('div');
		this.element.className = 'nested-split-view';

		this.splitView = new SplitView(this.element, {
			orientation,
			proportionalResize: false,
		});
	}

	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 100;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;
	readonly type = 'nested' as const;

	private splitView:    SplitView<IEditorView>;
	private _editors:     IEditorView[] = [];
	private _viewManager: WeakRef<IViewManager>;

	private get viewManager(): IViewManager {
		const vm = this._viewManager.deref();
		if (!vm)
			throw new Error('ViewManager has been garbage collected');

		return vm;
	}

	addEditor(editor: IEditorView): void {
		this._editors.push(editor);

		this.viewManager.addViewToTracking(editor);

		if (this._editors.length === 1) // First editor gets all available space
			this.splitView.addView(editor, Sizing.Distribute);
		else // New editor gets equal share (1/n of total space)
			this.splitView.addView(editor, Sizing.Proportional);
	}

	removeEditorById(id: string): boolean {
		const editorIndex = this._editors.findIndex(e => e.id === id);
		if (editorIndex === -1)
			return false;

		const view = this._editors[editorIndex];
		if (!view)
			return false;

		// Use split sizing to give space to adjacent editor
		// Give space to the editor immediately to the left,
		// or to the right if it's the leftmost
		const adjacentIndex = editorIndex > 0
			? editorIndex - 1
			: editorIndex + 1;

		let sizing: Sizing | undefined;
		if (adjacentIndex >= 0 && adjacentIndex < this._editors.length)
			sizing = { type: 'split', index: adjacentIndex };

		this.splitView.removeView(editorIndex, sizing);

		view.dispose();
		this._editors.splice(editorIndex, 1);

		// Remove the nested view if it becomes empty
		if (this._editors.length === 0) {
			const removedView = this.viewManager.view.removeViewByReference(this);
			if (removedView) {
				this.dispose();
				this.viewManager.removeViewFromTracking(this.id);
			}
		}
		else if (this._editors.length === 1) {
			// Convert to TabView when only one editor remains to reduce GUI complexity
			this.viewManager.convertNestedViewToTab?.(this);
		}

		return true;
	}

	findEditorById(id: string): IEditorView | undefined {
		return this._editors.find(e => e.id === id);
	}

	get editorCount(): number {
		return this._editors.length;
	}

	/**
	 * Get all editors (for conversion logic)
	 */
	get editors(): readonly IEditorView[] {
		return this._editors;
	}

	/**
	 * Manually layout the internal split view without calling finalizeLayout
	 * This allows us to size the nested view without triggering size redistribution
	 */
	layoutInternal(): void {
		if (this.element.offsetWidth > 0 && this.element.offsetHeight > 0) {
			const size = this.splitView.orientation === Orientation.HORIZONTAL
				? this.element.offsetWidth
				: this.element.offsetHeight;

			this.splitView.layout(size);
		}
	}

	finalizeLayout(): void {
		const size = this.splitView.orientation === Orientation.HORIZONTAL
			? this.element.offsetWidth
			: this.element.offsetHeight;

		this.splitView.layout(size);

		// Only force equal distribution for initial setup with no user adjustments
		const shouldDistribute = !this.splitView.hasProportions && this._editors.length <= 1;
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

	dispose(): void {
		this.splitView.dispose();
		this._editors.forEach(editor => editor.dispose());
		this.element.remove();
	}

	/**
	 * Extract the single view from this NestedView without disposing it
	 * This is used for conversion when we want to preserve the contained view
	 * @returns The extracted view, or null if extraction is not possible
	 */
	extractSingleView(): IEditorView | null {
		if (this._editors.length !== 1) {
			console.warn('Cannot extract single view: NestedView contains', this._editors.length, 'views');

			return null;
		}

		const view = this._editors[0]!;

		// Remove from internal structures without disposing the view
		this.splitView.removeView(0); // This will dispose the ViewItem wrapper but return the view
		this._editors.splice(0, 1);

		return view;
	}

}
