import { type CSSResultGroup, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { cssreset } from '../styles/css-reset.ts';
import buttonStyles from './button.css' with { type: 'css' };


export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';


@customElement('ho-button')
export class Button extends LitElement {

	static tagName = 'ho-button';

	@property() accessor variant: ButtonVariant = 'default';
	@property() accessor size: ButtonSize = 'default';

	protected override render(): unknown {
		return (
			<button class={{ [this.variant]: true, [this.size]: true }}>
				<slot></slot>
			</button>
		);
	}

	static override styles: CSSResultGroup = [
		cssreset,
		buttonStyles,
	];

}
