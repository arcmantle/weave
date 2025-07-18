import { AdapterElement, property } from '@arcmantle/adapter-element/adapter';
import { type CSSStyle, ifDefined } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent, toTag } from '@arcmantle/lit-jsx';

import { cssreset } from '../styles/css-reset.ts';
import badgeStyles from './badge.css' with { type: 'css' };


class BadgeCmp extends AdapterElement {

	static override tagName = 'ho-badge';

	@property(String) accessor variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
	@property(String) accessor href: string | undefined;

	protected override render(): unknown {
		const Wrapper = toTag(this.href ? 'a' : 'span');

		return (
			<Wrapper
				id="base"
				tabindex="0"
				href={ ifDefined(this.href) }
				classList={{ [this.variant]: true }}
			>
				<slot></slot>
			</Wrapper>
		);
	}

	static override styles: CSSStyle = [
		cssreset,
		badgeStyles,
	];

}


export const Badge: ToComponent<BadgeCmp> = toComponent(BadgeCmp);
