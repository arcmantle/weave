import { AdapterElement, property } from '@arcmantle/adapter-element/adapter';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';


export class PrimarySidebarCmp extends AdapterElement {

	static override tagName: string = 'ho-primary-sidebar';

	@property(String) accessor activeTemplateId: string = '';

	protected override render(): unknown {
		return <div>
		</div>;
	}

}


export const PrimarySidebar: ToComponent<PrimarySidebarCmp> =
	toComponent(PrimarySidebarCmp);
