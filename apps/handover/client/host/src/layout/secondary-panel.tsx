import { AdapterElement, property } from '@arcmantle/adapter-element/adapter';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';


export class SecondaryPanelCmp extends AdapterElement {

	static override tagName: string = 'ho-secondary-panel';

	@property(String) accessor activeTemplateId: string = '';

	protected override render(): unknown {
		return <div>
		</div>;
	}

}


export const SecondaryPanel: ToComponent<SecondaryPanelCmp> =
	toComponent(SecondaryPanelCmp);
