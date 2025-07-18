import { AdapterElement } from '@arcmantle/adapter-element/adapter';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';


export class StatusbarCmp extends AdapterElement {

	static override tagName: string = 'ho-statusbar';

	protected override render(): unknown {
		const query = new URLSearchParams(location.search);
		const ids = query.getAll('statusbar');
		const templates = ids.map(id => this.inject.get(id));

		return <div>
			{templates}
		</div>;
	}

}


export const Statusbar: ToComponent<StatusbarCmp> =
	toComponent(StatusbarCmp);
