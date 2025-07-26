import { TabView } from './tab-view.ts';
import { Orientation, Sizing } from './types.ts';
import { EditorView, type NestedView, type ViewManager } from './view-manager.ts';

/**
 * Represents a drag operation in progress
 */
export interface DragOperation {
	/** The editor being dragged */
	sourceEditor:    EditorView;
	/** The original container of the source editor */
	sourceContainer: ViewManager | NestedView;
	/** Current mouse position */
	currentX:        number;
	currentY:        number;
	/** Starting mouse position */
	startX:          number;
	startY:          number;
	/** Drag preview element */
	dragPreview?:    HTMLElement;
}

/**
 * Represents a potential drop target
 */
export interface DropTarget {
	/** The target view where the editor can be dropped */
	targetView: EditorView | NestedView | TabView;
	/** The type of drop operation */
	dropType:   'split-horizontal' | 'split-vertical' | 'add-to-nested' | 'add-to-tabview';
	/** The drop zone element for visual feedback */
	dropZone:   HTMLElement;
	/** The position where the drop would occur */
	position:   'before' | 'after' | 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * Configuration for drag-drop behavior
 */
export interface DragDropConfig {
	/** Minimum distance to start a drag operation */
	dragThreshold:   number;
	/** Size of drop zones in pixels */
	dropZoneSize:    number;
	/** Whether to show drag preview */
	showDragPreview: boolean;
}

/**
 * Manages drag and drop operations for the split view system
 */
export class DragDropManager {

	private viewManager: ViewManager;
	private config:      DragDropConfig;
	private currentDrag: DragOperation | null = null;
	private dropTargets: DropTarget[] = [];
	private dragOverlay: HTMLElement | null = null;

	constructor(viewManager: ViewManager, config: Partial<DragDropConfig> = {}) {
		this.viewManager = viewManager;
		this.config = {
			dragThreshold:   5,
			dropZoneSize:    40,
			showDragPreview: true,
			...config,
		};

		this.createDragOverlay();
	}

	/**
	 * Initialize drag functionality for an editor
	 */
	initializeEditorDrag(editor: EditorView): void {
		const tabElement = editor.element.querySelector('.editor-tab') as HTMLElement;
		if (!tabElement)
			return;

		// Make the tab draggable
		tabElement.draggable = true;
		tabElement.classList.add('draggable-tab');

		// Add drag event listeners
		tabElement.addEventListener('dragstart', (event) => this.handleDragStart(event, editor));
		tabElement.addEventListener('dragend', (event) => this.handleDragEnd(event));

		// Also handle mouse events for custom drag behavior
		tabElement.addEventListener('mousedown', (event) => this.handleMouseDown(event, editor));
	}

	/**
	 * Handle the start of a drag operation
	 */
	private handleDragStart(event: DragEvent, editor: EditorView): void {
		if (!event.dataTransfer)
			return;

		// Set drag data
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', editor.id);

		// Create drag operation
		this.currentDrag = {
			sourceEditor:    editor,
			sourceContainer: this.findEditorContainer(editor),
			currentX:        event.clientX,
			currentY:        event.clientY,
			startX:          event.clientX,
			startY:          event.clientY,
		};

		// Add drag class for styling
		editor.element.classList.add('being-dragged');

		// Create drag preview if enabled
		if (this.config.showDragPreview)
			this.createDragPreview(editor, event);


		// Set up global mouse move listener for drop zone detection
		document.addEventListener('dragover', this.handleDragOver);
		document.addEventListener('drop', this.handleDrop);

		console.log('Drag started for editor:', editor.id);
	}

	/**
	 * Handle mouse down for potential drag initiation
	 */
	private handleMouseDown(event: MouseEvent, editor: EditorView): void {
		// This will be used for custom drag behavior if needed
		// For now, we'll rely on the native drag events
	}

	/**
	 * Handle drag over events to show drop zones
	 */
	private handleDragOver = (event: DragEvent): void => {
		event.preventDefault();
		if (!this.currentDrag)
			return;

		// Update current position
		this.currentDrag.currentX = event.clientX;
		this.currentDrag.currentY = event.clientY;

		// Calculate and show drop targets
		this.updateDropTargets(event.clientX, event.clientY);
	};

	/**
	 * Handle drop events
	 */
	private handleDrop = (event: DragEvent): void => {
		event.preventDefault();
		if (!this.currentDrag)
			return;

		// Find the active drop target
		const activeDropTarget = this.getActiveDropTarget(event.clientX, event.clientY);

		if (activeDropTarget)
			this.performDrop(activeDropTarget);


		this.cleanup();
	};

	/**
	 * Handle the end of a drag operation
	 */
	private handleDragEnd(event: DragEvent): void {
		this.cleanup();
	}

	/**
	 * Create the drag overlay container
	 */
	private createDragOverlay(): void {
		this.dragOverlay = document.createElement('div');
		this.dragOverlay.className = 'drag-drop-overlay';
		this.dragOverlay.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100vw;
			height: 100vh;
			pointer-events: none;
			z-index: 1000;
		`;
		document.body.appendChild(this.dragOverlay);
	}

	/**
	 * Create a drag preview element
	 */
	private createDragPreview(editor: EditorView, event: DragEvent): void {
		if (!this.currentDrag || !event.dataTransfer)
			return;

		const preview = document.createElement('div');
		preview.className = 'drag-preview';
		preview.textContent = editor.title;
		preview.style.cssText = `
			position: fixed;
			background: var(--vscode-tab-activeBackground);
			color: var(--vscode-tab-activeForeground);
			padding: 8px 12px;
			border-radius: 4px;
			font-size: 13px;
			pointer-events: none;
			z-index: 1001;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
			opacity: 0.9;
		`;

		// Try to set as drag image
		try {
			event.dataTransfer.setDragImage(preview, 10, 10);
		}
		catch (e) {
			// Fallback: add to overlay
			if (this.dragOverlay) {
				this.dragOverlay.appendChild(preview);
				this.currentDrag.dragPreview = preview;
			}
		}
	}

	/**
	 * Update drop targets based on current mouse position
	 */
	private updateDropTargets(clientX: number, clientY: number): void {
		// Clear existing drop targets
		this.clearDropTargets();

		// Find all potential drop targets
		this.dropTargets = this.calculateDropTargets(clientX, clientY);

		// Show drop zones
		this.showDropZones();
	}

	/**
	 * Calculate potential drop targets based on mouse position
	 */
	private calculateDropTargets(clientX: number, clientY: number): DropTarget[] {
		const targets: DropTarget[] = [];
		if (!this.currentDrag)
			return targets;

		// Get all editor views and nested views
		const allEditors = this.viewManager.editors.value;
		const allNested = this.viewManager.nestedViews.value;

		// Check each editor for drop opportunities
		for (const editor of allEditors) {
			if (editor === this.currentDrag.sourceEditor || !(editor instanceof EditorView))
				continue;

			const rect = editor.element.getBoundingClientRect();
			if (this.isMouseNearElement(clientX, clientY, rect)) {
				// Add split targets
				targets.push(...this.createSplitTargets(editor, rect, clientX, clientY));
			}
		}

		// Check each nested view for drop opportunities
		for (const nested of allNested) {
			const rect = nested.element.getBoundingClientRect();
			if (this.isMouseNearElement(clientX, clientY, rect))
				targets.push(...this.createNestedTargets(nested, rect, clientX, clientY));
		}

		return targets;
	}

	/**
	 * Check if mouse is near an element (within drop zone range)
	 */
	private isMouseNearElement(clientX: number, clientY: number, rect: DOMRect): boolean {
		const threshold = this.config.dropZoneSize;

		return (
			clientX >= rect.left - threshold &&
			clientX <= rect.right + threshold &&
			clientY >= rect.top - threshold &&
			clientY <= rect.bottom + threshold
		);
	}

	/**
	 * Create split targets for an editor view
	 */
	private createSplitTargets(editor: EditorView, rect: DOMRect, clientX: number, clientY: number): DropTarget[] {
		const targets: DropTarget[] = [];
		const dropZoneSize = this.config.dropZoneSize;

		// Left split zone
		if (clientX >= rect.left && clientX <= rect.left + dropZoneSize) {
			targets.push({
				targetView: editor,
				dropType:   'split-horizontal',
				position:   'left',
				dropZone:   this.createDropZoneElement(rect.left, rect.top, dropZoneSize, rect.height),
			});
		}

		// Right split zone
		if (clientX >= rect.right - dropZoneSize && clientX <= rect.right) {
			targets.push({
				targetView: editor,
				dropType:   'split-horizontal',
				position:   'right',
				dropZone:   this.createDropZoneElement(rect.right - dropZoneSize, rect.top, dropZoneSize, rect.height),
			});
		}

		// Top split zone
		if (clientY >= rect.top && clientY <= rect.top + dropZoneSize) {
			targets.push({
				targetView: editor,
				dropType:   'split-vertical',
				position:   'top',
				dropZone:   this.createDropZoneElement(rect.left, rect.top, rect.width, dropZoneSize),
			});
		}

		// Bottom split zone
		if (clientY >= rect.bottom - dropZoneSize && clientY <= rect.bottom) {
			targets.push({
				targetView: editor,
				dropType:   'split-vertical',
				position:   'bottom',
				dropZone:   this.createDropZoneElement(rect.left, rect.bottom - dropZoneSize, rect.width, dropZoneSize),
			});
		}

		return targets;
	}

	/**
	 * Create targets for nested views
	 */
	private createNestedTargets(nested: NestedView, rect: DOMRect, clientX: number, clientY: number): DropTarget[] {
		const targets: DropTarget[] = [];
		// For now, we'll add logic to add editors to existing nested views
		// This can be expanded based on the nested view's orientation

		targets.push({
			targetView: nested,
			dropType:   'add-to-nested',
			position:   'after',
			dropZone:   this.createDropZoneElement(rect.left, rect.top, rect.width, rect.height),
		});

		return targets;
	}

	/**
	 * Create a drop zone element
	 */
	private createDropZoneElement(x: number, y: number, width: number, height: number): HTMLElement {
		const dropZone = document.createElement('div');
		dropZone.className = 'drop-zone';
		dropZone.style.cssText = `
			position: fixed;
			left: ${ x }px;
			top: ${ y }px;
			width: ${ width }px;
			height: ${ height }px;
			background: var(--vscode-focusBorder, #007acc);
			opacity: 0.3;
			border: 2px solid var(--vscode-focusBorder, #007acc);
			pointer-events: none;
			z-index: 999;
		`;

		return dropZone;
	}

	/**
	 * Show all drop zones
	 */
	private showDropZones(): void {
		if (!this.dragOverlay)
			return;

		for (const target of this.dropTargets)
			this.dragOverlay.appendChild(target.dropZone);
	}

	/**
	 * Clear all drop targets and zones
	 */
	private clearDropTargets(): void {
		// Remove drop zone elements
		for (const target of this.dropTargets)
			target.dropZone.remove();

		this.dropTargets = [];
	}

	/**
	 * Get the active drop target at the given position
	 */
	private getActiveDropTarget(clientX: number, clientY: number): DropTarget | null {
		for (const target of this.dropTargets) {
			const rect = target.dropZone.getBoundingClientRect();
			if (
				clientX >= rect.left &&
				clientX <= rect.right &&
				clientY >= rect.top &&
				clientY <= rect.bottom
			)
				return target;
		}

		return null;
	}

	/**
	 * Perform the actual drop operation
	 */
	private performDrop(dropTarget: DropTarget): void {
		if (!this.currentDrag)
			return;

		const { sourceEditor } = this.currentDrag;
		const { targetView, dropType, position } = dropTarget;

		console.log('Performing drop:', {
			sourceId: sourceEditor.id,
			targetId: targetView.id,
			dropType,
			position,
		});

		// Use existing ViewManager methods to perform the layout changes
		switch (dropType) {
		case 'split-horizontal':
			this.performHorizontalSplit(sourceEditor, targetView as EditorView, position);
			break;
		case 'split-vertical':
			this.performVerticalSplit(sourceEditor, targetView as EditorView, position);
			break;
		case 'add-to-nested':
			this.performAddToNested(sourceEditor, targetView as NestedView);
			break;
		}
	}

	/**
	 * Perform horizontal split operation
	 */
	private performHorizontalSplit(sourceEditor: EditorView, targetEditor: EditorView, position: string): void {
		// Convert the target editor to a nested view if it isn't already
		const nestedView = this.viewManager.convertEditorToNested(targetEditor, Orientation.HORIZONTAL);
		if (!nestedView)
			return;

		// Remove source editor from its current location
		this.removeEditorFromSource(sourceEditor);

		// Add to the nested view at the correct position
		if (position === 'left') {
			// Add at the beginning (index 0)
			nestedView.addEditorAtIndex(sourceEditor, 0);
		}
		else {
			// Add at the end
			nestedView.addEditor(sourceEditor);
		}

		// Re-register the editor with the view manager for tracking
		this.viewManager.registerEditor(sourceEditor);
	}

	/**
	 * Perform vertical split operation
	 */
	private performVerticalSplit(sourceEditor: EditorView, targetEditor: EditorView, position: string): void {
		// Remove source editor from its current location
		this.removeEditorFromSource(sourceEditor);

		// Find the target editor's position in the main view
		const targetIndex = this.viewManager.getEditorIndex(targetEditor);
		if (targetIndex === -1) {
			console.warn('Target editor not found in main view for vertical split');

			return;
		}

		// Add the source editor as a new row in the main view
		const insertIndex = position === 'top' ? targetIndex : targetIndex + 1;

		// Add the editor at the specific position
		this.viewManager.addExistingEditorAtIndex(sourceEditor, insertIndex, Sizing.Distribute);
	}

	/**
	 * Add editor to an existing nested view
	 */
	private performAddToNested(sourceEditor: EditorView, targetNested: NestedView): void {
		this.removeEditorFromSource(sourceEditor);
		targetNested.addEditor(sourceEditor);
		// Re-register with ViewManager for tracking
		this.viewManager.registerEditor(sourceEditor);
	}

	/**
	 * Remove editor from its source container
	 */
	private removeEditorFromSource(editor: EditorView): void {
		// Use the new removeEditorFromTracking method
		this.viewManager.removeEditorFromTracking(editor.id);
	}

	/**
	 * Find the container that holds the given editor
	 */
	private findEditorContainer(editor: EditorView): ViewManager | NestedView {
		// Check nested views first
		for (const nested of this.viewManager.nestedViews.value) {
			if (nested.findEditor(editor.id))
				return nested;
		}

		// Must be in the main ViewManager
		return this.viewManager;
	}

	/**
	 * Clean up after drag operation
	 */
	private cleanup(): void {
		if (!this.currentDrag)
			return;

		// Remove drag styling
		this.currentDrag.sourceEditor.element.classList.remove('being-dragged');

		// Remove drag preview
		if (this.currentDrag.dragPreview)
			this.currentDrag.dragPreview.remove();


		// Clear drop targets
		this.clearDropTargets();

		// Remove global listeners
		document.removeEventListener('dragover', this.handleDragOver);
		document.removeEventListener('drop', this.handleDrop);

		// Reset state
		this.currentDrag = null;

		console.log('Drag operation cleaned up');
	}

	/**
	 * Dispose of the drag drop manager
	 */
	dispose(): void {
		this.cleanup();
		if (this.dragOverlay) {
			this.dragOverlay.remove();
			this.dragOverlay = null;
		}
	}

}
