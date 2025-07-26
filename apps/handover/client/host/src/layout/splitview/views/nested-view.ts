import { SplitView } from '../split-view.ts';
import { Orientation, Sizing } from '../types.ts';
import { EditorView } from './editor-view.ts';
import { type EditorWithCallback, type IEditorView, isEditorView } from './shared.ts';


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
	private onRemoved?:      (id: string) => void;

	constructor(id: string, title: string, orientation: Orientation, onRemoved?: (id: string) => void) {
		this.id      = id;
		this.title   = title;
		this.onRemoved = onRemoved;
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
		(editor as any).onRemove = (id: string) => {
			// Try the per-editor callback first
			const editorCallback = this.editorCallbacks.get(id);
			const shouldRemove = editorCallback ? editorCallback(id) : true;

			// If callback returned false, don't remove
			if (shouldRemove === false)
				return;

			// Handle removal internally
			const removed = this.removeEditor(id);

			// Notify after successful removal
			if (removed && this.onRemoved)
				this.onRemoved(id);
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
		// Give space to the editor immediately to the right, or to the left if it's the rightmost
		const adjacentIndex = editorIndex < this.editors.length - 1 ? editorIndex + 1 : editorIndex - 1;
		let sizing: Sizing | undefined;
		if (adjacentIndex >= 0 && adjacentIndex < this.editors.length)
			sizing = { type: 'split', index: adjacentIndex };

		this.splitView.removeView(editorIndex, sizing);
		editor.dispose();
		this.editors.splice(editorIndex, 1);

		// Clean up the per-editor callback
		this.editorCallbacks.delete(id);

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

	dispose(): void {
		this.splitView.dispose();
		this.editors.forEach(editor => editor.dispose());
		this.element.remove();
	}

	/**
	 * Extract all editors with their callbacks for conversion purposes
	 * @returns Array of editors with their associated callbacks
	 */
	extractEditorsWithCallbacks(): EditorWithCallback[] {
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

	/**
	 * Convert this NestedView to a TabView containing all editors
	 * Note: This method will be implemented by the ViewManager to avoid circular dependencies
	 * @param onRemoved Optional callback for when editors are removed from the tab view
	 * @returns A new TabView containing all editors, or null if no EditorViews found
	 */
	toTabView?(onRemoved?: (id: string) => void): any {
		throw new Error('toTabView must be implemented by ViewManager to avoid circular dependencies');
	}

	/**
	 * Convert this NestedView to an EditorView if it contains exactly one editor
	 * @returns The single EditorView if successful, null if conversion is not possible
	 */
	toEditorView(): EditorView | null {
		// Can only convert if there's exactly one editor
		if (this.editors.length !== 1) {
			console.warn(''
				+ `Cannot convert NestedView to EditorView: contains`
				+ ` ${ this.editors.length } editors, expected 1`);

			return null;
		}

		const editor = this.editors[0];

		// Ensure it's actually an EditorView (not another NestedView)
		if (!(editor instanceof EditorView)) {
			console.warn('Cannot convert NestedView to EditorView: child is not an EditorView');

			return null;
		}

		// Remove the editor from this nested view without disposing it
		this.splitView.removeView(0);
		this.editors.splice(0, 1);

		// The editor is now standalone and can be used elsewhere
		return editor;
	}

}
