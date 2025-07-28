import { effect, render } from '@arcmantle/adapter-element/shared';

import type { IViewManager } from '../view-manager.ts';
import { type EditorTemplateContext, type EditorTemplateFunction, type IEditorView } from './shared.ts';


/**
 * EditorView represents a single editor instance used within other View containers.
 */
export class EditorView extends EventTarget implements IEditorView {

	constructor(
		id: string,
		title: string,
		viewManager: IViewManager,
		templateFunction: EditorTemplateFunction,
	) {
		super();

		this.id = id;
		this.title = title;
		this._viewManager = new WeakRef(viewManager);
		this.templateFunction = templateFunction;

		this.element = document.createElement('div');
		this.element.className = 'editor-view';

		this.renderTemplate();
	}

	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 100;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;
	readonly type = 'editor' as const;

	private templateFunction: EditorTemplateFunction;
	private _viewManager:     WeakRef<IViewManager>;

	private get viewManager(): IViewManager {
		const vm = this._viewManager.deref();
		if (!vm)
			throw new Error('ViewManager has been garbage collected');

		return vm;
	}

	private renderTemplate(): void {
		effect(() => {
			const context: EditorTemplateContext = {
				handleClose: this.remove.bind(this),
				id:          this.id,
				title:       this.title,
			};

			render(this.templateFunction(context), this.element);
		});
	}

	remove(): void {
		this.viewManager.closeEditor(this.id);
		this.dispatchEvent(new CustomEvent('on-removed', { detail: { id: this.id } }));
	}

	layout(size: number, offset: number): void {}

	dispose(): void {
		this.element.remove();
	}

}
