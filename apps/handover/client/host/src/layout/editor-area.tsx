import { state } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle, html, type Signal } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';
import splitViewStyles from './splitview/split-view.css' with { type: 'css'};
import { Orientation, Sizing } from './splitview/types.ts';
import { ViewManager } from './splitview/view-manager.ts';
import { type EditorTemplateContext, NestedView, TabView } from './splitview/views/index.ts';


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

		// Add 4 editors to the first row via TabViews
		for (let i = 1; i <= 4; i++) {
			const tabView = new TabView(
				`row1-col${ i }-tab`,
				`R1 C${ i }`,
				undefined,
				undefined,
				defaultEditorTemplate,
			);

			// Create editor inside the TabView
			const editor = tabView.createEditor(
				`row1-col${ i }`,
				`R1 C${ i }`,
				defaultEditorTemplate,
				(id: string) => this.viewManager!.closeEditor(id),
			);

			firstRow.addEditorWithCallback(tabView);

			// Register both TabView and editor with ViewManager's tracking
			this.viewManager.addViewToTracking(tabView);
			this.viewManager.addViewToTracking(editor);
		}

		// Add the nested view with explicit Distribute sizing
		this.viewManager.addNestedView(firstRow, Sizing.Distribute);

		// Add standalone rows using createEditor (which now creates TabViews)
		this.viewManager.createEditor('row2-col1', 'Row 2', undefined, Sizing.Distribute);
		this.viewManager.createEditor('row3-col1', 'Row 3', undefined, Sizing.Distribute);
	}

	private getFirstSingleEditorTabView(): TabView | null {
		if (!this.viewManager)
			return null;

		return this.viewManager.getFirstSingleEditorTabView();
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
		const singleEditorTabView = this.getFirstSingleEditorTabView();
		if (singleEditorTabView)
			this.viewManager?.convertView(singleEditorTabView, 'nested', { orientation: Orientation.HORIZONTAL });
	}

	private testConvertToTab(): void {
		const convertibleNested = this.getFirstConvertibleNested();
		if (convertibleNested)
			this.viewManager?.convertView(convertibleNested, 'tab');
	}

	private testCreateTabView(): void {
		if (!this.viewManager?.isInitialized)
			return;

		// Create a new TabView using the ViewManager's helper method
		const tabView = this.viewManager.createTabView(
			'test-tab-view',
			'Tab View Test',
			undefined,
			undefined,
			defaultEditorTemplate,
		);

		// Create some test editors for the tab view with different removal behaviors
		tabView.createEditor('tab-editor-1', 'Tab 1 (Normal)', defaultEditorTemplate); // No callback = always removable

		tabView.createEditor('tab-editor-2', 'Tab 2 (Allowed)', defaultEditorTemplate, (id) => {
			console.log(`Tab 2 removal requested - allowing removal`);

			return true; // Allow removal
		});

		tabView.createEditor('tab-editor-3', 'Tab 3 (Protected)', defaultEditorTemplate, (id) => {
			console.log(`Tab 3 removal blocked - this tab is protected!`);

			return false; // Block removal
		});

		// Add the tab view to the main view manager
		this.viewManager.addView(tabView, Sizing.Distribute);

		// Also create a NestedView with similar behavior
		const nestedView = this.viewManager.createNestedView('test-nested-view', 'Nested View Test', Orientation.HORIZONTAL);

		// Create TabViews for the nested view (since we don't have standalone EditorViews anymore)
		const nestedTabView1 = new TabView(
			'nested-tab-1',
			'Nested 1 (Normal)',
			undefined,
			undefined,
			defaultEditorTemplate,
		);

		nestedTabView1.createEditor('nested-editor-1', 'Nested 1 (Normal)', defaultEditorTemplate);

		const nestedTabView2 = new TabView(
			'nested-tab-2',
			'Nested 2 (Protected)',
			undefined,
			undefined,
			defaultEditorTemplate,
		);

		nestedTabView2.createEditor('nested-editor-2', 'Nested 2 (Protected)', defaultEditorTemplate, (id) => {
			console.log(`Nested editor 2 removal blocked - this editor is protected!`);

			return false; // Block removal
		});

		this.viewManager.addViewToNestedView(nestedView, nestedTabView1); // No callback = always removable
		this.viewManager.addViewToNestedView(nestedView, nestedTabView2, (id) => {
			console.log(`Nested view removal blocked - this view is protected!`);

			return false; // Block removal
		});

		// Add the nested view to the main view manager
		this.viewManager.addView(nestedView, Sizing.Distribute);

		// Create a protected TabView
		const protectedTabView = this.viewManager.createTabView(
			'standalone-protected-tab',
			'Standalone (Protected)',
			(id) => {
				console.log(`Standalone tab removal blocked - this tab is protected!`);

				return false; // Block removal
			},
			undefined,
			defaultEditorTemplate,
		);

		protectedTabView.createEditor(
			'standalone-protected',
			'Standalone (Protected)',
			defaultEditorTemplate,
		);

		this.viewManager.addView(protectedTabView, Sizing.Distribute);

		console.log('Created comprehensive test with protected editors in TabView, NestedView, and standalone!');
		console.log('Available conversions:');
		console.log('- TabView ↔ NestedView');
		console.log('Use viewManager.convertView(sourceView, targetType, options) for unified conversions');
	}

	protected override render(): unknown {
		return <>
			<div class="editor-toolbar">
				<button on-click={() => this.splitEditor('horizontal')}>Add Column to Row 1</button>
				<button on-click={() => this.splitEditor('vertical')}>Add New Row</button>
				<button on-click={() => this.testConvertToNested()}>Test: Convert Tab to Nested</button>
				<button on-click={() => this.testConvertToTab()}>Test: Convert Nested to Tab</button>
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
