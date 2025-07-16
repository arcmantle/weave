import { DisplayElement } from '@arcmantle/mirage-mde-display';
import { type CSSResultGroup, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { handlePreviewScroll } from '../codemirror/commands/toggle-sidebyside.js';
import { MirageMDE } from '../mirage-mde.js';
import previewStyles from './mirage-mde-preview.css' with { type: 'css' };


@customElement('mirage-mde-preview')
export class PreviewElement extends LitElement {

	protected static requiredElements: typeof HTMLElement[] = [ DisplayElement ];

	@property({ type: Object }) scope: MirageMDE;
	@state() protected htmlContent:    string = '';

	editorScroll:  boolean = false;
	previewScroll: boolean = false;

	protected isCreated: boolean = false;

	override disconnectedCallback(): void {
		super.disconnectedCallback();

		this.removeEventListener('scroll', this.handlePreviewScroll);
	}

	setContent(htmlString: string): void;
	setContent(htmlString: Promise<string>): Promise<string>;
	setContent(htmlString: any): any {
		if (typeof htmlString === 'string')
			this.htmlContent = htmlString;
		else if (htmlString)
			return htmlString.then((s: string) => this.htmlContent = s);
	}

	create(): void {
		// Only allow creating once.
		if (this.isCreated)
			return;

		this.isCreated = true;

		// Syncs scroll  preview -> editor
		this.addEventListener('scroll', this.handlePreviewScroll);
	}

	protected handlePreviewScroll = (ev: Event): void => handlePreviewScroll(ev, this.scope);

	protected override render(): unknown {
		return html`
		<mirage-mde-display
			.content=${ this.htmlContent }
		></mirage-mde-display>
		`;
	}

	static override styles: CSSResultGroup = previewStyles;

}


declare global {
	interface HTMLElementTagNameMap {
		'mirage-mde-preview': PreviewElement;
	}
}
