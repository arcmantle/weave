import { Orientation } from '../types.ts';
import { EditorView } from './editor-view.ts';
import { type EditorTemplateFunction, type EditorWithCallback, type IEditorView } from './shared.ts';


/**
 * A view that displays multiple editors in tabs with one active editor visible
 */
export class TabView implements IEditorView {

	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 150;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;
	readonly type = 'tab' as const;

	private editors:            EditorView[] = [];
	private activeEditor:       EditorView | null = null;
	private tabsContainer:      HTMLElement;
	private contentArea:        HTMLElement;
	private onRemove?:          (id: string) => boolean | void;
	private onRemoved?:         (id: string) => void;
	private editorCallbacks:    Map<string, (id: string) => boolean | void> = new Map();
	private defaultTemplateFn?: EditorTemplateFunction;

	constructor(
		id: string,
		title: string,
		onRemove?: (id: string) => boolean | void,
		onRemoved?: (id: string) => void,
		defaultTemplateFn?: EditorTemplateFunction,
	) {
		this.id = id;
		this.title = title;
		this.onRemove = onRemove;
		this.onRemoved = onRemoved;
		this.defaultTemplateFn = defaultTemplateFn;
		this.element = document.createElement('div');
		this.element.className = 'tab-view';

		this.createStructure();
	}

	/**
	 * Create the basic DOM structure for the tab view
	 */
	private createStructure(): void {
		// Create tabs container
		this.tabsContainer = document.createElement('div');
		this.tabsContainer.className = 'tab-view-tabs';

		// Create content area
		this.contentArea = document.createElement('div');
		this.contentArea.className = 'tab-view-content';

		this.element.appendChild(this.tabsContainer);
		this.element.appendChild(this.contentArea);

		// Update tab visibility based on editor count
		this.updateTabVisibility();
	}

	/**
	 * Update tab visibility based on number of editors
	 * Hide tabs when there's only one editor to save space
	 */
	private updateTabVisibility(): void {
		const showTabs = this.editors.length > 1;
		this.tabsContainer.style.display = showTabs ? 'flex' : 'none';

		// Adjust content area to take full height when tabs are hidden
		this.contentArea.style.height = showTabs ? 'calc(100% - 32px)' : '100%';
	}

	/**
	 * Add an editor to the tab view
	 */
	addEditor(editor: EditorView, onRemove?: (id: string) => boolean | void): void {
		if (this.editors.includes(editor))
			return;

		this.editors.push(editor);

		// Store the per-editor callback if provided
		if (onRemove)
			this.editorCallbacks.set(editor.id, onRemove);

		this.createTabForEditor(editor);

		// If this is the first editor, make it active
		if (this.editors.length === 1)
			this.setActiveEditor(editor);

		// Update tab visibility
		this.updateTabVisibility();
	}

	/**
	 * Create and add a new editor to the tab view
	 */
	createEditor(
		id: string,
		title: string,
		templateFunction?: EditorTemplateFunction,
		onRemove?: (id: string) => boolean | void,
	): EditorView {
		const templateFn = templateFunction || this.defaultTemplateFn;

		if (!templateFn)
			throw new Error('No template function provided and no default template function available');

		// Create close handler that respects per-editor callbacks
		const handleClose = (editorId: string) => {
			// Try the per-editor callback first, then fall back to global callback
			const editorCallback = this.editorCallbacks.get(editorId);
			const callback = editorCallback || this.onRemove;

			// Ask the callback if removal should proceed (if callback exists)
			const shouldRemove = callback ? callback(editorId) : true;

			// If callback returned false, don't remove
			if (shouldRemove === false)
				return;

			// Handle removal internally
			const removed = this.removeEditor(editorId);

			// Notify after successful removal
			if (removed && this.onRemoved)
				this.onRemoved(editorId);
		};

		const editor = new EditorView(id, title, templateFn, handleClose);

		// Store the per-editor callback if provided
		if (onRemove)
			this.editorCallbacks.set(editor.id, onRemove);

		this.editors.push(editor);
		this.createTabForEditor(editor);

		// If this is the first editor, make it active
		if (this.editors.length === 1)
			this.setActiveEditor(editor);

		// Update tab visibility
		this.updateTabVisibility();

		return editor;
	}

	/**
	 * Remove an editor from the tab view
	 */
	removeEditor(editorId: string): boolean {
		const editorIndex = this.editors.findIndex(e => e.id === editorId);
		if (editorIndex === -1)
			return false;

		const editor = this.editors[editorIndex];
		if (!editor)
			return false;

		// Remove the tab
		const tabElement = this.tabsContainer.querySelector(`[data-editor-id="${ editorId }"]`);
		if (tabElement)
			tabElement.remove();

		// If this was the active editor, switch to another one
		if (this.activeEditor === editor) {
			const newActiveIndex = editorIndex > 0 ? editorIndex - 1 : 0;
			const newActiveEditor = this.editors[newActiveIndex] !== editor ? this.editors[newActiveIndex] : null;

			if (newActiveEditor)
				this.setActiveEditor(newActiveEditor);
			else
				this.activeEditor = null;
		}

		// Remove from editors array
		this.editors.splice(editorIndex, 1);

		// Clean up the per-editor callback
		this.editorCallbacks.delete(editorId);

		// Hide the editor's element
		if (editor.element.parentNode === this.contentArea)
			this.contentArea.removeChild(editor.element);

		// Update tab visibility
		this.updateTabVisibility();

		return true;
	}

	/**
	 * Create a tab element for an editor
	 */
	private createTabForEditor(editor: EditorView): void {
		const tab = document.createElement('div');
		tab.className = 'tab-view-tab';
		tab.setAttribute('data-editor-id', editor.id);
		tab.style.cssText = `
			display: flex;
			align-items: center;
			padding: 8px 12px;
			background: var(--vscode-tab-inactiveBackground);
			color: var(--vscode-tab-inactiveForeground);
			border-right: 1px solid var(--vscode-tab-border);
			cursor: pointer;
			user-select: none;
			white-space: nowrap;
			min-width: 0;
			flex-shrink: 0;
		`;

		// Create tab content
		const tabTitle = document.createElement('span');
		tabTitle.className = 'tab-title';
		tabTitle.textContent = editor.title;
		tabTitle.style.cssText = `
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 13px;
		`;

		const closeButton = document.createElement('button');
		closeButton.className = 'tab-close';
		closeButton.textContent = 'x';
		closeButton.style.cssText = `
			background: none;
			border: none;
			color: inherit;
			cursor: pointer;
			padding: 2px 4px;
			margin-left: 6px;
			border-radius: 2px;
			font-size: 16px;
			opacity: 0.7;
			line-height: 1;
		`;

		// Event listeners
		tab.addEventListener('click', (e) => {
			if (e.target !== closeButton)
				this.setActiveEditor(editor);
		});

		closeButton.addEventListener('click', (e) => {
			e.stopPropagation();

			// Try the per-editor callback first, then fall back to global callback
			const editorCallback = this.editorCallbacks.get(editor.id);
			const callback = editorCallback || this.onRemove;

			// Ask the callback if removal should proceed (if callback exists)
			const shouldRemove = callback ? callback(editor.id) : true;

			// If callback returned false, don't remove
			if (shouldRemove === false)
				return;

			// Handle removal internally
			const removed = this.removeEditor(editor.id);

			// Notify after successful removal
			if (removed && this.onRemoved)
				this.onRemoved(editor.id);
		});		closeButton.addEventListener('mouseenter', () => {
			closeButton.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)';
			closeButton.style.opacity = '1';
		});

		closeButton.addEventListener('mouseleave', () => {
			closeButton.style.backgroundColor = 'transparent';
			closeButton.style.opacity = '0.7';
		});

		tab.appendChild(tabTitle);
		tab.appendChild(closeButton);
		this.tabsContainer.appendChild(tab);
	}

	/**
	 * Set the active editor
	 */
	setActiveEditor(editor: EditorView): void {
		if (!this.editors.includes(editor))
			return;

		// Update previous active tab
		if (this.activeEditor) {
			const prevTab = this.tabsContainer.querySelector(`[data-editor-id="${ this.activeEditor.id }"]`) as HTMLElement;
			if (prevTab) {
				prevTab.style.background = 'var(--vscode-tab-inactiveBackground)';
				prevTab.style.color = 'var(--vscode-tab-inactiveForeground)';
			}

			// Hide previous editor
			if (this.activeEditor.element.parentNode === this.contentArea)
				this.contentArea.removeChild(this.activeEditor.element);
		}

		// Update new active tab
		const newTab = this.tabsContainer.querySelector(`[data-editor-id="${ editor.id }"]`) as HTMLElement;
		if (newTab) {
			newTab.style.background = 'var(--vscode-tab-activeBackground)';
			newTab.style.color = 'var(--vscode-tab-activeForeground)';
		}

		// Show new editor
		this.activeEditor = editor;
		this.contentArea.appendChild(editor.element);

		// Ensure the editor fills the content area
		editor.element.style.width = '100%';
		editor.element.style.height = '100%';
	}

	/**
	 * Get the currently active editor
	 */
	getActiveEditor(): EditorView | null {
		return this.activeEditor;
	}

	/**
	 * Get all editors in this tab view
	 */
	getAllEditors(): readonly EditorView[] {
		return this.editors;
	}

	/**
	 * Get the number of editors in this tab view
	 */
	get editorCount(): number {
		return this.editors.length;
	}

	/**
	 * Find an editor by ID
	 */
	findEditor(id: string): EditorView | undefined {
		return this.editors.find(e => e.id === id);
	}

	/**
	 * Extract all editors with their callbacks for conversion purposes
	 * @returns Array of editors with their associated callbacks
	 */
	extractEditorsWithCallbacks(): EditorWithCallback[] {
		return this.editors.map(editor => ({
			editor,
			callback: this.editorCallbacks.get(editor.id),
		}));
	}

	/**
	 * Convert this TabView to a NestedView containing all editors
	 * Note: This method will be implemented by the ViewManager to avoid circular dependencies
	 * @param orientation The orientation for the new NestedView
	 * @param onRemoved Optional callback for when editors are removed from the nested view
	 * @returns A new NestedView containing all editors
	 */
	toNestedView?(orientation: Orientation, onRemoved?: (id: string) => void): any {
		throw new Error('toNestedView must be implemented by ViewManager to avoid circular dependencies');
	}

	/**
	 * Check if this tab view contains a specific editor
	 */
	hasEditor(editor: EditorView): boolean {
		return this.editors.includes(editor);
	}

	/**
	 * Get the next editor in the tab order
	 */
	getNextEditor(currentEditor: EditorView): EditorView | null {
		const currentIndex = this.editors.indexOf(currentEditor);
		if (currentIndex === -1)
			return null;

		const nextIndex = (currentIndex + 1) % this.editors.length;

		return this.editors[nextIndex] || null;
	}

	/**
	 * Get the previous editor in the tab order
	 */
	getPreviousEditor(currentEditor: EditorView): EditorView | null {
		const currentIndex = this.editors.indexOf(currentEditor);
		if (currentIndex === -1)
			return null;

		const prevIndex = currentIndex === 0 ? this.editors.length - 1 : currentIndex - 1;

		return this.editors[prevIndex] || null;
	}

	/**
	 * Move a tab to a new position
	 */
	moveTab(editorId: string, newIndex: number): boolean {
		const currentIndex = this.editors.findIndex(e => e.id === editorId);
		if (currentIndex === -1 || newIndex < 0 || newIndex >= this.editors.length)
			return false;

		const editor = this.editors[currentIndex];
		if (!editor)
			return false;

		// Remove and reinsert in array
		this.editors.splice(currentIndex, 1);
		this.editors.splice(newIndex, 0, editor);

		// Update DOM
		const tabElement = this.tabsContainer.querySelector(`[data-editor-id="${ editorId }"]`);
		if (tabElement) {
			tabElement.remove();

			const referenceTab = this.tabsContainer.children[newIndex];
			if (referenceTab)
				this.tabsContainer.insertBefore(tabElement, referenceTab);
			else
				this.tabsContainer.appendChild(tabElement);
		}

		return true;
	}

	/**
	 * Implementation of IView.layout
	 */
	layout(size: number, offset: number, context: undefined): void {
		// The TabView itself doesn't need special layout handling
		// The active editor will be sized to fill the content area via CSS
		if (this.activeEditor) {
			// Trigger layout on the active editor if needed
			// The editor will automatically size to fill the content area
		}
	}

	/**
	 * Set visibility of the tab view
	 */
	setVisible?(visible: boolean): void {
		this.element.style.display = visible ? 'flex' : 'none';
	}

	/**
	 * Dispose of the tab view and all its editors
	 */
	dispose(): void {
		// Remove all editors
		for (const editor of this.editors)
			editor.dispose();

		this.editors = [];
		this.activeEditor = null;

		// Remove from DOM
		this.element.remove();
	}

}
