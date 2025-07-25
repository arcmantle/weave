import { state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle, type Signal } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';
import { SplitView } from './splitview/split-view.ts';
import splitViewStyles from './splitview/splitview.css' with { type: 'css'};
import { type IView, Orientation, Sizing } from './splitview/types.ts';


interface EditorView extends IView {
	readonly id:                  string;
	readonly title:               string;
	readonly element:             HTMLElement;
	readonly minimumSize:         number;
	readonly maximumSize:         number;
	readonly proportionalLayout?: boolean;
	dispose(): void;
}

class EditorViewImpl implements EditorView {

	readonly element: HTMLElement;
	readonly minimumSize = 200;
	readonly maximumSize = Number.POSITIVE_INFINITY;
	readonly proportionalLayout = true;

	constructor(
		readonly id: string,
		readonly title: string,
	) {
		this.element = document.createElement('div');
		this.element.className = 'editor-view';
		this.element.innerHTML = `
			<div class="editor-tab">
				<span class="editor-title">${ title }</span>
				<button class="editor-close" data-editor-id="${ id }">x</button>
			</div>
			<div class="editor-content"></div>
		`;
	}

	layout(size: number, offset: number, context: undefined): void {
		// The parent .split-view-view container is already being positioned and sized
		// by the SplitView, so we don't need to apply additional styles here.
		// The .editor-view will inherit the full size from its parent container.
	}

	dispose(): void {
		this.element.remove();
	}

}

// Wrapper to make a SplitView behave like an EditorView for nesting
class NestedSplitView implements EditorView {

	readonly element: HTMLElement;
	readonly minimumSize = 200;
	readonly maximumSize = Number.POSITIVE_INFINITY;
	readonly proportionalLayout = true;

	private splitView: SplitView<undefined, EditorView>;
	private editors:   EditorView[] = [];

	constructor(
		readonly id: string,
		readonly title: string,
		orientation: Orientation,
	) {
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

	addEditor(editor: EditorView): void {
		this.editors.push(editor);
		this.splitView.addView(editor, Sizing.Distribute);
	}

	finalizeLayout(): void {
		// Force proper distribution after all editors are added
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
	}

	layout(size: number, offset: number, context: undefined): void {
		// Layout the nested split view with the correct dimension
		// For horizontal orientation, we use the full size (width)
		// For vertical orientation, we use the full size (height)
		this.splitView.layout(size);

		if (this.editors.length > 1)
			this.finalizeLayout();
	}

	dispose(): void {
		this.splitView.dispose();
		this.editors.forEach(editor => editor.dispose());
		this.element.remove();
	}

}

export class EditorAreaCmp extends ContentArea {

	static override tagName:  string = 'ho-editor-area';
	override contentLocation: ContentLocation = 'editor';

	protected editorArea: EditorAreaService = this.inject.get('editor-area');

	@state() private accessor splitView: SplitView<undefined, EditorView> | null = null;
	@state() private accessor editors: EditorView[] = [];
	private resizeObserver:   ResizeObserver | null = null;
	private nestedSplitViews: NestedSplitView[] = [];  // Track nested views for resize handling

	override connected(): void {
		super.connected();

		// Ensure the DOM is fully rendered and has dimensions
		this.updateComplete.then(() => {
			this.initializeSplitView();
			this.setupEventListeners();
		});
	}

	override disconnected(): void {
		super.disconnected();
		this.resizeObserver?.disconnect();
		this.splitView?.dispose();
		this.editors.forEach(editor => editor.dispose());
		this.nestedSplitViews.forEach(nestedView => nestedView.dispose());
		this.nestedSplitViews = [];
	}

	private initializeSplitView(): void {
		const container = this.querySelector('.editor-container') as HTMLElement;
		if (!container) {
			console.warn('EditorArea: Could not find .editor-container element');

			return;
		}

		// Ensure container has dimensions before creating SplitView
		if (container.offsetWidth === 0 || container.offsetHeight === 0) {
			console.warn('EditorArea: Container has no dimensions, retrying...');
			setTimeout(() => this.initializeSplitView(), 50);

			return;
		}

		this.splitView = new SplitView(container, {
			orientation:        Orientation.VERTICAL, // Start with vertical for rows
			proportionalResize: false,  // Test proportional resize behavior
		});

		// Create test scenario: Two rows, first row has 4 columns
		this.createTestScenario();

		// Set up ResizeObserver to handle container size changes
		// Starting the resize observer forces initial layout with container dimensions
		this.setupResizeObserver(container);
	}

	private setupResizeObserver(container: HTMLElement): void {
		this.resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				if (entry.target === container && this.splitView) {
					// Get the new dimensions
					const newSize = this.splitView.orientation === Orientation.HORIZONTAL
						? entry.contentRect.width
						: entry.contentRect.height;

					// Update the SplitView layout with the new container size
					this.splitView.layout(newSize);

					// Force all nested split views to redistribute their spaces
					// This ensures proportional behavior is maintained during resize
					for (const nestedView of this.nestedSplitViews)
						nestedView.finalizeLayout();
				}
			}
		});

		// Start observing the container for size changes
		this.resizeObserver.observe(container);
	}

	private createTestScenario(): void {
		if (!this.splitView)
			return;

		// Create first row with 4 columns
		const firstRow = new NestedSplitView('row-1', 'Row 1', Orientation.HORIZONTAL);
		this.nestedSplitViews.push(firstRow);  // Track for resize handling

		// Add 4 editors to the first row
		for (let i = 1; i <= 4; i++) {
			const editor = new EditorViewImpl(`row1-col${ i }`, `R1 C${ i }`);
			firstRow.addEditor(editor);
			this.editors.push(editor);
		}

		// Create second row with 1 editor
		const secondRowEditor = new EditorViewImpl('row2-col1', 'Row 2');
		this.editors.push(secondRowEditor);

		// Add both rows to the main vertical split view
		this.splitView.addView(firstRow, Sizing.Distribute);
		this.splitView.addView(secondRowEditor, Sizing.Distribute);
	}

	private setupEventListeners(): void {
		this.addEventListener('click', this.handleClick);
	}

	private handleClick = (event: Event): void => {
		const target = event.target as HTMLElement;

		if (target.classList.contains('editor-close')) {
			const editorId = target.dataset['editorId'];
			if (editorId)
				this.closeEditor(editorId);
		}
	};

	private createEditor(id: string, title: string, sizing: number | Sizing = Sizing.Distribute): void {
		const editorView = new EditorViewImpl(id, title);
		this.editors = [ ...this.editors, editorView ];

		if (this.splitView) {
			// Use the provided sizing strategy to control how space is allocated
			this.splitView.addView(editorView, sizing);
		}
	}

	private closeEditor(id: string): void {
		const editorIndex = this.editors.findIndex(editor => editor.id === id);
		if (editorIndex === -1)
			return;

		const editor = this.editors[editorIndex];
		if (!editor)
			return;

		if (this.splitView)
			this.splitView.removeView(editorIndex);

		editor.dispose();
		this.editors = this.editors.filter(e => e.id !== id);

		// If no editors remain, create a welcome editor
		if (this.editors.length === 0)
			this.createEditor('welcome', 'Welcome');
	}

	splitEditor(direction: 'horizontal' | 'vertical' = 'horizontal'): void {
		if (!this.splitView)
			return;

		const newId = `editor-${ Date.now() }`;
		const newTitle = `Editor ${ this.editors.length + 1 }`;

		const newEditor = new EditorViewImpl(newId, newTitle);

		if (direction === 'horizontal') {
			// Add a new column to the first row (NestedSplitView)
			if (this.nestedSplitViews.length > 0) {
				const firstRow = this.nestedSplitViews[0];
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
			this.splitView.addView(newEditor, Sizing.Distribute);
		}
	}

	protected override render(): unknown {
		return <>
			<div class="editor-toolbar">
				<button on-click={() => this.splitEditor('horizontal')}>Add Column to Row 1</button>
				<button on-click={() => this.splitEditor('vertical')}>Add New Row</button>
			</div>
			<div class="editor-container"></div>
		</>;
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
