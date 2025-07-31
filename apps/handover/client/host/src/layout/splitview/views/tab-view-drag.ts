import type { EditorView } from './editor-view.ts';
import type { TabView } from './tab-view.ts';


export class TabDragManager {

	constructor(private tabView: TabView) {}

	/**
	 * Handle the start of a tab drag operation
	 */
	handleTabDragStart(editor: EditorView, ev: DragEvent): void {
		if (!ev.dataTransfer)
			return;

		// Set up drag data
		ev.dataTransfer.effectAllowed = 'move';
		ev.dataTransfer.setData('text/tab-editor-id', editor.id);
		ev.dataTransfer.setData('text/tab-source-view-id', this.tabView.id);

		// Store the dragged tab info
		this.tabView.draggedTab = {
			editor,
			element: ev.currentTarget as HTMLElement,
		};

		// Create a custom drag image (ghost)
		this.tabView.tabDragHandler.createTabDragImage(editor, ev);

		// Add dragging class for styling
		this.tabView.draggedTab.element.classList.add('dragging');

		// Enable drop zones on all tab views
		this.tabView.viewManager.tabViews.value.forEach(tv => {
			tv.tabDragHandler.enableDropZone();
		});

		console.log('Tab drag started:', editor.id);
	}

	/**
	 * Handle the end of a tab drag operation
	 */
	handleTabDragEnd(editor: EditorView, ev: DragEvent): void {
		if (this.tabView.draggedTab) {
			// Remove dragging class
			this.tabView.draggedTab.element.classList.remove('dragging');
			this.tabView.draggedTab = null;
		}

		// Remove drop indicators and disable drop zones
		this.tabView.viewManager.tabViews.value.forEach(tv => {
			tv.tabDragHandler.disableDropZone();
			tv.tabDragHandler.hideDropIndicator();
		});

		console.log('Tab drag ended:', editor.id);
	}

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

		this.tabView.tabDragHandler.showDropIndicator(editor, ev);
	}

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
		const sourceTabView = this.tabView.viewManager.tabViews.value.find(tv => tv.id === sourceViewId);
		if (!sourceTabView)
			return;

		// Find the dragged editor
		const draggedEditor = sourceTabView.findEditorById(draggedEditorId);
		if (!draggedEditor)
			return;

		// Determine drop position
		const dropPosition = this.tabView.tabDragHandler.getDropPosition(editor, ev);

		// Perform the drop operation
		this.tabView.tabDragHandler.performTabDrop(draggedEditor, sourceTabView, editor, dropPosition);

		this.tabView.tabDragHandler.hideDropIndicator();
	}

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

		if (isOnTabsContainer || target.closest('.tab-view-tabs') === this.tabView.tabsContainer.value) {
			// Show end-of-list drop indicator
			this.tabView.tabDragHandler.showEndDropIndicator();
		}
	}

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
		const sourceTabView = this.tabView.viewManager.tabViews.value.find(tv => tv.id === sourceViewId);
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
			this.tabView.tabDragHandler.performTabDropAtEnd(draggedEditor, sourceTabView);
		}

		this.tabView.tabDragHandler.hideDropIndicator();
	}

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
	}

	/**
	 * Show drop indicator based on mouse position
	 */
	showDropIndicator(targetEditor: EditorView, ev: DragEvent): void {
		const tabElement = ev.currentTarget as HTMLElement;
		const rect = tabElement.getBoundingClientRect();
		const mouseX = ev.clientX;
		const centerX = rect.left + rect.width / 2;

		// Create or update drop indicator
		if (!this.tabView.dropIndicator) {
			this.tabView.dropIndicator = document.createElement('div');
			this.tabView.dropIndicator.className = 'tab-drop-indicator';
			this.tabView.dropIndicator.style.cssText = `
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

		this.tabView.dropIndicator.style.left = `${ indicatorX - 1 }px`;

		// Add to tabs container
		const tabsContainer = this.tabView.tabsContainer.value;
		if (tabsContainer && !tabsContainer.contains(this.tabView.dropIndicator)) {
			tabsContainer.style.position = 'relative';
			tabsContainer.appendChild(this.tabView.dropIndicator);
		}
	}

	/**
	 * Hide the drop indicator
	 */
	hideDropIndicator(): void {
		if (this.tabView.dropIndicator) {
			this.tabView.dropIndicator.remove();
			this.tabView.dropIndicator = null;
		}
	}

	/**
	 * Show drop indicator at the end of the tab list
	 */
	showEndDropIndicator(): void {
		const tabsContainer = this.tabView.tabsContainer.value;
		if (!tabsContainer)
			return;

		// Create or update drop indicator
		if (!this.tabView.dropIndicator) {
			this.tabView.dropIndicator = document.createElement('div');
			this.tabView.dropIndicator.className = 'tab-drop-indicator';
			this.tabView.dropIndicator.style.cssText = `
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

		this.tabView.dropIndicator.style.left = `${ indicatorX - rect.left - 1 }px`;

		// Add to tabs container
		if (!tabsContainer.contains(this.tabView.dropIndicator)) {
			tabsContainer.style.position = 'relative';
			tabsContainer.appendChild(this.tabView.dropIndicator);
		}
	}

	/**
	 * Enable drop zone for this tab view
	 */
	enableDropZone(): void {
		if (this.tabView.tabsContainer.value)
			this.tabView.tabsContainer.value.classList.add('drop-zone-enabled');
	}

	/**
	 * Disable drop zone for this tab view
	 */
	disableDropZone(): void {
		if (this.tabView.tabsContainer.value)
			this.tabView.tabsContainer.value.classList.remove('drop-zone-enabled');
	}

	/**
	 * Get the drop position relative to target editor
	 */
	getDropPosition(targetEditor: EditorView, ev: DragEvent): 'before' | 'after' {
		const tabElement = ev.currentTarget as HTMLElement;
		const rect = tabElement.getBoundingClientRect();
		const mouseX = ev.clientX;
		const centerX = rect.left + rect.width / 2;

		return mouseX < centerX ? 'before' : 'after';
	}

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
		if (sourceTabView.editorCount === 0 && sourceTabView !== this.tabView) {
			// Handle empty source tab view cleanup if needed
			console.log('Source tab view is now empty:', sourceTabView.id);
		}

		// Add to this tab view at the correct position
		const targetIndex = this.tabView.editors.value.indexOf(targetEditor);
		const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;

		const newEditors = [ ...this.tabView.editors.value ];
		newEditors.splice(insertIndex, 0, draggedEditor);
		this.tabView.editors.value = newEditors;

		// Set as active if this tab view was empty
		if (this.tabView.editors.value.length === 1)
			this.tabView.activeEditor.value = draggedEditor;

		console.log(
			`Moved tab "${ draggedEditor.title }" from ${ sourceTabView.id } to ${ this.tabView.id } at position ${ insertIndex }`,
		);
	}

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
		if (sourceTabView.editorCount === 0 && sourceTabView !== this.tabView)
			console.log('Source tab view is now empty:', sourceTabView.id);

		// Add to the end of this tab view
		const newEditors = [ ...this.tabView.editors.value, draggedEditor ];
		this.tabView.editors.value = newEditors;

		// Set as active if this tab view was empty
		if (this.tabView.editors.value.length === 1)
			this.tabView.activeEditor.value = draggedEditor;

		console.log(`Moved tab "${ draggedEditor.title }" from ${ sourceTabView.id } to ${ this.tabView.id } at the end`);
	}

};
