import { AdapterElement, property } from '@arcmantle/adapter-element/adapter';
import type { CSSStyle } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import { cssreset } from '../styles/css-reset.ts';
import buttonStyles from './button.css' with { type: 'css' };


export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';


class ButtonCmp extends AdapterElement {

	static override tagName = 'ho-button';

	@property(String) accessor variant: ButtonVariant = 'default';
	@property(String) accessor size: ButtonSize = 'default';

	protected override render(): unknown {
		return (
			<button classList={{ [this.variant]: true, [this.size]: true }}>
				<slot></slot>
			</button>
		);
	}

	static override styles: CSSStyle = [
		cssreset,
		buttonStyles,
	];

}


export const Button: ToComponent<ButtonCmp> = toComponent(ButtonCmp);
