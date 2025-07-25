import { state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle, html, render, type Signal } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';
import { SplitView } from './splitview/split-view.ts';
import splitViewStyles from './splitview/splitview.css' with { type: 'css'};
import { type IView, Orientation, Sizing } from './splitview/types.ts';


interface IEditorView extends IView {
	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize: number;
	readonly maximumSize: number;
	dispose(): void;
}


class EditorView implements IEditorView {

	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 100;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;

	private onRemove?: (id: string) => void;

	constructor(
		id: string,
		title: string,
		onRemove?: (id: string) => void,
	) {
		this.id      = id;
		this.title   = title;
		this.onRemove = onRemove;
		this.element = document.createElement('div');
		this.element.className = 'editor-view';
		render(html`
		<div class="editor-tab">
			<span class="editor-title">${ title }</span>
			<button class="editor-close" @click=${ this.handleClose }>x</button>
		</div>
		<div class="editor-content"></div>
		`, this.element);
	}

	private handleClose = (): void => {
		console.log(`Editor ${ this.id } requesting removal`);
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
class NestedView implements IEditorView {

	constructor(id: string, title: string, orientation: Orientation) {
		this.id      = id;
		this.title   = title;
		this.element = document.createElement('div');
		this.element.className = 'nested-split-view';
		this.element.style.cssText = `
			width: 100%;
			height: 100%;
			position: relative;
		`;

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

	private splitView: SplitView<undefined, IEditorView>;
	private editors:   IEditorView[] = [];


	addEditor(editor: IEditorView): void {
		this.editors.push(editor);
		this.splitView.addView(editor, Sizing.Distribute);
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
		// Force proper distribution after all editors are added
		// Use a small delay to ensure the element has been properly inserted into the DOM
		const doLayout = () => {
			if (this.element.offsetWidth > 0 || this.element.offsetHeight > 0) {
				const size = this.splitView.orientation === Orientation.HORIZONTAL
					? this.element.offsetWidth
					: this.element.offsetHeight;

				this.splitView.layout(size);

				// Only force equal distribution if proportions haven't been saved yet
				// This preserves user adjustments made by dragging sashes
				if (!this.splitView.hasProportions)
					this.splitView.distributeViewSizes();
			}
			else {
				// If dimensions are still not available, retry after a short delay
				setTimeout(doLayout, 10);
			}
		};

		// Try immediate layout first, fallback to delayed if needed
		doLayout();
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
			console.warn(`Cannot convert NestedView to EditorView: contains ${ this.editors.length } editors, expected 1`);

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


export class EditorAreaCmp extends ContentArea {

	static override tagName:  string = 'ho-editor-area';
	override contentLocation: ContentLocation = 'editor';

	protected editorArea: EditorAreaService = this.inject.get('editor-area');

	@state() private accessor view: SplitView<undefined, IEditorView> | null = null;
	@state() private accessor editors: IEditorView[] = [];
	@state() private accessor nestedViews: NestedView[] = [];

	override connected(): void {
		super.connected();
	}

	override afterConnected(): void {
		super.afterConnected();

		this.initializeSplitView();
	}

	override disconnected(): void {
		super.disconnected();
		this.view?.dispose();
		this.editors.forEach(editor => editor.dispose());
		this.nestedViews.forEach(nestedView => nestedView.dispose());
		this.nestedViews.length = 0;
	}

	private initializeSplitView(): void {
		const container = this.querySelector('.editor-container') as HTMLElement;
		if (!container)
			return console.warn('EditorArea: Could not find .editor-container element');

		// Ensure container has dimensions before creating SplitView
		if (container.offsetWidth === 0 || container.offsetHeight === 0) {
			setTimeout(() => this.initializeSplitView(), 50);

			return console.warn('EditorArea: Container has no dimensions, retrying...');
		}

		this.view = new SplitView(container, {
			orientation:        Orientation.VERTICAL, // Start with vertical for rows
			proportionalResize: false,  // Test proportional resize behavior
		});

		this.view.enableAutoResize();

		// Listen to the main split view's resize events to update nested views
		this.view.onDidSashChange(() => {
			// Force all nested split views to redistribute their spaces
			// This ensures proportional behavior is maintained during resize
			for (const nestedView of this.nestedViews)
				nestedView.finalizeLayout();
		});

		// Create test scenario: Two rows, first row has 4 columns
		this.createTestScenario();
	}

	private createTestScenario(): void {
		if (!this.view)
			return;

		// Create first row with 4 columns
		const firstRow = new NestedView('row-1', 'Row 1', Orientation.HORIZONTAL);
		this.nestedViews.push(firstRow);  // Track for resize handling

		// Add 4 editors to the first row
		for (let i = 1; i <= 4; i++) {
			const editor = new EditorView(`row1-col${ i }`, `R1 C${ i }`, (id) => this.closeEditor(id));
			firstRow.addEditor(editor);
			this.editors.push(editor);
		}

		this.view.addView(firstRow, Sizing.Distribute);

		const secondRowEditor = new EditorView('row2-col1', 'Row 2', (id) => this.closeEditor(id));
		this.editors.push(secondRowEditor);
		this.view.addView(secondRowEditor, Sizing.Distribute);

		const thirdRowEditor = new EditorView('row3-col1', 'Row 3', (id) => this.closeEditor(id));
		this.editors.push(thirdRowEditor);
		this.view.addView(thirdRowEditor, Sizing.Distribute);
	}

	private createEditor(id: string, title: string, sizing: number | Sizing = Sizing.Distribute): void {
		const editorView = new EditorView(id, title, (id) => this.closeEditor(id));
		this.editors = [ ...this.editors, editorView ];

		if (this.view) {
			// Use the provided sizing strategy to control how space is allocated
			this.view.addView(editorView, sizing);
		}
	}

	private closeEditor(id: string): void {
		// First, try to find the editor in nested split views
		for (const nestedView of this.nestedViews) {
			const editor = nestedView.findEditor(id);
			if (editor) {
				// Remove from nested split view
				const removed = nestedView.removeEditor(id);
				if (!removed)
					return console.warn('Failed to remove editor from nested view');

				// Remove from main editors array
				this.editors = this.editors.filter(e => e.id !== id);

				// If the nested view is now empty, remove it from the main split view
				if (nestedView.editorCount === 0) {
					const removedView = this.view!.removeViewByReference(nestedView);

					if (removedView) {
						nestedView.dispose();
						const nestedViewIndex = this.nestedViews.indexOf(nestedView);
						if (nestedViewIndex !== -1)
							this.nestedViews.splice(nestedViewIndex, 1);
					}
				}

				// If no editors remain, create a welcome editor
				if (this.editors.length === 0)
					this.createEditor('welcome', 'Welcome');

				return;
			}
		}

		const editor = this.editors.find(e => e.id === id);
		if (!editor)
			return console.warn('Editor not found:', id);

		const removedView = this.view!.removeViewByReference(editor);
		if (removedView) {
			editor.dispose();
			this.editors = this.editors.filter(e => e.id !== id);

			// If no editors remain, create a welcome editor
			if (this.editors.length === 0)
				this.createEditor('welcome', 'Welcome');
		}
		else {
			console.warn('Failed to find editor in main split view');
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
			if (this.nestedViews.some(nv => nv.allEditors.includes(editorView))) {
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
		this.nestedViews.push(nestedView);

		// Restore layout and sizes
		this.restoreViewSizes(allSizes);
		nestedView.layoutInternal();

		return nestedView;
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

		const container = this.querySelector('.editor-container') as HTMLElement;
		if (!container)
			return;

		const size = this.view.orientation === Orientation.HORIZONTAL
			? container.offsetWidth
			: container.offsetHeight;

		this.view.layout(size);

		// Restore the exact sizes for all views to maintain proportions
		for (let i = 0; i < Math.min(this.view.length, allSizes.length); i++) {
			const targetSize = allSizes[i];
			if (targetSize !== undefined) {
				const currentSize = this.view.getViewSize(i);
				if (Math.abs(currentSize - targetSize) > 1)
					this.view.setViewSize(i, targetSize);
			}
		}
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

		const nestedIndex = this.nestedViews.indexOf(nestedView);
		if (nestedIndex !== -1)
			this.nestedViews.splice(nestedIndex, 1);

		nestedView.dispose();

		// Restore layout and sizes
		this.restoreViewSizes(allSizes);

		return editorView;
	}

	splitEditor(direction: 'horizontal' | 'vertical' = 'horizontal'): void {
		if (!this.view)
			return;

		const newId     = `editor-${ Date.now() }`;
		const newTitle  = `Editor ${ this.editors.length + 1 }`;
		const newEditor = new EditorView(newId, newTitle, (id) => this.closeEditor(id));

		if (direction === 'horizontal') {
			// Add a new column to the first row (NestedSplitView)
			if (this.nestedViews.length > 0) {
				const firstRow = this.nestedViews[0];
				if (firstRow) {
					firstRow.addEditor(newEditor);
					this.editors.push(newEditor);

					// Force layout update after adding to nested view
					firstRow.finalizeLayout();
				}
			}
		}
		else {
			// Add a new row to the main vertical split view
			this.editors.push(newEditor);
			this.view.addView(newEditor, Sizing.Distribute);
		}
	}

	protected override render(): unknown {
		return <>
			<div class="editor-toolbar">
				<button on-click={() => this.splitEditor('horizontal')}>Add Column to Row 1</button>
				<button on-click={() => this.splitEditor('vertical')}>Add New Row</button>
				<button on-click={() => this.testConvertToNested()}>Test: Convert Editor to Nested</button>
				<button on-click={() => this.testConvertToEditor()}>Test: Convert Nested to Editor</button>
			</div>
			<div class="editor-container"></div>
		</>;
	}

	private testConvertToNested(): void {
		// Find the first standalone editor in the main view
		const standaloneEditor = this.editors.find(e => e instanceof EditorView && this.view?.indexOf(e) !== -1);
		if (standaloneEditor instanceof EditorView)
			this.convertEditorToNested(standaloneEditor, Orientation.HORIZONTAL);
	}

	private testConvertToEditor(): void {
		// Find the first nested view with exactly one editor
		const convertibleNested = this.nestedViews.find(nv => nv.editorCount === 1);
		if (convertibleNested)
			this.convertNestedToEditor(convertibleNested);
	}

	static override styles: CSSStyle = [
		splitViewStyles,
		css`
		:host {
			--sash-active-color: var(--vscode-focusBorder);
			--sash-hover-color: green;
			--vscode-tab-activeBackground: blue;

			contain: strict;
			display: flex;
			flex-direction: column;
			height: 100%;
			background: var(--vscode-editor-background);
		}
		.editor-toolbar {
			display: flex;
			gap: 8px;
			padding: 8px;
			background: var(--vscode-editorGroupHeader-tabsBackground);
			border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);
			align-items: center;
		}
		.editor-toolbar button {
			padding: 4px 8px;
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 2px;
			cursor: pointer;
			font-size: 12px;
		}
		.editor-toolbar button:hover {
			background: var(--vscode-button-hoverBackground);
		}
		.toolbar-info {
			margin-left: auto;
			font-size: 11px;
			color: var(--vscode-descriptionForeground);
			font-style: italic;
		}
		.editor-container {
			flex: 1;
			position: relative;
		}
		.nested-split-view {
			width: 100%;
			height: 100%;
			position: relative;
		}
		.editor-view {
			display: flex;
			flex-direction: column;
			height: 100%;
			background: var(--vscode-editor-background);
		}
		.editor-tab {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 8px 12px;
			background: var(--vscode-tab-activeBackground);
			border-bottom: 1px solid var(--vscode-tab-border);
			font-size: 13px;
		}
		.editor-title {
			color: var(--vscode-tab-activeForeground);
			font-weight: 500;
		}
		.editor-close {
			background: none;
			border: none;
			color: var(--vscode-tab-activeForeground);
			cursor: pointer;
			padding: 2px 4px;
			border-radius: 2px;
			font-size: 16px;
			opacity: 0.7;
		}
		.editor-close:hover {
			background: var(--vscode-toolbar-hoverBackground);
			opacity: 1;
		}
		.editor-content {
			flex: 1;
			padding: 16px;
			color: var(--vscode-editor-foreground);
			overflow: auto;
		}
		`,
	];

}


export const EditorArea: ToComponent<EditorAreaCmp> =
	toComponent(EditorAreaCmp);


export class EditorAreaService {

	visible: Signal<boolean> = layoutPreferences.editorArea.visible;

}
