import { effect, type Signal, signal } from '@arcmantle/adapter-element/shared';
import { html, render } from 'lit-html';
import { classMap } from 'lit-html/directives/class-map.js';
import { map } from 'lit-html/directives/map.js';
import { createRef, type Ref, ref } from 'lit-html/directives/ref.js';

import type { IRenderableView } from '../types.ts';
import type { IViewManager } from '../view-manager.ts';
import { EditorView } from './editor-view.ts';
import { type EditorTemplateFunction, type IEditorView } from './shared.ts';
import { TabDragManager } from './tab-view-drag.ts';


/**
 * A view that displays multiple editors in tabs with one active editor visible
 */
export class TabView extends EventTarget implements IEditorView, IRenderableView {

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

	readonly editors:              Signal<EditorView[]>      = signal([]);
	readonly activeEditor:         Signal<EditorView | null> = signal(null);
	private readonly isVisible:    Signal<boolean>           = signal(true);
	readonly tabsContainer:        Ref<HTMLElement> = createRef<HTMLElement>();
	private readonly contentArea:  Ref<HTMLElement> = createRef<HTMLElement>();
	private readonly _viewManager: WeakRef<IViewManager>;

	disposeRender?: () => void;

	// Tab drag and drop state
	draggedTab:     { editor: EditorView; element: HTMLElement; } | null = null;
	dropIndicator:  HTMLElement | null = null;
	tabDragHandler: TabDragManager = new TabDragManager(this);

	get viewManager(): IViewManager {
		const vm = this._viewManager.deref();
		if (!vm)
			throw new Error('ViewManager has been garbage collected');

		return vm;
	}

	get editorCount(): number {
		return this.editors.value.length;
	}

	performRender(): void {
		this.disposeRender = effect(() => void render(this.render(), this.element));
	}

	render(): unknown {
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
