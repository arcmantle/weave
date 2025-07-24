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
		private contentArea: ContentArea,
	) {
		this.element = document.createElement('div');
		this.element.className = 'editor-view';
		this.element.innerHTML = `
			<div class="editor-tab">
				<span class="editor-title">${ title }</span>
				<button class="editor-close" data-editor-id="${ id }">×</button>
			</div>
			<div class="editor-content"></div>
		`;
	}

	onDidChange = (callback: (size?: number) => void): void => {
		// In a real implementation, you would set up event listeners
		// for when the view's constraints might change
		// For now, this is a no-op since our editors have fixed constraints
	};

	layout(size: number, offset: number, context: undefined): void {
		// The parent .split-view-view container is already being positioned and sized
		// by the SplitView, so we don't need to apply additional styles here.
		// The .editor-view will inherit the full size from its parent container.
	}

	dispose(): void {
		this.element.remove();
	}

}

export class EditorAreaCmp extends ContentArea {

	static override tagName:  string = 'ho-editor-area';
	override contentLocation: ContentLocation = 'editor';

	protected editorArea: EditorAreaService = this.inject.get('editor-area');

	@state() private accessor splitView: SplitView<undefined, EditorView> | null = null;
	@state() private accessor editors: EditorView[] = [];
	private resizeObserver: ResizeObserver | null = null;

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
			orientation:        Orientation.HORIZONTAL,
			proportionalResize: true,  // Test sequential neighbor resize behavior
		});

		// Create initial editors
		// Add both editors with Sizing.Distribute to ensure equal space distribution
		this.createEditor('welcome', 'Welcome', Sizing.Distribute);
		this.createEditor('editor-1', 'Editor 1', Sizing.Distribute);
		this.createEditor('editor-2', 'Editor 2', Sizing.Distribute);
		this.createEditor('editor-3', 'Editor 3', Sizing.Distribute);

		// Force initial layout with container dimensions
		this.splitView.layout(container.offsetWidth);

		// Set up ResizeObserver to handle container size changes
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
				}
			}
		});

		// Start observing the container for size changes
		this.resizeObserver.observe(container);
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
		const editorView = new EditorViewImpl(id, title, this);
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
		const newId = `editor-${ Date.now() }`;
		const newTitle = `Editor ${ this.editors.length + 1 }`;
		this.createEditor(newId, newTitle);
	}

	protected override render(): unknown {
		return <>
			<div class="editor-toolbar">
				<button on-click={() => this.splitEditor('horizontal')}>Split Right</button>
				<button on-click={() => this.splitEditor('vertical')}>Split Down</button>
			</div>
			<div class="editor-container"></div>
		</>;
	}

	static override styles: CSSStyle = [
		splitViewStyles,
		css`
		:host {
			contain: strict;
			display: flex;
			flex-direction: column;
			height: 100%;
			background: var(--vscode-editor-background);
			--sash-active-color: var(--vscode-focusBorder);
			--sash-hover-color: green;
			--vscode-tab-activeBackground: blue;
		}

		.editor-toolbar {
			display: flex;
			gap: 8px;
			padding: 8px;
			background: var(--vscode-editorGroupHeader-tabsBackground);
			border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);
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

		.editor-container {
			flex: 1;
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
