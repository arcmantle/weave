import type {
	ClientManifest,
	PluginActivator,
	ResolvedPluginDescriptor,
} from '@arcmantle/pivot-client-plugin';


/**
 * Fetches all enabled plugins' client manifests from the backend.
 */
export async function fetchClientManifests(
	baseApiUrl = '/api/plugins/client-manifests',
): Promise<ResolvedPluginDescriptor[]> {
	const response = await fetch(baseApiUrl);
	if (!response.ok)
		throw new Error(`Failed to fetch client manifests: ${ response.status } ${ response.statusText }`);

	return response.json();
}


/**
 * Fetches the generated import map from the backend.
 */
export async function fetchImportMap(
	baseApiUrl = '/api/client/import-map',
): Promise<{ imports: Record<string, string>; }> {
	const response = await fetch(baseApiUrl);
	if (!response.ok)
		throw new Error(`Failed to fetch import map: ${ response.status } ${ response.statusText }`);

	return response.json();
}


/**
 * Injects a `<script type="importmap">` into the document head.
 * Must be called before any module scripts are loaded.
 *
 * Note: Import maps can only be added once and must precede any module imports.
 * In production, the backend should inject this into the HTML directly.
 * This function is primarily for development mode.
 */
export function injectImportMap(importMap: { imports: Record<string, string>; }): void {
	const existing = document.querySelector('script[type="importmap"]');
	if (existing) {
		console.warn('[pivot] Import map already exists in document, skipping injection');

		return;
	}

	const script = document.createElement('script');
	script.type = 'importmap';
	script.textContent = JSON.stringify(importMap);
	document.head.appendChild(script);
}


/**
 * Lazily loads a plugin's entry module and calls its `activate` function.
 *
 * @param baseUrl - The base URL for the plugin's client assets
 * @param entryModule - The entry module filename (from client manifest)
 * @returns The activate function, or undefined if the module doesn't export one
 */
export async function loadPluginModule(
	baseUrl: string,
	entryModule: string,
): Promise<PluginActivator | undefined> {
	const url = new URL(entryModule, window.location.origin + baseUrl).href;

	try {
		const module = await import(/* @vite-ignore */ url);

		// Convention: default export is the activate function
		if (typeof module.default === 'function')
			return module.default as PluginActivator;

		// Fallback: named export `activate`
		if (typeof module.activate === 'function')
			return module.activate as PluginActivator;

		console.warn(`[pivot] Plugin at ${ url } does not export an activate function`);

		return undefined;
	}
	catch (error) {
		console.error(`[pivot] Failed to load plugin module from ${ url }:`, error);
		throw error;
	}
}


/**
 * Loads CSS files declared in a plugin's client manifest.
 */
export function loadPluginStyles(baseUrl: string, styles: string[]): void {
	for (const stylePath of styles) {
		const href = new URL(stylePath, window.location.origin + baseUrl).href;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = href;
		link.dataset['pivotPlugin'] = 'true';
		document.head.appendChild(link);
	}
}


/**
 * Dynamically imports a named export from a plugin's entry module.
 * Used for lazy-loading route components and content area components.
 */
export async function loadPluginExport<T>(
	baseUrl: string,
	entryModule: string,
	exportName: string,
): Promise<T> {
	const url = new URL(entryModule, window.location.origin + baseUrl).href;
	const module = await import(/* @vite-ignore */ url);

	if (!(exportName in module))
		throw new Error(`Plugin module at ${ url } does not export '${ exportName }'`);

	return module[exportName] as T;
}


/**
 * Validates that a plugin's shared dependency requirements
 * are compatible with what the host provides.
 */
export function validateSharedDependencies(
	pluginName: string,
	manifest: ClientManifest,
	hostVersions: Record<string, string>,
): string[] {
	const warnings: string[] = [];
	const shared = manifest.dependencies?.shared;

	if (!shared)
		return warnings;

	for (const [ pkg, requiredRange ] of Object.entries(shared)) {
		if (!(pkg in hostVersions)) {
			warnings.push(
				`Plugin "${ pluginName }" requires shared dependency "${ pkg }" (${ requiredRange }) ` +
				`but the host does not provide it`,
			);
		}
		// Note: Full semver range validation would require a semver library.
		// For now, we just check that the host provides the dependency.
	}

	return warnings;
}
