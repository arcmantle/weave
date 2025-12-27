import { Button } from '@arcmantle/handover-core/button/button.cmp.js';
import { css, type CSSResultGroup, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';


@customElement('ho-button-page')
export class ButtonPage extends LitElement {

	static tagName = 'ho-button-page';

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

	static override styles: CSSResultGroup = css`
		:host {
			display: grid;
			grid-auto-flow: column;
			place-items: center;
		}
	`;

}
