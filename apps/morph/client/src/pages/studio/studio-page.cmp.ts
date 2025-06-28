import { customElement, MimicElement } from '@arcmantle/lit-utilities/element';
import { html } from 'lit';

@customElement('m-studio-page')
export class StudioPage extends MimicElement {

	public static page = true;

	protected override render(): unknown {
		return html`
		HEI
		`;
	}

}
