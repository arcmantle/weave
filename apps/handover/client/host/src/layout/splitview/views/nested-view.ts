import { SplitView } from '../split-view.ts';
import { Orientation, Sizing } from '../types.ts';
import { EditorView } from './editor-view.ts';
import { type EditorWithCallback, type IEditorView, isEditorView } from './shared.ts';

// Forward declaration to avoid circular dependency
interface IViewManager {
	closeEditor(id: string): void;
	removeEmptyTabView(tabView: any): void;
	convertNestedViewToTab?(nestedView: NestedView): void;
}


/**
 * NestedView wraps a SplitView to behave like an IEditorView for nesting.
 * It can contain multiple editors arranged in a split layout.
 */
export class NestedView implements IEditorView {

	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 100;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;
	readonly type = 'nested' as const;

	private splitView:       SplitView<undefined, IEditorView>;
	private editors:         IEditorView[] = [];
	private editorCallbacks: Map<string, (id: string) => boolean | void> = new Map();
	private onRemoved:       (id: string) => void;
	private _viewManager:    WeakRef<IViewManager>;
	private get viewManager(): IViewManager {
		const vm = this._viewManager.deref();
		if (!vm)
			throw new Error('ViewManager has been garbage collected');

		return vm;
	}

	constructor(
		id: string,
		title: string,
		orientation: Orientation,
		viewManager: IViewManager,
		onRemoved: (id: string) => void,
	) {
		this.id = id;
		this.title = title;
		this.onRemoved = onRemoved;
		this._viewManager = new WeakRef(viewManager);
		this.element = document.createElement('div');
		this.element.className = 'nested-split-view';

		this.splitView = new SplitView(this.element, {
			orientation,
			proportionalResize: false,
		});
	}

	/**
	 * Add a new editor with proportional sizing that preserves existing layout proportions
	 * @param editor The editor to add
	 * @param targetShare The fraction of total space the new editor should get (e.g., 0.25 for 1/4)
	 */
	private addEditorWithProportionalSizing(editor: IEditorView, targetShare: number): void {
		const totalSize = this.splitView.orientation === Orientation.HORIZONTAL
			? this.element.offsetWidth
			: this.element.offsetHeight;

		const targetSize = totalSize * targetShare;

		// Capture current sizes and calculate reduction factor
		const currentSizes = Array.from({ length: this.editors.length - 1 },
			(_, i) => this.splitView.getViewSize(i));

		const currentTotal = currentSizes.reduce((sum, size) => sum + size, 0);
		const reductionFactor = Math.max(0, (currentTotal - targetSize) / currentTotal);

		// Add new editor and resize existing ones
		this.splitView.addView(editor, targetSize);

		currentSizes.forEach((currentSize, i) => {
			const newSize = Math.max(100, currentSize * reductionFactor);
			this.splitView.setViewSize(i, newSize);
		});
	}

	addEditor(editor: IEditorView): void {
		this.addEditorWithCallback(editor);
	}

	/**
	 * Add an editor with optional per-editor onRemove callback
	 */
	addEditorWithCallback(editor: IEditorView, onRemove?: (id: string) => boolean | void): void {
		this.editors.push(editor);

		// Store the per-editor callback if provided
		if (onRemove)
			this.editorCallbacks.set(editor.id, onRemove);

		if (this.editors.length === 1) {
			// First editor gets all available space
			this.splitView.addView(editor, Sizing.Distribute);
		}
		else {
			// New editor gets equal share (1/n of total space)
			this.addEditorWithProportionalSizing(editor, 1 / this.editors.length);
		}

		// If it's an EditorView, add a close handler that respects the callback
		if (isEditorView(editor))
			this.setupEditorCloseHandler(editor as EditorView);
	}

	/**
	 * Setup close handler for EditorView that respects per-editor callbacks
	 */
	private setupEditorCloseHandler(editor: EditorView): void {
		// Replace the editor's onRemove with our own that checks callbacks
		editor.onRemove = (id: string) => {
			// Try the per-editor callback first
			const editorCallback = this.editorCallbacks.get(id);
			const shouldRemove = editorCallback ? editorCallback(id) : true;

			// If callback returned false, don't remove
			if (shouldRemove === false)
				return;

			// Use ViewManager for proper cleanup
			this.viewManager.closeEditor(id);
		};
	}

	/**
	 * Add an editor at a specific index
	 */
	addEditorAtIndex(editor: IEditorView, index: number): void {
		// Insert into editors array at the specified index
		this.editors.splice(index, 0, editor);

		if (this.editors.length === 1) {
			// First editor gets all available space
			this.splitView.addView(editor, Sizing.Distribute);
		}
		else {
			// Add to split view at the specified index
			this.splitView.addView(editor, Sizing.Distribute, index, true);

			// Redistribute space equally among all editors
			const equalSize = (this.splitView.orientation === Orientation.HORIZONTAL
				? this.element.offsetWidth
				: this.element.offsetHeight) / this.editors.length;

			for (let i = 0; i < this.editors.length; i++)
				this.splitView.setViewSize(i, equalSize);
		}
	}

	removeEditor(id: string): boolean {
		const editorIndex = this.editors.findIndex(e => e.id === id);
		if (editorIndex === -1)
			return false;

		const editor = this.editors[editorIndex];
		if (!editor)
			return false;

		// Use split sizing to give space to adjacent editor
		// Give space to the editor immediately to the left, or to the right if it's the leftmost
		const adjacentIndex = editorIndex > 0 ? editorIndex - 1 : editorIndex + 1;
		let sizing: Sizing | undefined;
		if (adjacentIndex >= 0 && adjacentIndex < this.editors.length)
			sizing = { type: 'split', index: adjacentIndex };

		this.splitView.removeView(editorIndex, sizing);
		editor.dispose();
		this.editors.splice(editorIndex, 1);

		// Clean up the per-editor callback
		this.editorCallbacks.delete(id);

		// Check if the NestedView should be converted or removed
		if (this.editors.length === 0) {
			// Notify the parent that this NestedView is now empty and should be removed
			// We pass the NestedView's own ID as the removed editor ID
			this.onRemoved(this.id);
		}
		else if (this.editors.length === 1) {
			// Convert to TabView when only one editor remains to reduce GUI complexity
			// Use ViewManager to handle the conversion to avoid circular dependencies
			this.viewManager.convertNestedViewToTab?.(this);
		}

		return true;
	}

	findEditor(id: string): IEditorView | undefined {
		return this.editors.find(e => e.id === id);
	}

	get editorCount(): number {
		return this.editors.length;
	}

	/**
	 * Get all editors (for conversion logic)
	 */
	get allEditors(): readonly IEditorView[] {
		return this.editors;
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
		const shouldDistribute = !this.splitView.hasProportions && this.editors.length <= 1;
		if (shouldDistribute)
			this.splitView.distributeViewSizes();
	}

	layout(size: number, offset: number, context: undefined): void {
		// Layout the nested split view with the correct dimension
		// For horizontal orientation, we use the full size (width)
		// For vertical orientation, we use the full size (height)
		this.splitView.layout(size);

		// Always finalize layout to ensure proper sizing, especially for newly converted views
		this.finalizeLayout();
	}

	/**
	 * Extract all editors with their callbacks for conversion purposes
	 * @returns Array of editors with their associated callbacks
	 */
	extractEditors(): EditorWithCallback[] {
		const result: EditorWithCallback[] = [];

		for (const editor of this.editors) {
			if (isEditorView(editor)) {
				result.push({
					editor,
					callback: this.editorCallbacks.get(editor.id),
				});
			}
		}

		return result;
	}

	dispose(): void {
		this.splitView.dispose();
		this.editors.forEach(editor => editor.dispose());
		this.element.remove();
	}

	/**
	 * Extract the single view from this NestedView without disposing it
	 * This is used for conversion when we want to preserve the contained view
	 * @returns The extracted view, or null if extraction is not possible
	 */
	extractSingleView(): IEditorView | null {
		if (this.editors.length !== 1) {
			console.warn('Cannot extract single view: NestedView contains', this.editors.length, 'views');

			return null;
		}

		const view = this.editors[0]!;

		// Remove from internal structures without disposing the view
		this.splitView.removeView(0); // This will dispose the ViewItem wrapper but return the view
		this.editors.splice(0, 1);

		// Clean up callback tracking
		this.editorCallbacks.delete(view.id);

		return view;
	}

}
