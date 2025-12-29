import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';


@customElement('ho-statusbar')
export class Statusbar extends LitElement {

	static tagName: string = 'ho-statusbar';

	protected override render(): unknown {
		return <div>
		</div>;
	}

	static override styles: CSSStyle = css`
		:host {
			background-color: lightgray;
			height: 30px;
		}
	`;

}


declare global {
	interface HTMLElementTagNameMap {
		'ho-statusbar': Statusbar;
	}
}
