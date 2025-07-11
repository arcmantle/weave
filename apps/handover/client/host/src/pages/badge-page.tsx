import { AdapterElement } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { Badge } from '@arcmantle/handover-core/badge/badge.cmp.js';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';


export class BadgePageCmp extends AdapterElement {

	static override tagName = 'ho-badge-page';

	protected override render(): unknown {
		return (
			<>
				<Badge<string> variant="default">
					Badge
				</Badge>

				<Badge variant="secondary">
					Badge
				</Badge>

				<Badge variant="outline">
					Badge
				</Badge>

				<Badge variant="destructive">
					Badge
				</Badge>
			</>
		);
	}

	static override styles: CSSStyle = css`
		:host {
			display: grid;
			grid-auto-flow: column;
			place-items: center;
		}
	`;

}


export const BadgePage: ToComponent<BadgePageCmp> = toComponent(BadgePageCmp);
