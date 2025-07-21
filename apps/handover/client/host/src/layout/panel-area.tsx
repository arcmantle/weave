import { type Signal, signal } from '@arcmantle/adapter-element/shared';
import { type ToComponent, toComponent } from '@arcmantle/lit-jsx';

import type { ContentLocation } from '../extensions/create-manifest.ts';
import { ContentArea } from './content-area.tsx';
import { layoutPreferences } from './layout-preferences.ts';


export class PanelAreaCmp extends ContentArea {

	static override tagName:  string = 'ho-panel-area';
	override contentLocation: ContentLocation = 'panel';

	protected panelArea: PanelAreaService = this.inject.get('panel-area');

	protected override render(): unknown {
		return <div>
		</div>;
	}

}


export const PanelArea: ToComponent<PanelAreaCmp> =
	toComponent(PanelAreaCmp);


export class PanelAreaService {

	visible: Signal<boolean> = layoutPreferences.panelArea.visible;

}
