import { pushSearchState } from '@arcmantle/library/dom';

import { type Content, type ContentManifest, createManifest, type Manifest } from '../create-manifest.ts';
import { TestCustomElement } from './test.ts';


class ShopSheetPrimarySidebar implements Content {

	static manifest: ContentManifest = {
		id:                 'shop-sheet-navigation',
		defaultLocation:    'primary-sidebar',
		availableLocations: [ 'primary-sidebar', 'secondary-sidebar' ],
		tab:                {
			id:      'shop-sheet-navigation-tab',
			title:   'Shop Sheet',
			icon:    '/icons/shop-solid.svg',
			onClick: () => {
				const search = new URLSearchParams(location.search);
				search.set('ps', 'shop-sheet-navigation');

				pushSearchState(search);
			},
		},
	};

	async initialize(): Promise<void> {
		// Initialization logic for the ShopSheet primary panel
	}

	render(): unknown {
		const tagName: 'a' | 'input' = undefined as any;
		const Tag = as.tag(tagName);

		return <div>
			<h1>Shop Sheet navigation</h1>
			<p>This is the primary panel for the Shop Sheet extension.</p>
			<Tag href="https://example.com" target="_blank" value={123} static>Example Link</Tag>

			<TestCustomElement<number, 'static'> value={12} variant={undefined} static />
		</div>;
	}

}


export const shopSheetManifest: Manifest = createManifest({
	name:      'shop-sheet',
	contents:  [ ShopSheetPrimarySidebar ],
	statusbar: [],
});
