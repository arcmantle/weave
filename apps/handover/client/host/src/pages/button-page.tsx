import '@arcmantle/handover-core/button/button.cmp.js';

import { css, type CSSResultGroup, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';


@customElement('ho-button-page')
export class ButtonPage extends LitElement {

	static tagName = 'ho-button-page';

	protected override render(): unknown {
		return (
			<>
				<ho-button variant="default">
					Default Button
				</ho-button>

				<ho-button variant="secondary">
					Secondary Button
				</ho-button>

				<ho-button variant="outline">
					Outline Button
				</ho-button>

				<ho-button variant="ghost">
					Ghost Button
				</ho-button>

				<ho-button variant="link">
					Link Button
				</ho-button>

				<ho-button variant="destructive">
					Destructive Button
				</ho-button>
			</>
		);
	}

	static override styles: CSSResultGroup = css`
		:host {
			display: grid;
			grid-auto-flow: column;
			place-items: center;
		}
	`;

}
