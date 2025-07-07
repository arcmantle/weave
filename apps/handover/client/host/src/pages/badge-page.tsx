import { AdapterElement } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { BadgeCmp } from '@arcmantle/handover-core/badge/badge.cmp.js';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';


export class BadgePageCmp extends AdapterElement {

	static override tagName = 'ho-badge-page';

	protected override render(): unknown {
		return (
			<>
				<BadgeCmp<string> variant="default">
					Badge
				</BadgeCmp>

				{/*<BadgeCmp variant="secondary">
					Badge
				</BadgeCmp>

				<BadgeCmp variant="outline">
					Badge
				</BadgeCmp>

				<BadgeCmp variant="destructive">
					Badge
				</BadgeCmp>*/}
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
