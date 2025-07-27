import { render } from '@arcmantle/adapter-element/shared';

import { type EditorTemplateContext, type EditorTemplateFunction, type IEditorView } from './shared.ts';

/**
 * EditorView represents a single editor instance within the split view system.
 *
 * NOTE: This class is now used internally by TabView and NestedView only.
 * For creating editors, use TabView.createEditor() or ViewManager.createEditor()
 * which creates TabViews containing EditorViews.
 *
 * Standalone EditorViews are no longer part of the public API.
 */
export class EditorView implements IEditorView {

	readonly id:          string;
	readonly title:       string;
	readonly element:     HTMLElement;
	readonly minimumSize = 100;
	readonly maximumSize: number = Number.POSITIVE_INFINITY;
	readonly type = 'editor' as const;

	onRemove?:                (id: string) => boolean | void;
	private templateFunction: EditorTemplateFunction;

	constructor(
		id: string,
		title: string,
		templateFunction: EditorTemplateFunction,
		onRemove?: (id: string) => boolean | void,
	) {
		this.id = id;
		this.title = title;
		this.templateFunction = templateFunction;
		this.onRemove = onRemove;
		this.element = document.createElement('div');
		this.element.className = 'editor-view';

		this.renderTemplate();
	}

	private renderTemplate(): void {
		const context: EditorTemplateContext = {
			handleClose: this.handleClose,
			id:          this.id,
			title:       this.title,
		};

		const template = this.templateFunction(context);
		render(template, this.element);
	}

	private handleClose = (): void => {
		// If onRemove callback exists, check if removal should proceed
		if (this.onRemove) {
			const shouldRemove = this.onRemove(this.id);
			// If callback returned false, don't proceed with removal
			if (shouldRemove === false)
				return;
		}

		// If no callback or callback returned true/undefined, removal is handled elsewhere
		// This is just for the template to trigger the removal process
	};

	/**
	 * Public method to trigger editor closing
	 */
	close(): void {
		this.handleClose();
	}

	layout(size: number, offset: number, context: undefined): void {
		// The parent .split-view-view container is already being positioned and sized
		// by the SplitView, so we don't need to apply additional styles here.
		// The .editor-view will inherit the full size from its parent container.
	}

	dispose(): void {
		this.element.remove();
	}

}
