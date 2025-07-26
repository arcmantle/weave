import { EditorView, type IEditorView } from './view-manager.ts';


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

	private editors:       EditorView[] = [];
	private activeEditor:  EditorView | null = null;
	private tabsContainer: HTMLElement;
	private contentArea:   HTMLElement;
	private onRemove?:     (id: string) => void;

	constructor(
		id: string,
		title: string,
		onRemove?: (id: string) => void,
	) {
		this.id = id;
		this.title = title;
		this.onRemove = onRemove;
		this.element = document.createElement('div');
		this.element.className = 'tab-view';
		this.element.style.cssText = `
			display: flex;
			flex-direction: column;
			height: 100%;
			background: var(--vscode-editor-background);
		`;

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
	}

	/**
	 * Add an editor to the tab view
	 */
	addEditor(editor: EditorView): void {
		if (this.editors.includes(editor))
			return;

		this.editors.push(editor);
		this.createTabForEditor(editor);

		// If this is the first editor, make it active
		if (this.editors.length === 1)
			this.setActiveEditor(editor);
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

		// Hide the editor's element
		if (editor.element.parentNode === this.contentArea)
			this.contentArea.removeChild(editor.element);

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
		closeButton.textContent = '×';
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
			this.onRemove?.(editor.id);
		});

		closeButton.addEventListener('mouseenter', () => {
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
