import { pushSearchState } from '@arcmantle/library/dom';
import { createRef } from 'lit/directives/ref.js';

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
		const Tag = tagName;

		const ref = createRef<HTMLButtonElement>();

		return <div>
			<h1>Shop Sheet navigation</h1>
			<p>This is the primary panel for the Shop Sheet extension.</p>
			<Tag href="https://example.com" target="_blank" value={''}>
				Example Link
			</Tag>

			<button
				disabled={as.bool(false)}
				onmousedown={ev => console.log(ev)}
				ref={ref}
			></button>

			<TestCustomElement<number, 'static'> value={123} variant={'static'} />
		</div>;
	}

}


export const shopSheetManifest: Manifest = createManifest({
	name:      'shop-sheet',
	contents:  [ ShopSheetPrimarySidebar ],
	statusbar: [],
});


declare global {
	interface HTMLElementTagNameMap {
		'test-custom-element': TestCustomElement<number, 'static'>;
	}
}
