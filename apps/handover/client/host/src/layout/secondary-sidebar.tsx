import { AdapterElement, property } from '@arcmantle/adapter-element/adapter';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';


export class SecondarySidebarCmp extends AdapterElement {

	static override tagName: string = 'ho-secondary-sidebar';

	@property(String) accessor activeTemplateId: string = '';

	protected override render(): unknown {
		return <div>
		</div>;
	}

}


export const SecondarySidebar: ToComponent<SecondarySidebarCmp> = toComponent(SecondarySidebarCmp);
