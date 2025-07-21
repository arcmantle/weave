import { pushSearchState } from '@arcmantle/library/dom';

import { type Content, type ContentManifest, createManifest, type Manifest } from '../create-manifest.ts';


class AbsenceNavigation implements Content {

	static manifest: ContentManifest = {
		id:                 'absence-navigation',
		defaultLocation:    'primary-sidebar',
		availableLocations: [ 'primary-sidebar', 'secondary-sidebar' ],
		tab:                {
			id:      'absence-navigation-tab',
			title:   'Absence',
			icon:    '/icons/person-hiking-solid.svg',
			onClick: () => {
				const search = new URLSearchParams(location.search);
				search.set('ps', 'absence-navigation');

				pushSearchState(search);
			},
		},
	};

	async initialize(): Promise<void> {
	}

	render(): unknown {
		return <div>
			<h1>Absence navigation</h1>
			<p>This is the primary panel for the Shop Sheet extension.</p>
		</div>;
	}

}


// TODO Update the manifest so that a Manifest content can be effectively in any of the sidebars or secondary panel positions.
// We instead just need to give a default location in the class declaration of that manifest item.
export const absenceManifest: Manifest = createManifest({
	name:      'absence',
	contents:  [ AbsenceNavigation ],
	statusbar: [],
});
