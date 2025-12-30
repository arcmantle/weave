import { existsSync, readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { dirname } from 'node:path';
import { join } from 'node:path/posix';

import type { ExportObject, PackageJson } from './package-json.ts';


const nameToPathMap: Map<string, string> = new Map();
const nameToContentMap: Map<string, PackageJson> = new Map();
const workspaceOverrides: Map<string, string> = new Map();

/**
 * Reset the package cache. Useful for testing.
 * @internal
 */
export const __resetPackageCache = (): void => {
	nameToPathMap.clear();
	nameToContentMap.clear();
	workspaceOverrides.clear();
};

const ensurePackageLookup = async () => {
	if (nameToPathMap.size)
		return;

	// Read workspace overrides from pnpm-workspace.yaml
	const workspaceYamlPath = join(process.cwd().replaceAll('\\', '/'), '/pnpm-workspace.yaml');
	if (existsSync(workspaceYamlPath)) {
		const yamlContent = readFileSync(workspaceYamlPath, 'utf-8');
		// Simple YAML parsing for overrides section
		const overridesMatch = yamlContent.match(/overrides:\s*([\s\S]*?)(?=\n\S|$)/);
		if (overridesMatch && overridesMatch[1]) {
			const overridesSection = overridesMatch[1];
			const overrideLines = overridesSection.split('\n');
			for (const line of overrideLines) {
				const match = line.match(/^\s*['"]?([^'":\s]+)['"]?\s*:\s*([^\s#]+)/);
				if (match && match[1] && match[2]) {
					const packageName = match[1];
					const version = match[2];
					workspaceOverrides.set(packageName, version);
				}
			}
		}
	}

	const globPath = join(
		process.cwd().replaceAll('\\', '/'),
		'/**/package.json',
	);

	//console.log('Looking for package.json files in', globPath);

	const packageGlob = glob(globPath);
	const packagePaths: string[] = [];
	for await (const path of packageGlob)
		packagePaths.push(path);

	for (const path of packagePaths) {
		const json: PackageJson = JSON.parse(readFileSync(path, 'utf-8'));
		if (!json.name) {
			console.warn('Missing name in package json\n', path);
			continue;
		}

		nameToPathMap.set(json.name, path);
		nameToContentMap.set(json.name, json);
	}
};

export const getPackageDir = async (packageName: string): Promise<string | undefined> => {
	await ensurePackageLookup();

	const packagePath = nameToPathMap.get(packageName);
	if (!packagePath)
		return;

	return dirname(packagePath);
};


export const getPackageDeps = (json: PackageJson): [string, string][] => {
	const dependencies = json.dependencies;
	const devDependencies = json.devDependencies;

	const deps = Object.entries({
		...dependencies,
		...devDependencies,
	});

	return deps;
};


export const getWorkspaceDeps = (json: PackageJson): string[] => {
	return getPackageDeps(json)
		.filter(([ name, ver ]) => {
			// Check if it's explicitly a workspace dependency
			if (ver.startsWith('workspace:'))
				return true;

			// Check if it's a catalog: reference that has a workspace override
			if (ver === 'catalog:') {
				const override = workspaceOverrides.get(name);
				if (override && override.startsWith('workspace:'))
					return true;
			}

			return false;
		})
		.map(([ name ]) => name);
};


export const getPackageBuildOrder = async (
	packageName: string,
	ignoreBuiltPackages?: boolean,
): Promise<string[]> => {
	await ensurePackageLookup();

	interface Node {
		name: string;
		deps: Node[];
	};

	const rootPkg = nameToContentMap.get(packageName);
	if (!rootPkg) {
		console.warn('No package with name:', packageName);

		return [];
	}

	const rootNode: Node = { name: rootPkg.name, deps: [] };
	createNodeTree(rootNode);

	const dependencies = traverseUpwards(rootNode);

	const flat = dependencies
		.reduceRight((acc, cur) => (cur.forEach(d => acc.add(d)), acc), new Set<string>());

	if (ignoreBuiltPackages) {
		// Filter out packages that are already built
		for (const name of flat) {
			if (name === packageName)
				continue;

			const pkg = nameToContentMap.get(name);
			if (!pkg)
				continue;

			const extractExportPaths = (exp: ExportObject) => {
				const paths: string[] = [];
				for (const value of Object.values(exp)) {
					if (typeof value === 'string')
						paths.push(value);
					else if (typeof value === 'object' && value !== null)
						paths.push(...extractExportPaths(value));
				}

				return paths;
			};

			const pkgPath = await getPackageDir(name);
			if (!pkgPath) {
				console.warn('No package path found for', name);
				continue;
			}

			let pkgHasBeenBuilt = false;

			if (pkg.main && existsSync(join(pkgPath, pkg.main))) {
				pkgHasBeenBuilt = true;
			}
			else {
				const paths = Object.values(pkg.exports ?? {})
					.flatMap(exp => typeof exp === 'string' ? exp : extractExportPaths(exp));

				const anyPathExists = paths
					.some(path => path ? existsSync(join(pkgPath, path)) : false);

				if (anyPathExists)
					pkgHasBeenBuilt = true;
			}

			if (pkgHasBeenBuilt)
				flat.delete(name);
		}
	}

	return [ ...flat ];

	function createNodeTree(node: Node) {
		const visitedNames: Set<string> = new Set();
		const nodeQueue: Node[] = [ node ];
		while (nodeQueue.length) {
			const node = nodeQueue.shift()!;
			if (visitedNames.has(node.name))
				continue;

			visitedNames.add(node.name);

			const pkg = nameToContentMap.get(node.name);
			if (!pkg)
				continue;

			for (const dep of getWorkspaceDeps(pkg)) {
				const newNode: Node = {
					name: dep,
					deps: [],
				};

				node.deps.push(newNode);
				nodeQueue.push(newNode);
			}
		}
	}

	function traverseUpwards(
		node: Node,
		dependencies: string[][] = [],
		visitedNames: Set<string> = new Set(),
		depth = 0,
	) {
		if (visitedNames.has(node.name))
			return dependencies;

		visitedNames.add(node.name);

		if (node.deps.length) {
			for (const child of node.deps)
				traverseUpwards(child, dependencies, visitedNames, depth + 1);
		}

		const arr = dependencies[depth] ?? (dependencies[depth] = []);
		arr.push(node.name);

		return dependencies;
	}
};
