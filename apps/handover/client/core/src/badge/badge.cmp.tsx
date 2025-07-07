import { AdapterElement, property } from '@arcmantle/adapter-element/adapter';
import { type CSSStyle, ifDefined } from '@arcmantle/adapter-element/shared';
import { toComponent, toTag } from '@arcmantle/lit-jsx';

import { cssreset } from '../styles/css-reset.ts';
import badgeStyles from './badge.css' with { type: 'css' };


export class Badge<T> extends AdapterElement {

	static override tagName = 'ho-badge';

	variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
	href:    string | undefined;

	value: T | undefined;

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


export const BadgeCmp: <T>(props: JSX.JSXProps<Badge<T>>) => string =
	toComponent(Badge<any>);


declare global {
	namespace JSX {
		interface CustomElementTags {
			/**
			 * {@link Badge}
			 */
			'ho-badge': JSXProps<Badge<any>>;
		}
	}
}
