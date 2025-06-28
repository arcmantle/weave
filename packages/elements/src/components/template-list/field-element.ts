import { customElement, MimicElement } from '@arcmantle/lit-utilities/element';
import { sharedStyles } from '@arcmantle/lit-utilities/styles';
import { css, html } from 'lit';


@customElement('mm-field')
export class MMField extends MimicElement {

	public override render() {
		return html`
		<slot></slot>
		`;
	}

	public static override styles = [
		sharedStyles,
		css`
		:host {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	`,
	];

}


declare global {
	interface HTMLElementTagNameMap {
		'mm-field': MMField;
	}
}
