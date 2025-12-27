
import { type CSSResultGroup, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined as shit } from 'lit/directives/if-defined.js';

const ifDefined = shit as <T>(value: T) => NonNullable<T>;

import { cssreset } from '../styles/css-reset.ts';
import badgeStyles from './badge.css' with { type: 'css' };


export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';


@customElement('ho-badge')
export class Badge extends LitElement {

	static tagName = 'ho-badge';

	@property() accessor variant: BadgeVariant = 'default';
	@property() accessor href:    string | undefined;

	protected override render(): unknown {
		const Wrapper = this.href ? 'a' : 'span';

		return <>
			<Wrapper
				id="base"
				tabIndex={0}
				href={ ifDefined(this.href) }
				classList={{ [this.variant]: true }}
				static
			>
				<slot></slot>
			</Wrapper>
		</>;
	};

	static override styles: CSSResultGroup = [
		cssreset,
		badgeStyles,
	];

}
