import { type Signal, signal } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';


export class SecondarySidebarCmp extends ContentArea {

	static override tagName:  string = 'ho-secondary-sidebar';
	override contentLocation: ContentLocation = 'secondary-sidebar';

	protected secondarySidebar: SecondarySidebarService = this.inject.get('secondary-sidebar');

	protected override render(): unknown {
		return <div>
		</div>;
	}

}


export const SecondarySidebar: ToComponent<SecondarySidebarCmp> =
	toComponent(SecondarySidebarCmp);


export class SecondarySidebarService {

	visible: Signal<boolean> = layoutPreferences.secondarySidebar.visible;

}
