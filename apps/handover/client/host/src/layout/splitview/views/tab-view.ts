import { effect, type Signal, signal } from '@arcmantle/adapter-element/shared';
import { html, render } from 'lit-html';
import { classMap } from 'lit-html/directives/class-map.js';
import { map } from 'lit-html/directives/map.js';
import { createRef, type Ref, ref } from 'lit-html/directives/ref.js';

import type { IViewManager } from '../view-manager.ts';
import { EditorView } from './editor-view.ts';
import { type EditorTemplateFunction, type IEditorView } from './shared.ts';


/**
 * A view that displays multiple editors in tabs with one active editor visible
 */
export class TabView extends EventTarget implements IEditorView {

	constructor(viewManager: IViewManager) {
		super();

		this.id = `tab-view-${ crypto.randomUUID() }`;
		this.title = `Tab View ${ this.id }`;
		this._viewManager = new WeakRef(viewManager);

		this.element = document.createElement('div');
		this.element.className = 'tab-view';

		this.performRender();
	}

	readonly type = 'tab' as const;
	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 150;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;

	readonly editors:             Signal<EditorView[]>      = signal([]);
	readonly activeEditor:        Signal<EditorView | null> = signal(null);
	private readonly isVisible:   Signal<boolean>           = signal(true);
	readonly tabsContainer:       Ref<HTMLElement> = createRef<HTMLElement>();
	private readonly contentArea: Ref<HTMLElement> = createRef<HTMLElement>();

	private disposeRender?: () => void;
	private _viewManager:   WeakRef<IViewManager>;

	// Tab drag and drop state
	draggedTab:     { editor: EditorView; element: HTMLElement; } | null = null;
	dropIndicator:  HTMLElement | null = null;
	tabDragHandler: ReturnType<typeof createTabDragHandler> = createTabDragHandler.call(this);

	get viewManager(): IViewManager {
		const vm = this._viewManager.deref();
		if (!vm)
			throw new Error('ViewManager has been garbage collected');

		return vm;
	}

	get editorCount(): number {
		return this.editors.value.length;
	}


	private performRender(): void {
		this.disposeRender = effect(() => void render(this.render(), this.element));
	}

	private render(): unknown {
		const onClickTab = (editor: EditorView, ev: MouseEvent): void => {
			if (ev.target instanceof HTMLButtonElement)
				return;

			this.activeEditor.value = editor;
		};

		const onTabDragStart = (editor: EditorView, ev: DragEvent): void => {
			this.tabDragHandler.handleTabDragStart(editor, ev);
		};

		const onTabDragEnd = (editor: EditorView, ev: DragEvent): void => {
			this.tabDragHandler.handleTabDragEnd(editor, ev);
		};

		const onTabDragOver = (editor: EditorView, ev: DragEvent): void => {
			this.tabDragHandler.handleTabDragOver(editor, ev);
		};

		const onTabDrop = (editor: EditorView, ev: DragEvent): void => {
			this.tabDragHandler.handleTabDrop(editor, ev);
		};

		return html`
		<div
			${ ref(this.tabsContainer) }
			class=${ classMap({
				'tab-view-tabs': true,
				hidden:          !this.isVisible.value,
			}) }
			@dragover=${ this.tabDragHandler.handleContainerDragOver.bind(this.tabDragHandler) }
			@drop    =${ this.tabDragHandler.handleContainerDrop.bind(this.tabDragHandler) }
		>
			${ map(this.editors.value, editor => html`
			<div
				class=${ classMap({
					'tab-view-tab': true,
					active:         this.activeEditor.value === editor,
					dragging:       this.draggedTab?.editor === editor,
				}) }
				data-editor-id=${ editor.id }
				draggable="true"
				@click=${ onClickTab.bind(null, editor) }
				@dragstart=${ onTabDragStart.bind(null, editor) }
				@dragend=${ onTabDragEnd.bind(null, editor) }
				@dragover=${ onTabDragOver.bind(null, editor) }
				@drop=${ onTabDrop.bind(null, editor) }
			>
				<span class="tab-title">${ editor.title }</span>
				<button
					class="tab-close"
					@click=${ (ev: MouseEvent) => {
						ev.stopPropagation();
						editor.remove();
					} }
				>
					x
				</button>
			</div>
			`) }
		</div>

		<div
			${ ref(this.contentArea) }
			class="tab-view-content"
		>
			${ this.activeEditor.value?.element }
		</div>
		`;
	}

	addEditor(editor: EditorView): void {
		if (this.editors.value.includes(editor))
			return;

		this.viewManager.addViewToTracking(editor);

		if (this.viewManager.dragDropManager)
			this.viewManager.dragDropManager.initializeEditorDrag(editor);

		this.editors.value = [ ...this.editors.value, editor ];

		// If this is the first editor, make it active
		if (this.editors.value.length === 1)
			this.activeEditor.value = editor;
	}

	createAndAddEditor(id: string, title: string, templateFunction: EditorTemplateFunction): EditorView {
		const editor = this.viewManager.createEditorView(id, title, templateFunction);
		this.addEditor(editor);

		return editor;
	}

	removeEditorById(editorId: string): boolean {
		const editorIndex = this.editors.value.findIndex(e => e.id === editorId);
		if (editorIndex === -1)
			return false;

		const editor = this.editors.value[editorIndex];
		if (!editor)
			return false;

		this.editors.value = this.editors.value.filter(e => e.id !== editorId);

		// If this was the active editor, switch to another one
		if (this.activeEditor.value === editor) {
			const newActiveIndex = editorIndex > 0 ? editorIndex - 1 : 0;

			const newActiveEditor = this.editors.value[newActiveIndex] !== editor
				? this.editors.value[newActiveIndex]!
				: null;

			this.activeEditor.value = newActiveEditor;
		}

		return true;
	}

	findEditorById(id: string): EditorView | undefined {
		return this.editors.value.find(e => e.id === id);
	}

	layout(size: number, offset: number): void {}

	setVisible(visible: boolean): void {
		this.isVisible.value = visible;
	}

	dispose(): void {
		this.disposeRender?.();

		// Clean up drag state
		this.tabDragHandler.hideDropIndicator();
		this.draggedTab = null;

		// Remove all editors
		for (const editor of this.editors.value)
			editor.dispose();

		this.editors.value = [];
		this.activeEditor.value = null;

		// Remove from DOM
		this.element.remove();
	}

}

/**
 * Creates a tab drag and drop handler for a TabView
 * Call with: createTabDragHandler.call(this)
 */
function createTabDragHandler(this: TabView) {
	const tabView = this;

	return {
		/**
		 * Handle the start of a tab drag operation
		 */
		handleTabDragStart(editor: EditorView, ev: DragEvent): void {
			if (!ev.dataTransfer)
				return;

			// Set up drag data
			ev.dataTransfer.effectAllowed = 'move';
			ev.dataTransfer.setData('text/tab-editor-id', editor.id);
			ev.dataTransfer.setData('text/tab-source-view-id', tabView.id);

			// Store the dragged tab info
			tabView.draggedTab = {
				editor,
				element: ev.currentTarget as HTMLElement,
			};

			// Create a custom drag image (ghost)
			tabView.tabDragHandler.createTabDragImage(editor, ev);

			// Add dragging class for styling
			tabView.draggedTab.element.classList.add('dragging');

			// Enable drop zones on all tab views
			tabView.viewManager.tabViews.value.forEach(tv => {
				tv.tabDragHandler.enableDropZone();
			});

			console.log('Tab drag started:', editor.id);
		},

		/**
		 * Handle the end of a tab drag operation
		 */
		handleTabDragEnd(editor: EditorView, ev: DragEvent): void {
			if (tabView.draggedTab) {
				// Remove dragging class
				tabView.draggedTab.element.classList.remove('dragging');
				tabView.draggedTab = null;
			}

			// Remove drop indicators and disable drop zones
			tabView.viewManager.tabViews.value.forEach(tv => {
				tv.tabDragHandler.disableDropZone();
				tv.tabDragHandler.hideDropIndicator();
			});

			console.log('Tab drag ended:', editor.id);
		},

		/**
		 * Handle drag over events on tabs
		 */
		handleTabDragOver(editor: EditorView, ev: DragEvent): void {
			ev.preventDefault();

			// Only show drop indicator if this is a tab drag
			const isTabDrag = ev.dataTransfer?.types.includes('text/tab-editor-id');
			if (!isTabDrag)
				return;

			const draggedEditorId = ev.dataTransfer?.getData('text/tab-editor-id');

			// Don't show indicator for the same tab
			if (draggedEditorId === editor.id)
				return;

			tabView.tabDragHandler.showDropIndicator(editor, ev);
		},

		/**
		 * Handle drop events on tabs
		 */
		handleTabDrop(editor: EditorView, ev: DragEvent): void {
			ev.preventDefault();

			const draggedEditorId = ev.dataTransfer?.getData('text/tab-editor-id');
			const sourceViewId = ev.dataTransfer?.getData('text/tab-source-view-id');

			if (!draggedEditorId || !sourceViewId)
				return;

			// Find the source tab view
			const sourceTabView = tabView.viewManager.tabViews.value.find(tv => tv.id === sourceViewId);
			if (!sourceTabView)
				return;

			// Find the dragged editor
			const draggedEditor = sourceTabView.findEditorById(draggedEditorId);
			if (!draggedEditor)
				return;

			// Determine drop position
			const dropPosition = tabView.tabDragHandler.getDropPosition(editor, ev);

			// Perform the drop operation
			tabView.tabDragHandler.performTabDrop(draggedEditor, sourceTabView, editor, dropPosition);

			tabView.tabDragHandler.hideDropIndicator();
		},

		/**
		 * Handle drag over events on the tabs container (for dropping at the end)
		 */
		handleContainerDragOver(ev: DragEvent): void {
			ev.preventDefault();

			// Only handle if this is a tab drag
			const isTabDrag = ev.dataTransfer?.types.includes('text/tab-editor-id');
			if (!isTabDrag)
				return;

			// Check if we're dragging over empty space or at the end
			const target = ev.target as HTMLElement;
			const isOnTabsContainer = target.classList.contains('tab-view-tabs');

			if (isOnTabsContainer || target.closest('.tab-view-tabs') === tabView.tabsContainer.value) {
				// Show end-of-list drop indicator
				tabView.tabDragHandler.showEndDropIndicator();
			}
		},

		/**
		 * Handle drop events on the tabs container (for dropping at the end)
		 */
		handleContainerDrop(ev: DragEvent): void {
			ev.preventDefault();

			const draggedEditorId = ev.dataTransfer?.getData('text/tab-editor-id');
			const sourceViewId = ev.dataTransfer?.getData('text/tab-source-view-id');

			if (!draggedEditorId || !sourceViewId)
				return;

			// Find the source tab view
			const sourceTabView = tabView.viewManager.tabViews.value.find(tv => tv.id === sourceViewId);
			if (!sourceTabView)
				return;

			// Find the dragged editor
			const draggedEditor = sourceTabView.findEditorById(draggedEditorId);
			if (!draggedEditor)
				return;

			// Check if we're dropping on empty space (should add at the end)
			const target = ev.target as HTMLElement;
			const isOnTabsContainer = target.classList.contains('tab-view-tabs');
			const isOnEmptySpace = isOnTabsContainer || (!target.closest('.tab-view-tab') && target.closest('.tab-view-tabs'));

			if (isOnEmptySpace) {
				// Perform the drop operation at the end
				tabView.tabDragHandler.performTabDropAtEnd(draggedEditor, sourceTabView);
			}

			tabView.tabDragHandler.hideDropIndicator();
		},

		/**
		 * Create a custom drag image for the tab
		 */
		createTabDragImage(editor: EditorView, ev: DragEvent): void {
			if (!ev.dataTransfer)
				return;

			// Create a ghost image element
			const ghostTab = document.createElement('div');
			ghostTab.className = 'tab-drag-ghost';
			ghostTab.innerHTML = `<span class="tab-title">${ editor.title }</span>`;
			ghostTab.style.cssText = `
				position: absolute;
				top: -1000px;
				left: -1000px;
				background: var(--vscode-tab-activeBackground, #1e1e1e);
				color: var(--vscode-tab-activeForeground, #ffffff);
				border: 1px solid var(--vscode-tab-border, #2d2d30);
				border-radius: 4px;
				padding: 8px 12px;
				font-size: 13px;
				font-family: var(--vscode-font-family);
				opacity: 0.9;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
				z-index: 10000;
			`;

			document.body.appendChild(ghostTab);

			// Set the custom drag image
			try {
				ev.dataTransfer.setDragImage(ghostTab, 10, 10);
			}
			catch (e) {
				console.warn('Could not set custom drag image:', e);
			}

			// Clean up the ghost element after a short delay
			setTimeout(() => {
				document.body.removeChild(ghostTab);
			}, 100);
		},

		/**
		 * Show drop indicator based on mouse position
		 */
		showDropIndicator(targetEditor: EditorView, ev: DragEvent): void {
			const tabElement = ev.currentTarget as HTMLElement;
			const rect = tabElement.getBoundingClientRect();
			const mouseX = ev.clientX;
			const centerX = rect.left + rect.width / 2;

			// Create or update drop indicator
			if (!tabView.dropIndicator) {
				tabView.dropIndicator = document.createElement('div');
				tabView.dropIndicator.className = 'tab-drop-indicator';
				tabView.dropIndicator.style.cssText = `
					position: absolute;
					width: 2px;
					height: 100%;
					background: var(--vscode-focusBorder, #007acc);
					z-index: 1000;
					pointer-events: none;
					top: 0;
				`;
			}

			// Position the indicator
			const isLeftSide = mouseX < centerX;
			const indicatorX = isLeftSide ? rect.left : rect.right;

			tabView.dropIndicator.style.left = `${ indicatorX - 1 }px`;

			// Add to tabs container
			const tabsContainer = tabView.tabsContainer.value;
			if (tabsContainer && !tabsContainer.contains(tabView.dropIndicator)) {
				tabsContainer.style.position = 'relative';
				tabsContainer.appendChild(tabView.dropIndicator);
			}
		},

		/**
		 * Hide the drop indicator
		 */
		hideDropIndicator(): void {
			if (tabView.dropIndicator) {
				tabView.dropIndicator.remove();
				tabView.dropIndicator = null;
			}
		},

		/**
		 * Show drop indicator at the end of the tab list
		 */
		showEndDropIndicator(): void {
			const tabsContainer = tabView.tabsContainer.value;
			if (!tabsContainer)
				return;

			// Create or update drop indicator
			if (!tabView.dropIndicator) {
				tabView.dropIndicator = document.createElement('div');
				tabView.dropIndicator.className = 'tab-drop-indicator';
				tabView.dropIndicator.style.cssText = `
					position: absolute;
					width: 2px;
					height: 100%;
					background: var(--vscode-focusBorder, #007acc);
					z-index: 1000;
					pointer-events: none;
					top: 0;
				`;
			}

			// Position at the end of all tabs
			const rect = tabsContainer.getBoundingClientRect();
			const lastTab = tabsContainer.querySelector('.tab-view-tab:last-child') as HTMLElement;

			let indicatorX: number;
			if (lastTab) {
				const lastTabRect = lastTab.getBoundingClientRect();
				indicatorX = lastTabRect.right;
			}
			else {
				// No tabs, position at the left
				indicatorX = rect.left + 8;
			}

			tabView.dropIndicator.style.left = `${ indicatorX - rect.left - 1 }px`;

			// Add to tabs container
			if (!tabsContainer.contains(tabView.dropIndicator)) {
				tabsContainer.style.position = 'relative';
				tabsContainer.appendChild(tabView.dropIndicator);
			}
		},

		/**
		 * Enable drop zone for this tab view
		 */
		enableDropZone(): void {
			if (tabView.tabsContainer.value)
				tabView.tabsContainer.value.classList.add('drop-zone-enabled');
		},

		/**
		 * Disable drop zone for this tab view
		 */
		disableDropZone(): void {
			if (tabView.tabsContainer.value)
				tabView.tabsContainer.value.classList.remove('drop-zone-enabled');
		},

		/**
		 * Get the drop position relative to target editor
		 */
		getDropPosition(targetEditor: EditorView, ev: DragEvent): 'before' | 'after' {
			const tabElement = ev.currentTarget as HTMLElement;
			const rect = tabElement.getBoundingClientRect();
			const mouseX = ev.clientX;
			const centerX = rect.left + rect.width / 2;

			return mouseX < centerX ? 'before' : 'after';
		},

		/**
		 * Perform the actual tab drop operation
		 */
		performTabDrop(
			draggedEditor: EditorView,
			sourceTabView: TabView,
			targetEditor: EditorView,
			position: 'before' | 'after',
		): void {
			// Remove from source
			const sourceIndex = sourceTabView.editors.value.indexOf(draggedEditor);
			if (sourceIndex === -1)
				return;

			sourceTabView.editors.value = sourceTabView.editors.value.filter(e => e !== draggedEditor);

			// If source tab view becomes empty and it's not this view, we might want to handle cleanup
			if (sourceTabView.editorCount === 0 && sourceTabView !== tabView) {
				// Handle empty source tab view cleanup if needed
				console.log('Source tab view is now empty:', sourceTabView.id);
			}

			// Add to this tab view at the correct position
			const targetIndex = tabView.editors.value.indexOf(targetEditor);
			const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;

			const newEditors = [ ...tabView.editors.value ];
			newEditors.splice(insertIndex, 0, draggedEditor);
			tabView.editors.value = newEditors;

			// Set as active if this tab view was empty
			if (tabView.editors.value.length === 1)
				tabView.activeEditor.value = draggedEditor;

			console.log(
				`Moved tab "${ draggedEditor.title }" from ${ sourceTabView.id } to ${ tabView.id } at position ${ insertIndex }`,
			);
		},

		/**
		 * Perform tab drop at the end of the tab list
		 */
		performTabDropAtEnd(draggedEditor: EditorView, sourceTabView: TabView): void {
			// Remove from source
			const sourceIndex = sourceTabView.editors.value.indexOf(draggedEditor);
			if (sourceIndex === -1)
				return;

			sourceTabView.editors.value = sourceTabView.editors.value.filter(e => e !== draggedEditor);

			// If source tab view becomes empty and it's not this view, handle cleanup
			if (sourceTabView.editorCount === 0 && sourceTabView !== tabView)
				console.log('Source tab view is now empty:', sourceTabView.id);

			// Add to the end of this tab view
			const newEditors = [ ...tabView.editors.value, draggedEditor ];
			tabView.editors.value = newEditors;

			// Set as active if this tab view was empty
			if (tabView.editors.value.length === 1)
				tabView.activeEditor.value = draggedEditor;

			console.log(`Moved tab "${ draggedEditor.title }" from ${ sourceTabView.id } to ${ tabView.id } at the end`);
		},
	};
}
