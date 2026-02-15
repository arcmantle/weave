import type { SharedBundle } from '@arcmantle/pivot-client-plugin';
import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';


/**
 * Derives the root package name from a bare specifier.
 *
 * @example
 * ```
 * getRootPackage('lit')                   // 'lit'
 * getRootPackage('lit/decorators.js')     // 'lit'
 * getRootPackage('@lit/context')          // '@lit/context'
 * getRootPackage('@lit/context/index.js') // '@lit/context'
 * ```
 */
export function getRootPackage(specifier: string): string {
	if (specifier.startsWith('@')) {
		// Scoped package: @scope/name or @scope/name/sub/path
		const parts = specifier.split('/');

		return parts.slice(0, 2).join('/');
	}

	// Unscoped package: name or name/sub/path
	return specifier.split('/')[0]!;
}


/**
 * Converts a bare specifier to a safe file name for the output bundle.
 *
 * Replaces `/` with `__` and `.` with `_` to produce a flat, filesystem-safe name.
 *
 * @example
 * ```
 * specifierToFileName('lit')                    // 'lit'
 * specifierToFileName('lit/decorators.js')      // 'lit__decorators_js'
 * specifierToFileName('lit/directives/when.js') // 'lit__directives__when_js'
 * specifierToFileName('@lit/context')           // '@lit__context'
 * ```
 */
export function specifierToFileName(specifier: string): string {
	return specifier
		.replaceAll('/', '__')
		.replaceAll('.', '_');
}


/**
 * Reads the exact installed version of a package from its `package.json`.
 */
function getInstalledVersion(
	packageName: string,
	require: NodeRequire,
): string {
	try {
		const pkgJsonPath = require.resolve(`${ packageName }/package.json`);
		const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));

		return pkgJson.version as string;
	}
	catch {
		// Some packages don't export package.json — try resolving the
		// package dir and reading package.json manually.
		try {
			const mainPath = require.resolve(packageName);
			// Walk up to find package.json
			let dir = dirname(mainPath);
			for (let i = 0; i < 10; i++) {
				try {
					const pkgJsonPath = resolve(dir, 'package.json');
					const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
					if (pkgJson.name === packageName)
						return pkgJson.version as string;
				}
				catch { /* continue */ }

				const parent = dirname(dir);
				if (parent === dir)
					break;

				dir = parent;
			}
		}
		catch { /* fall through */ }

		return '0.0.0';
	}
}


/**
 * Bundles shared dependencies using esbuild's code splitting.
 *
 * Groups specifiers by root package, then runs a single esbuild build per
 * root package with all its specifiers as entry points. Esbuild extracts
 * shared internal modules (e.g. `@lit/reactive-element`) into shared
 * chunks, ensuring only one copy exists at runtime.
 *
 * @param specifiers - Bare specifiers to bundle (e.g. `['lit', 'lit/decorators.js']`)
 * @param projectRoot - Absolute path to the plugin project root
 * @param outDir - Relative output directory (e.g. `'dist/client'`)
 * @returns Map of root package name → SharedBundle metadata
 */
export async function bundleSharedDependencies(
	specifiers: string[],
	projectRoot: string,
	outDir: string,
): Promise<Record<string, SharedBundle>> {
	const require = createRequire(resolve(projectRoot, 'package.json'));

	// Group specifiers by root package
	const groups: Map<string, string[]> = new Map();
	for (const specifier of specifiers) {
		const root = getRootPackage(specifier);
		const group = groups.get(root) ?? [];
		group.push(specifier);
		groups.set(root, group);
	}

	const bundles: Record<string, SharedBundle> = {};
	const sharedOutDir = resolve(projectRoot, outDir, 'shared');

	for (const [ rootPkg, pkgSpecifiers ] of groups) {
		const version = getInstalledVersion(rootPkg, require);

		// Create virtual entry points for each specifier.
		// Each entry re-exports everything from the bare specifier.
		const entryPoints: Record<string, string> = {};
		for (const specifier of pkgSpecifiers) {
			const outName = specifierToFileName(specifier);
			entryPoints[outName] = specifier;
		}

		// Collect specifiers from OTHER root packages to mark as external.
		// This ensures each root package bundle is self-contained with respect
		// to its own internals, but doesn't pull in other shared packages.
		const otherSharedSpecifiers = specifiers.filter(
			s => getRootPackage(s) !== rootPkg,
		);

		try {
			await build({
				entryPoints,
				bundle:        true,
				format:        'esm',
				splitting:     pkgSpecifiers.length > 1,
				outdir:        sharedOutDir,
				target:        'es2022',
				platform:      'browser',
				// Mark other shared packages as external so they resolve
				// via their own bundles at runtime.
				external:      otherSharedSpecifiers,
				// Resolve from the plugin's node_modules
				absWorkingDir: projectRoot,
				minify:        false,
				sourcemap:     true,
				logLevel:      'warning',
				// Suppress tree-shaking warnings for re-export entry points
				treeShaking:   true,
			});

			// Build the files map for this root package
			const files: Record<string, string> = {};
			for (const specifier of pkgSpecifiers) {
				const outName = specifierToFileName(specifier);
				files[specifier] = `${ outName }.js`;
			}

			bundles[rootPkg] = { version, files };
		}
		catch (err) {
			console.error(
				`[pivot-plugin] Failed to bundle shared deps for "${ rootPkg }":`,
				err,
			);
		}
	}

	return bundles;
}
