import { AdapterElement } from '@arcmantle/adapter-element/adapter';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';


export class StatusbarCmp extends AdapterElement {

	static override tagName: string = 'ho-statusbar';

	protected override render(): unknown {
		return <div>
		</div>;
	}

}


export const Statusbar: ToComponent<StatusbarCmp> =
	toComponent(StatusbarCmp);
