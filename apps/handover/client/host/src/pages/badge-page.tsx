import '@arcmantle/handover-core/badge/badge.cmp.js';

import { css, type CSSResultGroup, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';


@customElement('ho-badge-page')
export class BadgePage extends LitElement {

	static tagName = 'ho-badge-page';

	protected override render(): unknown {
		return (
			<>
				<ho-badge variant="default">
					Badge
				</ho-badge>

				<ho-badge variant="secondary">
					Badge
				</ho-badge>

				<ho-badge variant="outline">
					Badge
				</ho-badge>

				<ho-badge variant="destructive">
					Badge
				</ho-badge>
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
