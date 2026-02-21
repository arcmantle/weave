import type { ClientManifest } from '@arcmantle/pivot-client-plugin';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';


/**
 * Generates a `client-manifest.json` by reading a plugin config file
 * or using the explicitly provided manifest.
 *
 * If an explicit manifest is passed, it is returned as-is.
 * Otherwise, attempts to read and parse a `pivot-plugin.config.json`
 * from the project root.
 */
export function generateClientManifest(
	projectRoot: string,
	entryModule: string,
	explicit?: ClientManifest,
): ClientManifest {
	if (explicit) {
		return {
			...explicit,
			entryModule: explicit.entryModule ?? entryModule,
		};
	}

	const configPath = resolve(projectRoot, 'pivot-plugin.config.json');
	if (existsSync(configPath)) {
		const raw = readFileSync(configPath, 'utf-8');
		const config = JSON.parse(raw) as ClientManifest;

		return {
			...config,
			entryModule: config.entryModule ?? entryModule,
		};
	}

	// Fallback: minimal manifest with just the entry module
	return {
		entryModule,
	};
}
