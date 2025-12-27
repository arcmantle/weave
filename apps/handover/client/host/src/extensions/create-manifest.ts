import { injector } from '../inject.ts';


export const createManifest = (options: Manifest): Manifest => {
	return options;
};


export const registerManifest = (manifest: Manifest): void => {
	injector.bind('manifest').constant(manifest);
};


export const resolveManifests = (): void => {
	const container = injector;
	const manifests = container.getAll<Manifest>('manifest');

	if (!container.exists('manifest-log'))
		container.bind('manifest-log').constant(new Map());

	const manifestLog = container.get<Map<string, Manifest>>('manifest-log');
	for (const manifest of manifests) {
		if (manifestLog.has(manifest.name))
			continue;

		console.log(`Registered manifest: ${ manifest.name }`);

		manifestLog.set(manifest.name, manifest);

		manifest.contents.forEach((content: ContentCtor) => {
			container.bind('content').constant(content);
		});
	}
};


export interface Manifest {
	name:      string;
	contents:  ContentCtor[];
	statusbar: any[];
}


export type ContentCtor = (new () => Content) & {
	manifest: ContentManifest;
};


export interface ContentManifest {
	id:                 string;
	defaultLocation:    ContentLocation;
	availableLocations: ContentLocation[];
	tab: {
		id:      string;
		title:   string;
		icon:    string;
		onClick: () => void;
	};
}


export interface Content {
	initialize: () => Promise<void> | void;
	render:     () => unknown;
}


export type ContentLocation =
	| 'editor'
	| 'primary-sidebar'
	| 'secondary-sidebar'
	| 'panel';
