import { render, type Signal, signal } from '@arcmantle/adapter-element/shared';

import { type DragDropConfig, DragDropManager } from './drag-drop-manager.ts';
import { SplitView } from './split-view.ts';
import { TabView } from './tab-view.ts';
import { type IView, Orientation, Sizing } from './types.ts';

export interface IEditorView extends IView {
	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize: number;
	readonly maximumSize: number;
	readonly type:        'editor' | 'nested' | 'tab';
	dispose(): void;
}

export interface EditorTemplateContext {
	handleClose: () => void;
	id:          string;
	title:       string;
}

export type EditorTemplateFunction = (context: EditorTemplateContext) => unknown;

export class EditorView implements IEditorView {

	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 100;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;
	readonly type = 'editor' as const;

	private onRemove?:        (id: string) => void;
	private templateFunction: EditorTemplateFunction;

	constructor(
		id: string,
		title: string,
		templateFunction: EditorTemplateFunction,
		onRemove?: (id: string) => void,
	) {
		this.id = id;
		this.title = title;
		this.templateFunction = templateFunction;
		this.onRemove = onRemove;
		this.element = document.createElement('div');
		this.element.className = 'editor-view';

		this.renderTemplate();
	}

	private renderTemplate(): void {
		const context: EditorTemplateContext = {
			handleClose: this.handleClose,
			id:          this.id,
			title:       this.title,
		};

		const template = this.templateFunction(context);
		render(template, this.element);
	}

	private handleClose = (): void => {
		this.onRemove?.(this.id);
	};

	layout(size: number, offset: number, context: undefined): void {
		// The parent .split-view-view container is already being positioned and sized
		// by the SplitView, so we don't need to apply additional styles here.
		// The .editor-view will inherit the full size from its parent container.
	}

	dispose(): void {
		this.element.remove();
	}

	/**
	 * Convert this EditorView into a NestedView containing this editor
	 * @param orientation The orientation for the new nested view
	 * @returns A new NestedView containing this editor
	 */
	toNestedView(orientation: Orientation): NestedView {
		const nestedView = new NestedView(
			`nested-${ this.id }`,
			`Nested ${ this.title }`,
			orientation,
		);

		// Add this editor to the nested view
		nestedView.addEditor(this);

		// Don't call finalizeLayout here - let the parent handle it
		// This prevents premature size distribution that could interfere with size preservation

		return nestedView;
	}

}

// Wrapper to make a SplitView behave like an EditorView for nesting
export class NestedView implements IEditorView {

	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 100;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;
	readonly type = 'nested' as const;

	private splitView: SplitView<undefined, IEditorView>;
	private editors:   IEditorView[] = [];

	constructor(id: string, title: string, orientation: Orientation) {
		this.id      = id;
		this.title   = title;
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
		this.editors.push(editor);

		if (this.editors.length === 1) {
			// First editor gets all available space
			this.splitView.addView(editor, Sizing.Distribute);
		}
		else {
			// New editor gets equal share (1/n of total space)
			this.addEditorWithProportionalSizing(editor, 1 / this.editors.length);
		}
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

export class ViewManager {

	// Signals for reactive state
	private _editors = signal<IEditorView[]>([]);
	private _nestedViews = signal<NestedView[]>([]);
	private _views = signal<IEditorView[]>([]); // Track all views (including TabView, etc.)

	readonly editors:     Signal<IEditorView[]> = this._editors;
	readonly nestedViews: Signal<NestedView[]> = this._nestedViews;
	readonly views:       Signal<IEditorView[]> = this._views;

	private view:            SplitView<undefined, IEditorView> | null = null;
	private dragDropManager: DragDropManager | null = null;

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
			for (const nestedView of this._nestedViews.value)
				nestedView.finalizeLayout();
		});
	}

	/**
	 * Create a new editor with the specified template function
	 */
	createEditor(
		id: string,
		title: string,
		templateFunction?: EditorTemplateFunction,
		sizing: number | Sizing = Sizing.Distribute,
	): EditorView {
		const templateFn = templateFunction || this.defaultTemplateFunction;
		const editorView = new EditorView(id, title, templateFn, (id) => this.closeEditor(id));

		this._editors.value = [ ...this._editors.value, editorView ];

		if (this.view)
			this.view.addView(editorView, sizing);

		// Initialize drag functionality for the new editor
		if (this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(editorView);

		return editorView;
	}

	/**
	 * Close an editor by ID
	 */
	closeEditor(id: string): void {
		// First, try to find the editor in TabViews
		for (const view of this._views.value) {
			if (isTabView(view)) {
				const editor = view.findEditor(id);
				if (editor) {
					const removed = view.removeEditor(id);
					if (!removed)
						return console.warn('Failed to remove editor from TabView');

					// Remove from main editors array
					this._editors.value = this._editors.value.filter(e => e.id !== id);

					// If the TabView is now empty, optionally remove it
					if (view.editorCount === 0) {
						const removedView = this.view!.removeViewByReference(view);
						if (removedView) {
							view.dispose();
							this.removeViewFromTracking(view);
						}
					}

					// If no editors remain, create a welcome editor
					if (this._editors.value.length === 0)
						this.createEditor('welcome', 'Welcome');

					return;
				}
			}
		}

		// Next, try to find the editor in nested split views
		for (const nestedView of this._nestedViews.value) {
			const editor = nestedView.findEditor(id);
			if (editor) {
				// Remove from nested split view
				const removed = nestedView.removeEditor(id);
				if (!removed)
					return console.warn('Failed to remove editor from nested view');

				// Remove from main editors array
				this._editors.value = this._editors.value.filter(e => e.id !== id);

				// If the nested view is now empty, remove it from the main split view
				if (nestedView.editorCount === 0) {
					const removedView = this.view!.removeViewByReference(nestedView);

					if (removedView) {
						nestedView.dispose();
						this.removeViewFromTracking(nestedView);
					}
				}

				// If no editors remain, create a welcome editor
				if (this._editors.value.length === 0)
					this.createEditor('welcome', 'Welcome');

				return;
			}
		}

		// Finally, check for standalone editors
		const editor = this._editors.value.find(e => e.id === id);
		if (!editor)
			return console.warn('Editor not found:', id);

		const removedView = this.view!.removeViewByReference(editor);
		if (removedView) {
			editor.dispose();
			this.removeViewFromTracking(editor);

			// If no editors remain, create a welcome editor
			if (this._editors.value.length === 0)
				this.createEditor('welcome', 'Welcome');
		}
		else {
			console.warn('Failed to find editor in main split view');
		}
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
		const newTitle = `Editor ${ this._editors.value.length + 1 }`;
		const newEditor = new EditorView(newId, newTitle, this.defaultTemplateFunction, (id) => this.closeEditor(id));

		if (direction === 'horizontal') {
			// Add a new column to the first row (NestedSplitView)
			if (this._nestedViews.value.length > 0) {
				const firstRow = this._nestedViews.value[0];
				if (firstRow) {
					firstRow.addEditor(newEditor);
					this._editors.value = [ ...this._editors.value, newEditor ];
				}
			}
		}
		else {
			// Add a new row to the main vertical split view
			this._editors.value = [ ...this._editors.value, newEditor ];

			if (this.view.length === 0) {
				// First view gets all space
				this.view.addView(newEditor, Sizing.Distribute);
			}
			else {
				// New view gets equal share (1/(n+1) of total space)
				this.addViewWithProportionalSizing(newEditor, 1 / (this.view.length + 1));
			}
		}
	}

	/**
	 * Convert an EditorView to a NestedView in place
	 * @param editorView The EditorView to convert
	 * @param orientation The orientation for the new NestedView
	 * @returns The new NestedView, or null if conversion failed
	 */
	convertEditorToNested(editorView: EditorView, orientation: Orientation): NestedView | null {
		if (!this.view)
			return null;

		const viewIndex = this.view.indexOf(editorView);
		if (viewIndex === -1) {
			// Check if it's in a nested view (unsupported for now)
			if (this._nestedViews.value.some(nv => nv.allEditors.includes(editorView))) {
				console.warn('Cannot convert editor that is already inside a nested view');

				return null;
			}

			console.warn('EditorView not found in any split view');

			return null;
		}

		// Capture sizes, convert, and replace
		const allSizes = this.captureViewSizes();
		const nestedView = editorView.toNestedView(orientation);

		this.view.removeView(viewIndex);
		this.view.addView(nestedView, allSizes[viewIndex]!, viewIndex, true);
		this._nestedViews.value = [ ...this._nestedViews.value, nestedView ];

		// Restore layout and sizes
		this.restoreViewSizes(allSizes);
		nestedView.layoutInternal();

		return nestedView;
	}

	/**
	 * Convert a NestedView to an EditorView in place (if it contains exactly one editor)
	 * @param nestedView The NestedView to convert
	 * @returns The EditorView, or null if conversion failed
	 */
	convertNestedToEditor(nestedView: NestedView): EditorView | null {
		if (!this.view)
			return null;

		const viewIndex = this.view.indexOf(nestedView);
		if (viewIndex === -1) {
			console.warn('NestedView not found in main split view');

			return null;
		}

		// Capture sizes and try conversion
		const allSizes = this.captureViewSizes();
		const editorView = nestedView.toEditorView();
		if (!editorView)
			return null; // Conversion failed (logged in toEditorView)

		// Replace view and clean up tracking
		this.view.removeView(viewIndex);
		this.view.addView(editorView, allSizes[viewIndex] ?? 100, viewIndex, true);

		this._nestedViews.value = this._nestedViews.value.filter(nv => nv !== nestedView);
		nestedView.dispose();

		// Restore layout and sizes
		this.restoreViewSizes(allSizes);

		return editorView;
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

		this._nestedViews.value = [ ...this._nestedViews.value, nestedView ];
		this.view.addView(nestedView, sizing);
	}

	/**
	 * Get the first standalone editor (for testing purposes)
	 */
	getFirstStandaloneEditor(): EditorView | null {
		const standaloneEditor = this._editors.value.find(e => e instanceof EditorView && this.view?.indexOf(e) !== -1);

		return standaloneEditor instanceof EditorView ? standaloneEditor : null;
	}

	/**
	 * Get the first convertible nested view (for testing purposes)
	 */
	getFirstConvertibleNested(): NestedView | null {
		return this._nestedViews.value.find(nv => nv.editorCount === 1) || null;
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
		this._editors.value = [ ...this._editors.value, editor ];

		// Initialize drag functionality for the registered editor
		if (this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(editor);
	}

	/**
	 * Remove an editor from tracking without disposing it (for drag-drop operations)
	 */
	removeEditorFromTracking(editorId: string): EditorView | null {
		const editor = this._editors.value.find(e => e.id === editorId);
		if (!editor || !isEditorView(editor))
			return null;

		// Remove from editors array
		this._editors.value = this._editors.value.filter(e => e.id !== editorId);

		// Check TabViews first
		for (const view of this._views.value) {
			if (isTabView(view)) {
				const foundEditor = view.findEditor(editorId);
				if (foundEditor) {
					view.removeEditor(editorId);

					// If the view is now empty, remove it
					if (view.editorCount === 0) {
						const removedView = this.view?.removeViewByReference(view);
						if (removedView) {
							view.dispose();
							this.removeViewFromTracking(view);
						}
					}

					return editor;
				}
			}
		}

		// Remove from nested views if present
		for (const nestedView of this._nestedViews.value) {
			if (nestedView.removeEditor(editorId)) {
				// If nested view is now empty, remove it
				if (nestedView.editorCount === 0) {
					const removedView = this.view?.removeViewByReference(nestedView);
					if (removedView) {
						nestedView.dispose();
						this.removeViewFromTracking(nestedView);
					}
				}

				return editor;
			}
		}

		// Remove from main view
		const removedView = this.view?.removeViewByReference(editor);
		if (removedView) {
			this.removeViewFromTracking(editor);

			return editor;
		}

		return null;
	}

	/**
	 * Add an existing editor to the view manager
	 */
	addExistingEditor(editor: EditorView, sizing: number | Sizing = Sizing.Distribute): void {
		this._editors.value = [ ...this._editors.value, editor ];

		if (this.view)
			this.view.addView(editor, sizing);

		// Initialize drag functionality
		if (this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(editor);
	}

	/**
	 * Add an existing editor at a specific index in the main view
	 */
	addExistingEditorAtIndex(editor: EditorView, index: number, sizing: number | Sizing = Sizing.Distribute): void {
		this._editors.value = [ ...this._editors.value, editor ];

		if (this.view)
			this.view.addView(editor, sizing, index, true);

		// Initialize drag functionality
		if (this.dragDropManager)
			this.dragDropManager.initializeEditorDrag(editor);
	}

	/**
	 * Get the index of an editor in the main view (for drag-drop operations)
	 */
	getEditorIndex(editor: EditorView): number {
		return this.view?.indexOf(editor) ?? -1;
	}

	/**
	 * Remove a view from all tracking signals
	 */
	private removeViewFromTracking(view: IEditorView): void {
		// Remove from all views
		this._views.value = this._views.value.filter(v => v !== view);

		// Remove from specific type tracking
		if (isEditorView(view))
			this._editors.value = this._editors.value.filter(e => e !== view);

		if (isNestedView(view))
			this._nestedViews.value = this._nestedViews.value.filter(nv => nv !== view);
	}

	/**
	 * Add a view (like TabView) to the main split view
	 */
	addView(view: IEditorView, sizing: number | Sizing = Sizing.Distribute): void {
		if (!this.view)
			return;

		this.view.addView(view, sizing);

		// Track all views in the views signal
		this._views.value = [ ...this._views.value, view ];

		// If it's an EditorView, also track it in the editors signal and initialize drag functionality
		if (isEditorView(view)) {
			this._editors.value = [ ...this._editors.value, view ];

			if (this.dragDropManager)
				this.dragDropManager.initializeEditorDrag(view);
		}

		// If it's a NestedView, track it in the nestedViews signal
		if (isNestedView(view))
			this._nestedViews.value = [ ...this._nestedViews.value, view ];
	}

	/**
	 * Dispose all resources
	 */
	dispose(): void {
		this.dragDropManager?.dispose();
		this.view?.dispose();

		// Dispose all views (this includes TabViews, EditorViews, NestedViews, etc.)
		this._views.value.forEach(view => view.dispose());

		// Clear all tracking arrays
		this._editors.value = [];
		this._nestedViews.value = [];
		this._views.value = [];
	}

}

// Type guard functions for type-safe operations
export function isEditorView(view: IEditorView): view is EditorView {
	return view.type === 'editor';
}

export function isNestedView(view: IEditorView): view is NestedView {
	return view.type === 'nested';
}

export function isTabView(view: IEditorView): view is TabView {
	return view.type === 'tab';
}
