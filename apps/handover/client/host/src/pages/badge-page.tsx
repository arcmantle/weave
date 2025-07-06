import { AdapterElement } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { type ToJSX, toJSX } from '@arcmantle/lit-jsx';

import { Badge } from '../components/badge.cmp.tsx';


export class BadgePage extends AdapterElement {

	static override tagName = 'ho-badge-page';
	static tag: ToJSX<BadgePage> = toJSX(this);

	protected override render(): unknown {
		return (
			<>
				<Badge.tag variant="default">
					Badge
				</Badge.tag>
				<Badge.tag variant="secondary">
					Badge
				</Badge.tag>
				<Badge.tag variant="outline">
					Badge
				</Badge.tag>
				<Badge.tag variant="destructive">
					Badge
				</Badge.tag>
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
