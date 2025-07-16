import { type CSSResultGroup, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

import dragbarStyles from './mirage-mde-dragbar.css' with { type: 'css' };


@customElement('mirage-mde-dragbar')
export class DragbarElement extends LitElement {

	protected override render(): unknown {
		return html`
		<div class="drag-handle"></div>
		`;
	}

	static override styles: CSSResultGroup = dragbarStyles;

}


declare global {
	interface HTMLElementTagNameMap {
		'mirage-mde-dragbar': DragbarElement;
	}
}
