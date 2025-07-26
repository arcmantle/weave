import { state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle, html, type Signal } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';
import {
	type EditorTemplateContext,
	EditorView,
	NestedView,
	Orientation,
	Sizing,
	ViewManager,
} from './splitview/index.ts';
import splitViewStyles from './splitview/split-view.css' with { type: 'css'};


// Default template function for editors
const defaultEditorTemplate = (context: EditorTemplateContext) => html`
	<div class="editor-tab">
		<span class="editor-title">${ context.title }</span>
		<button class="editor-close" @click=${ context.handleClose }>x</button>
	</div>
	<div class="editor-content">Content for ${ context.title }</div>
`;


export class EditorAreaCmp extends ContentArea {

	static override tagName:  string = 'ho-editor-area';
	override contentLocation: ContentLocation = 'editor';

	protected editorArea: EditorAreaService = this.inject.get('editor-area');

	@state() private accessor viewManager: ViewManager | null = null;

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
		if (!this.viewManager?.isInitialized)
			return;

		// Create first row with 4 columns
		const firstRow = new NestedView('row-1', 'Row 1', Orientation.HORIZONTAL);

		// Add 4 editors to the first row - create them directly like the original
		for (let i = 1; i <= 4; i++) {
			const editor = new EditorView(
				`row1-col${ i }`,
				`R1 C${ i }`,
				defaultEditorTemplate,
				(id) => this.viewManager!.closeEditor(id),
			);
			firstRow.addEditor(editor);
			// Register with ViewManager's editor tracking
			this.viewManager.registerEditor(editor);
		}

		// Add the nested view with explicit Distribute sizing
		this.viewManager.addNestedView(firstRow, Sizing.Distribute);

		// Add standalone rows using createEditor (which handles its own state management)
		this.viewManager.createEditor('row2-col1', 'Row 2', undefined, Sizing.Distribute);
		this.viewManager.createEditor('row3-col1', 'Row 3', undefined, Sizing.Distribute);

		//const tabView = new TabView('test-tab-view', 'Tab View Test', (id) => {
		//	console.log('Tab closed:', id);
		//});

		//// Create some test editors for the tab view
		//const editor1 = new EditorView('tab-editor-1', 'Tab 1', defaultEditorTemplate);
		//const editor2 = new EditorView('tab-editor-2', 'Tab 2', defaultEditorTemplate);
		//const editor3 = new EditorView('tab-editor-3', 'Tab 3', defaultEditorTemplate);

		//// Add editors to the tab view
		//tabView.addEditor(editor1);
		//tabView.addEditor(editor2);
		//tabView.addEditor(editor3);

		//// Add the tab view to the main view manager
		//this.viewManager.addView(tabView, Sizing.Distribute);
	}

	private getFirstStandaloneEditor(): EditorView | null {
		if (!this.viewManager)
			return null;

		return this.viewManager.getFirstStandaloneEditor();
	}

	private getFirstConvertibleNested(): NestedView | null {
		if (!this.viewManager)
			return null;

		return this.viewManager.getFirstConvertibleNested();
	}

	private splitEditor(direction: 'horizontal' | 'vertical' = 'horizontal'): void {
		this.viewManager?.splitEditor(direction);
	}

	private testConvertToNested(): void {
		const standaloneEditor = this.getFirstStandaloneEditor();
		if (standaloneEditor)
			this.viewManager?.convertEditorToNested(standaloneEditor, Orientation.HORIZONTAL);
	}

	private testConvertToEditor(): void {
		const convertibleNested = this.getFirstConvertibleNested();
		if (convertibleNested)
			this.viewManager?.convertNestedToEditor(convertibleNested);
	}

	private testCreateTabView(): void {
		if (!this.viewManager?.isInitialized)
			return;

		// Create a new TabView using the ViewManager's helper method
		const tabView = this.viewManager.createTabView('test-tab-view', 'Tab View Test');

		// Create some test editors for the tab view with different removal behaviors
		const editor1 = new EditorView('tab-editor-1', 'Tab 1 (Normal)', defaultEditorTemplate);
		const editor2 = new EditorView('tab-editor-2', 'Tab 2 (Allowed)', defaultEditorTemplate);
		const editor3 = new EditorView('tab-editor-3', 'Tab 3 (Protected)', defaultEditorTemplate);

		// Add editors with different removal behaviors
		this.viewManager.addEditorToTabView(tabView, editor1); // No callback = always removable

		this.viewManager.addEditorToTabView(tabView, editor2, (id) => {
			console.log(`Tab 2 removal requested - allowing removal`);

			return true; // Allow removal
		});

		this.viewManager.addEditorToTabView(tabView, editor3, (id) => {
			console.log(`Tab 3 removal blocked - this tab is protected!`);

			return false; // Block removal
		});

		// Add the tab view to the main view manager
		this.viewManager.addView(tabView, Sizing.Distribute);

		// Also create a NestedView with similar behavior
		const nestedView = this.viewManager.createNestedView('test-nested-view', 'Nested View Test', Orientation.HORIZONTAL);

		const nestedEditor1 = new EditorView('nested-editor-1', 'Nested 1 (Normal)', defaultEditorTemplate);
		const nestedEditor2 = new EditorView('nested-editor-2', 'Nested 2 (Protected)', defaultEditorTemplate);

		this.viewManager.addEditorToNestedView(nestedView, nestedEditor1); // No callback = always removable

		this.viewManager.addEditorToNestedView(nestedView, nestedEditor2, (id) => {
			console.log(`Nested editor 2 removal blocked - this editor is protected!`);

			return false; // Block removal
		});

		// Add the nested view to the main view manager
		this.viewManager.addView(nestedView, Sizing.Distribute);

		// Create a protected standalone editor
		this.viewManager.createEditor(
			'standalone-protected',
			'Standalone (Protected)',
			undefined,
			Sizing.Distribute,
			(id) => {
				console.log(`Standalone editor removal blocked - this editor is protected!`);

				return false; // Block removal
			},
		);

		console.log('Created comprehensive test with protected editors in TabView, NestedView, and standalone!');
		console.log('Available conversions:');
		console.log('- TabView ↔ NestedView');
		console.log('- EditorView ↔ NestedView');
		console.log('- EditorView → TabView');
		console.log('- TabView → EditorView (if TabView has exactly 1 editor)');
		console.log('Use viewManager.convertView(sourceView, targetType, options) for unified conversions');
	}

	protected override render(): unknown {
		return <>
			<div class="editor-toolbar">
				<button on-click={() => this.splitEditor('horizontal')}>Add Column to Row 1</button>
				<button on-click={() => this.splitEditor('vertical')}>Add New Row</button>
				<button on-click={() => this.testConvertToNested()}>Test: Convert Editor to Nested</button>
				<button on-click={() => this.testConvertToEditor()}>Test: Convert Nested to Editor</button>
				<button on-click={() => this.testCreateTabView()}>Test: Create Tab View</button>
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
