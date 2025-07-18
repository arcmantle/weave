import type { PluginContainer } from '@arcmantle/adapter-element/adapter';

export const createManifest = (options: Manifest): Manifest => {
	return options;
};


export const registerManifest = (
	container: PluginContainer,
	manifest: Manifest,
): void => {
	container.bind('manifest').constant(manifest);
};


export const resolveManifests = (container: PluginContainer): void => {
	const manifests = container.getAll<Manifest>('manifest');

	if (!container.exists('manifest-log'))
		container.bind('manifest-log').constant(new Map());

	const manifestLog = container.get<Map<string, Manifest>>('manifest-log');
	for (const manifest of manifests) {
		if (!manifestLog.has(manifest.name)) {
			console.log(`Registered manifest: ${ manifest.name }`);

			manifestLog.set(manifest.name, manifest);

			manifest.activitybar.forEach((activity: ActivitybarManifest) => {
				container.bind('activitybar').constant(activity);
			});

			manifest.primaryPanels.forEach(panel => {
				container.bind('primary-panel').class(panel);
			});
		}
	}
};


export interface Manifest {
	name:              string;
	primaryPanels:     PrimaryPanelCtor[];
	primarySidebars:   any[];
	secondaryPanels:   any[];
	secondarySidebars: any[];
	activitybar:       any[];
	statusbar:         any[];
}


export interface ActivitybarManifest {
	id:    string;
	title: string;
	icon:  string;
}


export type PrimaryPanelCtor = (new () => PrimaryPanelManifest) & { id: string; };


export interface PrimaryPanelManifest {
	initialize: () => Promise<void> | void;
	render:     () => unknown;
}
