import { AdapterElement, property } from '@arcmantle/adapter-element/adapter';
import { type CSSStyle, ifDefined } from '@arcmantle/adapter-element/shared';
import { type ToJSX, toJSX, toTag } from '@arcmantle/lit-jsx';

import { cssreset } from '../styles/css-reset.ts';
import badgeStyles from './badge.css' with { type: 'css' };


export class Badge extends AdapterElement {

	static override tagName = 'ho-badge';
	static tag: ToJSX<Badge> = toJSX(this);

	@property(String) accessor variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
	@property(String) accessor href: string | undefined;

	protected override render(): unknown {
		const Wrapper = toTag(this.href ? 'a' : 'span');

		return (
			<Wrapper.tag
				id="base"
				tabindex="0"
				href={ ifDefined(this.href) }
				classList={{ [this.variant]: true }}
			>
				<slot></slot>
			</Wrapper.tag>
		);
	}

	static override styles: CSSStyle = [
		cssreset,
		badgeStyles,
	];

}


declare global {
	namespace JSX {
		interface CustomElementTags {
			/**
			 * {@link Badge}
			 */
			'ho-badge': JSXProps<Badge>;
		}
	}
}
