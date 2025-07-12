import { AdapterElement } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { Button } from '@arcmantle/handover-core/button/button.cmp.tsx';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';


export class ButtonPageCmp extends AdapterElement {

	static override tagName = 'ho-button-page';

	protected override render(): unknown {
		return (
			<>
				<Button variant="default">
					Default Button
				</Button>
				<Button variant="secondary">
					Secondary Button
				</Button>
				<Button variant="outline">
					Outline Button
				</Button>
				<Button variant="ghost">
					Ghost Button
				</Button>
				<Button variant="link">
					Link Button
				</Button>
				<Button variant="destructive">
					Destructive Button
				</Button>
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


export const ButtonPage: ToComponent<ButtonPageCmp> = toComponent(ButtonPageCmp);
