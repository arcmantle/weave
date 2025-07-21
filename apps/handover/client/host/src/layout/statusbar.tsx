import { AdapterElement } from '@arcmantle/adapter-element/adapter';
import { css, type CSSStyle } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';


export class StatusbarCmp extends AdapterElement {

	static override tagName: string = 'ho-statusbar';

	protected override render(): unknown {
		return <div>
		</div>;
	}

	static override styles: CSSStyle = css`
		:host {
			background-color: lightgray;
			height: 30px;
		}
	`;

}


export const Statusbar: ToComponent<StatusbarCmp> =
	toComponent(StatusbarCmp);
