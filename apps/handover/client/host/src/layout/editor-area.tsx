import { AdapterElement, state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle, html, type Signal } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';
import splitViewStyles from './splitview/split-view.css' with { type: 'css'};
import { Orientation, Sizing } from './splitview/types.ts';
import { ViewManager } from './splitview/view-manager.ts';
import { type EditorTemplateContext } from './splitview/views/index.ts';


class TestCmp extends AdapterElement {

	static override tagName: string = 'ho-test-cmp';

	@state() private accessor count = 0;

	override connected(): void {
		super.connected();
	}

	override firstConnected(): void {
		super.firstConnected();

		setInterval(() => {
			this.count++;
		}, 1000);
	}

	protected override render(): unknown {
		return this.count;
	}

}
TestCmp.register();


// Default template function for editors
const defaultEditorTemplate = (context: EditorTemplateContext) => html`
	<div class="editor-content">
		<div>
			Content for ${ context.title }
		</div>
		<ho-test-cmp></ho-test-cmp>
	</div>
`;


export class EditorAreaCmp extends ContentArea {

	static override tagName:  string = 'ho-editor-area';
	override contentLocation: ContentLocation = 'editor';

	protected editorArea: EditorAreaService = this.inject.get('editor-area');

	@state() private accessor viewManager: ViewManager;

	override connected(): void {
		super.connected();
	}

	override afterConnected(): void {
		super.afterConnected();
		this.initializeViewManager();
	}

	override disconnected(): void {
		super.disconnected();
		this.viewManager?.dispose();
	}

	private initializeViewManager(): void {
		const container = this.querySelector('.editor-container') as HTMLElement;
		if (!container)
			return console.warn('EditorArea: Could not find .editor-container element');

		// Create ViewManager with container, default template, and drag-drop config
		this.viewManager = new ViewManager(container, defaultEditorTemplate, {
			dragThreshold:   5,
			dropZoneSize:    40,
			showDragPreview: true,
		});

		// Initialize with vertical orientation for rows
		this.viewManager.initialize(Orientation.VERTICAL);

		// Create test scenario
		this.createTestScenario();
	}

	private createTestScenario(): void {
		// Create first row with 4 columns each containing 2 editors
		const firstRowNestedView = this.viewManager.createNestedView(Orientation.HORIZONTAL);
		for (let i = 1; i <= 4; i++) {
			firstRowNestedView.createAndAddTabView(
				Sizing.Distribute,
				{ id: `row1-col${ i }a`, title: `R1 C${ i }a`, templateFunction: defaultEditorTemplate },
				{ id: `row1-col${ i }b`, title: `R1 C${ i }b`, templateFunction: defaultEditorTemplate },
			);
		}
		this.viewManager.addNestedView(firstRowNestedView, Sizing.Distribute);

		// Create second row with one TabView containing one editor
		const secondRowTabView = this.viewManager.createTabView();
		secondRowTabView.createAndAddEditor('row2-col1a', 'Row 2 Col 1a', defaultEditorTemplate);
		this.viewManager.addTabView(secondRowTabView);

		// Create third row with one TabView containing one editor
		const thirdRowTabView = this.viewManager.createTabView();
		thirdRowTabView.createAndAddEditor('row3-col1a', 'Row 3 Col 1a', defaultEditorTemplate);
		this.viewManager.addTabView(thirdRowTabView, Sizing.Distribute);
	}

	protected override render(): unknown {
		return <>
			<div class="editor-toolbar">
				<button on-click={() => this.viewManager?.splitEditor(Orientation.VERTICAL)}>
					Add New Row
				</button>
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
