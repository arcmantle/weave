import { readFileSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import type { Plugin, UserConfig } from 'vite';

import { DEFAULT_SHARED_DEPENDENCIES, type PivotPluginOptions } from './config.js';
import { generateClientManifest } from './manifest-gen.js';
import { bundleSharedDependencies, getRootPackage } from './shared-bundler.js';


/**
 * Vite plugin for building Pivot client-side plugins.
 *
 * Handles:
 * - Externalizing shared dependencies so they resolve via the host's import map
 * - Bundling shared dependencies with esbuild code splitting so each plugin
 *   ships self-contained ESM bundles of its shared deps
 * - Configuring ES module output format
 * - Generating `client-manifest.json` in the build output
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { pivotPlugin } from '@arcmantle/pivot-vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     pivotPlugin({
 *       name: 'WeatherPlugin',
 *     }),
 *   ],
 * });
 * ```
 */
export function pivotPlugin(options: PivotPluginOptions): Plugin {
	const {
		name,
		entry = 'src/index.ts',
		outDir = 'dist/client',
		additionalExternals = [],
		bundleOverrides = [],
		clientManifest: explicitManifest,
	} = options;

	const externals = new Set([
		...DEFAULT_SHARED_DEPENDENCIES,
		...additionalExternals,
	]);

	// Remove any bundle overrides from the externals set
	for (const override of bundleOverrides)
		externals.delete(override);


	let projectRoot = '';

	return {
		name: 'pivot-plugin',

		config(_config, _env): UserConfig {
			return {
				build: {
					outDir,
					lib: {
						entry:    resolve(entry),
						formats:  [ 'es' ],
						fileName: () => 'index.js',
					},
					rollupOptions: {
						external: (source: string) => {
							// Exact match
							if (externals.has(source))
								return true;

							// Match sub-paths (e.g. `lit/decorators.js` matches `lit`)
							for (const ext of externals) {
								if (source.startsWith(ext + '/'))
									return true;
							}

							return false;
						},
						output: {
							// Preserve module structure for code splitting
							preserveModules:      false,
							inlineDynamicImports: false,
						},
					},
					// Don't empty the output dir — other build steps may have written to it
					emptyOutDir: true,
					minify:      false,
					sourcemap:   true,
					target:      'es2022',
				},
			};
		},

		configResolved(config) {
			projectRoot = config.root;
		},

		async closeBundle() {
			const entryFileName = basename(entry).replace(/\.tsx?$/, '.js');

			const manifest = generateClientManifest(
				projectRoot,
				entryFileName,
				explicitManifest,
			);

			// Scan the built output for externalized bare specifiers and merge
			// them into the manifest's dependencies.shared automatically.
			const outputPath = resolve(projectRoot, outDir, entryFileName);
			const detectedShared = detectExternalizedImports(outputPath, externals);

			if (detectedShared.length > 0) {
				manifest.dependencies ??= {};
				manifest.dependencies.shared ??= {};

				// Record each specifier with the exact installed version of
				// its root package (e.g. `lit/decorators.js` → lit's version).
				for (const specifier of detectedShared) {
					const rootPkg = getRootPackage(specifier);
					// Version will be filled in from sharedBundles below;
					// use '*' as a temporary placeholder.
					manifest.dependencies.shared[specifier] ??= '*';

					// Patch in exact version once bundles are built (see below).
					void rootPkg;
				}
			}

			// Bundle each shared dependency into a self-contained ESM file
			// using esbuild's code splitting. Outputs go to dist/client/shared/.
			const sharedBundles = await bundleSharedDependencies(
				detectedShared,
				projectRoot,
				outDir,
			);

			manifest.sharedBundles = sharedBundles;

			// Backfill exact versions into dependencies.shared
			if (manifest.dependencies?.shared) {
				for (const specifier of Object.keys(manifest.dependencies.shared)) {
					const rootPkg = getRootPackage(specifier);
					const bundle = sharedBundles[rootPkg];
					if (bundle)
						manifest.dependencies.shared[specifier] = bundle.version;
				}
			}

			const manifestPath = resolve(projectRoot, outDir, 'client-manifest.json');
			writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t'), 'utf-8');

			console.log(`[pivot-plugin] Built plugin "${ name }"`);
			console.log(`[pivot-plugin] Entry: ${ entryFileName }`);
			console.log(`[pivot-plugin] Manifest: ${ manifestPath }`);

			if (detectedShared.length > 0)
				console.log(`[pivot-plugin] Shared deps: ${ detectedShared.join(', ') }`);

			const bundledPkgs = Object.entries(sharedBundles)
				.map(([ pkg, b ]) => `${ pkg }@${ b.version }`)
				.join(', ');

			if (bundledPkgs)
				console.log(`[pivot-plugin] Shared bundles: ${ bundledPkgs }`);
		},
	};
}


/**
 * Scans a built JS file for `import ... from "..."` statements that match
 * the externalized dependency set, returning all bare specifiers found.
 */
function detectExternalizedImports(filePath: string, externals: Set<string>): string[] {
	let source: string;
	try {
		source = readFileSync(filePath, 'utf-8');
	}
	catch {
		return [];
	}

	const found: Set<string> = new Set();
	// Match static import declarations: import ... from "specifier"
	const importRegex = /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;

	let match: RegExpExecArray | null;
	while ((match = importRegex.exec(source)) !== null) {
		const specifier = match[1]!;
		if (externals.has(specifier)) { found.add(specifier); }
		else {
			// Check if a parent package is in the set (e.g. "lit/decorators.js" → "lit")
			for (const ext of externals) {
				if (specifier.startsWith(ext + '/')) {
					found.add(specifier);
					break;
				}
			}
		}
	}

	return [ ...found ].sort();
}
