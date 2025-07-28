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

	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 150;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;
	readonly type = 'tab' as const;

	private readonly activeEditor:  Signal<EditorView | null> = signal(null);
	private readonly isVisible:     Signal<boolean> = signal(true);
	private readonly editors:       Signal<EditorView[]> = signal([]);
	private readonly tabsContainer: Ref<HTMLElement> = createRef<HTMLElement>();
	private readonly contentArea:   Ref<HTMLElement> = createRef<HTMLElement>();

	private disposeRender?: () => void;
	private _viewManager:   WeakRef<IViewManager>;

	private get viewManager(): IViewManager {
		const vm = this._viewManager.deref();
		if (!vm)
			throw new Error('ViewManager has been garbage collected');

		return vm;
	}

	constructor(
		viewManager: IViewManager,
	) {
		super();

		this.id = `tab-view-${ crypto.randomUUID() }`;
		this.title = `Tab View ${ this.id }`;
		this._viewManager = new WeakRef(viewManager);

		this.element = document.createElement('div');
		this.element.className = 'tab-view';

		this.performRender();
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

		return html`
		<div
			${ ref(this.tabsContainer) }
			class=${ classMap({
				'tab-view-tabs': true,
				hidden:          !this.isVisible.value,
			}) }
		>
			${ map(this.editors.value, editor => html`
			<div
				class=${ classMap({
					'tab-view-tab': true,
					active:         this.activeEditor.value === editor,
				}) }
				data-editor-id=${ editor.id }
				@click=${ onClickTab.bind(undefined, editor) }
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

	/**
	 * Add an editor to the tab view
	 */
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

		editor.addEventListener('on-removed', (ev) => {
			console.log('editor was removed', ev);
		});
	}

	/**
	 * Create a new editor
	 */
	createEditor(
		id: string,
		title: string,
		templateFunction: EditorTemplateFunction,
	): EditorView {
		const editor = new EditorView(id, title, this.viewManager, templateFunction);

		return editor;
	}

	createAndAddEditor(
		id: string,
		title: string,
		templateFunction: EditorTemplateFunction,
	): EditorView {
		const editor = this.createEditor(id, title, templateFunction);
		this.addEditor(editor);

		return editor;
	}

	/**
	 * Remove an editor from the tab view
	 */
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

	/**
	 * Get the number of editors in this tab view
	 */
	get editorCount(): number {
		return this.editors.value.length;
	}

	findEditorById(id: string): EditorView | undefined {
		return this.editors.value.find(e => e.id === id);
	}

	layout(size: number, offset: number): void {}

	setVisible(visible: boolean): void {
		this.isVisible.value = visible;
	}

	/**
	 * Dispose of the tab view and all its editors
	 */
	dispose(): void {
		this.disposeRender?.();

		// Remove all editors
		for (const editor of this.editors.value)
			editor.dispose();

		this.editors.value = [];
		this.activeEditor.value = null;

		// Remove from DOM
		this.element.remove();
	}

}
