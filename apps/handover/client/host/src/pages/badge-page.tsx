import { Badge } from '@arcmantle/handover-core/badge/badge.cmp.js';
import { css, type CSSResultGroup, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';


@customElement('ho-badge-page')
export class BadgePage extends LitElement {

	static tagName = 'ho-badge-page';

	protected override render(): unknown {
		return (
			<>
				<Badge variant="default" static>
					Badge
				</Badge>

				<Badge variant="secondary" static>
					Badge
				</Badge>

				<Badge variant="outline" static>
					Badge
				</Badge>

				<Badge variant="destructive" static>
					Badge
				</Badge>
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
