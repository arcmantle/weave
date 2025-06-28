import { sharedStyles } from '../../app/shared-styles.ts';
import { AegisComponent, ContainerModule, customElement } from '@arcmantle/lit-aegis';
import { isMobile } from '@arcmantle/core/dom';


@customElement('syn-search-page', true)
export class SearchPageCmp extends AegisComponent {

	constructor() { super(undefined, searchPageModule); }
	public static override styles = sharedStyles;

}


const searchPageModule = new ContainerModule(({ bind }) => {
	bind('syn-search-page').toDynamicValue(async () => {
		const ctor = await (isMobile
			? import('./search-adapter-mobile.ts').then(m => m.SearchPageMobileAdapter)
			: import('./search-adapter-desktop.ts').then(m => m.SearchPageDesktopAdapter));

		return ctor;
	}).inTransientScope();
});
