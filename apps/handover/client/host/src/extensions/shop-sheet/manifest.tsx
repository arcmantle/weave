import { type ActivitybarManifest, createManifest, type Manifest, type PrimaryPanelManifest } from '../create-manifest.ts';


const shopSheetActivitybar: ActivitybarManifest = {

	id:    'shop-sheet-activity',
	title: 'Shop Sheet',
	icon:  '/icons/shop-solid.svg',

};


class ShopSheetPrimaryPanel implements PrimaryPanelManifest {

	static id: string = 'shop-sheet-navigation';

	async initialize(): Promise<void> {
		// Initialization logic for the ShopSheet primary panel
	}

	render(): unknown {
		return <div>
			<h1>Shop Sheet Panel</h1>
			<p>This is the primary panel for the Shop Sheet extension.</p>
		</div>;
	}

}


export const shopSheetManifest: Manifest = createManifest({
	name:              'shop-sheet',
	activitybar:       [ shopSheetActivitybar ],
	primaryPanels:     [ ShopSheetPrimaryPanel ],
	primarySidebars:   [],
	secondaryPanels:   [],
	secondarySidebars: [],
	statusbar:         [],
});
