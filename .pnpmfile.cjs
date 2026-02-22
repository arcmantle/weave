/**
 * Shared pnpmfile that auto-discovers workspace dependencies and injects
 * named catalogs from the workspaces they originate from.
 *
 * Lives at the monorepo root and is referenced by each workspace via
 * their `pnpm-workspace.yaml`:  pnpmfile: ../.pnpmfile.cjs
 *
 * Uses the `updateConfig` hook to modify `config.packages` and
 * `config.catalogs` at runtime — no file modification needed.
 *
 * When a workspace package has `workspace:` protocol dependencies that
 * aren't in this workspace, the pnpmfile scans the monorepo to find
 * them and adds them to the config. Each external workspace's default
 * catalog is injected as a named catalog using the workspace directory
 * name (e.g. `core`, `tooling`), and `readPackage` rewrites external
 * packages' `catalog:` specifiers to `catalog:<silo>`.
 */
const fs   = require('fs');
const path = require('path');

/** The monorepo root — the directory this file lives in. */
const MONOREPO_ROOT = __dirname;

/**
 * The directory of the workspace currently being installed.
 * Set by `updateConfig` from `config.workspaceDir`.
 * @type {string | null}
 */
let workspaceDir = null;

/**
 * Additional workspace roots whose catalogs should always be merged,
 * even if no packages from them are pulled in.
 * Paths relative to the workspace root.
 */
const EXTRA_CATALOG_WORKSPACES = [];

/**
 * Maps package name → silo name for cross-workspace packages.
 * Populated by `discoverMissingPackages`, used by `readPackage`.
 * @type {Map<string, string>}
 */
const packageSiloMap = new Map();

/**
 * All named catalogs keyed by silo name.
 * Populated by `updateConfig`, used by `readPackage`.
 * @type {Record<string, Record<string, string>>}
 */
let allCatalogs = {};

// ---------------------------------------------------------------------------
// YAML parsing (zero-dependency)
// ---------------------------------------------------------------------------
/**
 * Parses the `catalog:` (default) section out of a pnpm-workspace.yaml string.
 * @param {string} content - Raw YAML file content.
 * @returns {Record<string, string>}
 */
function parseYamlDefaultCatalog(content) {
	const catalog = {};
	const lines = content.split('\n');
	let inCatalog = false;
	let baseIndent = -1;

	for (const line of lines) {
		if (/^catalog\s*:\s*$/.test(line)) {
			inCatalog = true;
			baseIndent = -1;
			continue;
		}

		if (!inCatalog)
			continue;

		const trimmed = line.trim();

		if (trimmed === '' || trimmed.startsWith('#'))
			continue;

		const indent = line.match(/^(\s*)/)[1].length;
		if (baseIndent === -1)
			baseIndent = indent;
		if (indent < baseIndent) {
			inCatalog = false;
			continue;
		}

		const match = trimmed.match(
			/^(?:'([^']+)'|"([^"]+)"|([^:]+?))\s*:\s*(.+)$/,
		);
		if (match) {
			const key   = (match[1] ?? match[2] ?? match[3]).trim();
			const value = match[4].trim().replace(/^['"]|['"]$/g, '');
			catalog[key] = value;
		}
	}

	return catalog;
}

/**
 * Parses the `catalogs:` section (named catalogs) from a pnpm-workspace.yaml.
 * Falls back to `catalog:` (default) if no `catalogs:` section exists.
 * @param {string} content - Raw YAML file content.
 * @returns {Record<string, Record<string, string>>}
 */
function parseYamlCatalogs(content) {
	const catalogs = {};
	const lines = content.split('\n');
	let inCatalogs = false;
	let currentName = null;
	let nameIndent = -1;
	let entryIndent = -1;

	for (const line of lines) {
		if (/^catalogs\s*:\s*$/.test(line)) {
			inCatalogs = true;
			currentName = null;
			nameIndent = -1;
			entryIndent = -1;
			continue;
		}

		if (!inCatalogs)
			continue;

		const trimmed = line.trim();

		if (trimmed === '' || trimmed.startsWith('#'))
			continue;

		const indent = line.match(/^(\s*)/)[1].length;

		/* Left the catalogs section entirely. */
		if (indent === 0) {
			inCatalogs = false;
			continue;
		}

		/* Catalog name line (e.g. `  core:`). */
		const nameMatch = trimmed.match(/^([a-zA-Z0-9_][a-zA-Z0-9_-]*)\s*:\s*$/);
		if (nameMatch && (nameIndent === -1 || indent <= nameIndent)) {
			currentName = nameMatch[1];
			nameIndent = indent;
			entryIndent = -1;
			catalogs[currentName] = {};
			continue;
		}

		/* Entry line inside a named catalog. */
		if (currentName && indent > nameIndent) {
			if (entryIndent === -1)
				entryIndent = indent;
			if (indent < entryIndent) {
				currentName = null;
				continue;
			}

			const match = trimmed.match(
				/^(?:'([^']+)'|"([^"]+)"|([^:]+?))\s*:\s*(.+)$/,
			);
			if (match) {
				const key   = (match[1] ?? match[2] ?? match[3]).trim();
				const value = match[4].trim().replace(/^['"]|['"]$/g, '');
				catalogs[currentName][key] = value;
			}
		}
	}

	/* Fallback: if no `catalogs:` section, try `catalog:` (default). */
	if (Object.keys(catalogs).length === 0) {
		const defaultCatalog = parseYamlDefaultCatalog(content);
		if (Object.keys(defaultCatalog).length > 0)
			catalogs['default'] = defaultCatalog;
	}

	return catalogs;
}

// ---------------------------------------------------------------------------
// File system scanning
// ---------------------------------------------------------------------------
/**
 * Recursively scans a directory for package.json files,
 * building a map of package name → absolute directory path.
 * @param {string} dir
 * @param {Map<string, string>} pkgMap
 * @param {number} maxDepth
 * @param {number} depth
 */
function scanDirectory(dir, pkgMap, maxDepth = 10, depth = 0) {
	if (depth > maxDepth)
		return;

	let entries;
	try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
	catch { return; }

	for (const entry of entries) {
		if (!entry.isDirectory())
			continue;
		if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'out')
			continue;

		const subdir = path.join(dir, entry.name);
		const pkgJsonPath = path.join(subdir, 'package.json');

		if (fs.existsSync(pkgJsonPath)) {
			try {
				const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
				if (pkg.name && !pkgMap.has(pkg.name))
					pkgMap.set(pkg.name, subdir);
			}
			catch { /* skip malformed package.json */ }
		}

		scanDirectory(subdir, pkgMap, maxDepth, depth + 1);
	}
}

/** Scans the entire monorepo for all packages. */
function buildMonorepoPackageMap() {
	const pkgMap = new Map();
	scanDirectory(MONOREPO_ROOT, pkgMap);

	return pkgMap;
}

// ---------------------------------------------------------------------------
// Workspace package resolution
// ---------------------------------------------------------------------------
/**
 * Resolves a single package pattern to directories containing package.json.
 * @param {string} pattern
 * @param {string} baseDir
 * @returns {string[]} Absolute directory paths.
 */
function resolvePackagePattern(pattern, baseDir) {
	const dirs = [];

	if (pattern.startsWith('!'))
		return dirs;

	if (!pattern.includes('*')) {
		const resolved = path.resolve(baseDir, pattern);
		if (fs.existsSync(path.join(resolved, 'package.json')))
			dirs.push(resolved);

		return dirs;
	}

	if (pattern === '*') {
		try {
			for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
				if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.'))
					continue;

				const subdir = path.join(baseDir, entry.name);
				if (fs.existsSync(path.join(subdir, 'package.json')))
					dirs.push(subdir);
			}
		}
		catch { /* ignore */ }

		return dirs;
	}

	/* "**" or glob with static prefix — recurse. */
	const recurse = (dir) => {
		try {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.'))
					continue;

				const subdir = path.join(dir, entry.name);
				if (fs.existsSync(path.join(subdir, 'package.json')))
					dirs.push(subdir);

				recurse(subdir);
			}
		}
		catch { /* ignore */ }
	};

	if (pattern === '**') {
		recurse(baseDir);
	}
	else {
		const parts = pattern.split('/');
		let staticPrefix = '';
		for (const part of parts) {
			if (part.includes('*') || part.includes('?') || part.includes('['))
				break;

			staticPrefix = staticPrefix ? staticPrefix + '/' + part : part;
		}

		if (staticPrefix) {
			const prefixDir = path.resolve(baseDir, staticPrefix);
			if (fs.existsSync(prefixDir))
				recurse(prefixDir);
		}
	}

	return dirs;
}

/**
 * Resolves workspace package patterns into a Map of name → directory.
 * @param {string[]} patterns
 * @returns {Map<string, string>}
 */
function resolveWorkspacePackages(patterns) {
	const pkgNameToDir = new Map();

	for (const pattern of patterns) {
		for (const dir of resolvePackagePattern(pattern, workspaceDir)) {
			try {
				const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
				if (pkg.name)
					pkgNameToDir.set(pkg.name, dir);
			}
			catch { /* skip */ }
		}
	}

	return pkgNameToDir;
}

/**
 * Extracts all workspace: protocol dependency names from a package.json.
 * @param {Record<string, any>} pkgJson
 * @returns {string[]}
 */
function getWorkspaceDeps(pkgJson) {
	const deps = [];
	const fields = [ 'dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies' ];
	for (const field of fields) {
		if (!pkgJson[field])
			continue;

		for (const [ name, spec ] of Object.entries(pkgJson[field])) {
			if (typeof spec === 'string' && spec.startsWith('workspace:'))
				deps.push(name);
		}
	}

	return deps;
}

// ---------------------------------------------------------------------------
// Workspace root detection
// ---------------------------------------------------------------------------
/**
 * Walks up from a package dir to find the nearest pnpm-workspace.yaml.
 * Stops at MONOREPO_ROOT.
 * @param {string} pkgDir
 * @returns {string | null}
 */
function findWorkspaceRoot(pkgDir) {
	let dir = pkgDir;

	while (true) {
		if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')))
			return dir;

		const parent = path.dirname(dir);
		if (parent === dir || parent.length < MONOREPO_ROOT.length)
			break;

		dir = parent;
	}

	return null;
}

/**
 * Derives the silo name from a workspace root path.
 * Uses the directory name relative to the monorepo root.
 * @param {string} wsRoot
 * @returns {string}
 */
function getWorkspaceSiloName(wsRoot) {
	return path.relative(MONOREPO_ROOT, wsRoot).split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Catalog loading
// ---------------------------------------------------------------------------
/**
 * Loads all named catalogs from a workspace directory.
 * Reads `catalogs:` (named) first, falls back to `catalog:` (default).
 * @param {string} wsDir
 * @returns {Record<string, Record<string, string>>}
 */
function loadCatalogs(wsDir) {
	const yamlPath = path.join(wsDir, 'pnpm-workspace.yaml');
	if (!fs.existsSync(yamlPath))
		return {};

	return parseYamlCatalogs(fs.readFileSync(yamlPath, 'utf8'));
}

// ---------------------------------------------------------------------------
// Auto-discovery
// ---------------------------------------------------------------------------
/**
 * Discovers workspace: dependencies not present in the workspace,
 * finds them in the monorepo, and returns the new package patterns
 * and the set of external workspace roots involved.
 * @param {string[]} currentPatterns
 */
function discoverMissingPackages(currentPatterns) {
	const monorepoMap = buildMonorepoPackageMap();
	const currentPackages = resolveWorkspacePackages(currentPatterns);
	const involvedWorkspaces = new Set();
	const addedPatterns = [];
	const checked = new Set();
	let changed = true;

	/* Seed with the root project manifest so its workspace: deps are found. */
	const rootPkgJsonPath = path.join(workspaceDir, 'package.json');
	if (fs.existsSync(rootPkgJsonPath)) {
		try {
			const rootPkg = JSON.parse(fs.readFileSync(rootPkgJsonPath, 'utf8'));
			if (rootPkg.name)
				currentPackages.set(rootPkg.name, workspaceDir);
		}
		catch { /* skip */ }
	}

	while (changed) {
		changed = false;

		for (const [ pkgName, pkgDir ] of currentPackages) {
			if (checked.has(pkgName))
				continue;

			checked.add(pkgName);

			let pkgJson;
			try { pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')); }
			catch { continue; }

			for (const depName of getWorkspaceDeps(pkgJson)) {
				if (currentPackages.has(depName))
					continue;

				const depDir = monorepoMap.get(depName);
				if (!depDir)
					continue;

				currentPackages.set(depName, depDir);

				const relPath = path.relative(workspaceDir, depDir).split(path.sep).join('/');
				addedPatterns.push(relPath);

				const wsRoot = findWorkspaceRoot(depDir);
				if (wsRoot && path.resolve(wsRoot) !== path.resolve(workspaceDir)) {
					involvedWorkspaces.add(wsRoot);
					packageSiloMap.set(depName, getWorkspaceSiloName(wsRoot));
				}

				changed = true;
			}
		}
	}

	/* Track workspace roots for already-existing external packages too. */
	for (const [ pkgName, pkgDir ] of currentPackages) {
		if (path.relative(workspaceDir, pkgDir).startsWith('..')) {
			const wsRoot = findWorkspaceRoot(pkgDir);
			if (wsRoot && path.resolve(wsRoot) !== path.resolve(workspaceDir)) {
				involvedWorkspaces.add(wsRoot);
				if (!packageSiloMap.has(pkgName))
					packageSiloMap.set(pkgName, getWorkspaceSiloName(wsRoot));
			}
		}
	}

	return { addedPatterns, involvedWorkspaces: [ ...involvedWorkspaces ] };
}

// ---------------------------------------------------------------------------
// updateConfig hook
// ---------------------------------------------------------------------------
/**
 * Modifies pnpm's runtime config to:
 *   1. Add auto-discovered workspace packages to `packages`
 *   2. Inject external workspace catalogs as named catalogs
 */
function updateConfig(config) {
	workspaceDir = config.workspaceDir;

	const currentPatterns = [ ...(config.packages ?? config.workspacePackagePatterns ?? []) ];
	const { addedPatterns, involvedWorkspaces } = discoverMissingPackages(currentPatterns);

	/* 1. Add discovered packages. */
	if (addedPatterns.length > 0) {
		config.packages = [ ...currentPatterns, ...addedPatterns ];
		config.workspacePackagePatterns = config.packages;

		console.log('\n\x1b[36m[pnpmfile]\x1b[0m Auto-discovered workspace packages:');
		for (const entry of addedPatterns)
			console.log(`  \x1b[32m+\x1b[0m ${ entry }`);

		console.log('');
	}

	/* 2. Inject external catalogs as named catalogs. */
	const externalWorkspaces = [ ...involvedWorkspaces ];
	for (const rel of EXTRA_CATALOG_WORKSPACES) {
		const abs = path.resolve(workspaceDir, rel);
		if (!externalWorkspaces.some(ws => path.resolve(ws) === abs))
			externalWorkspaces.push(abs);
	}

	if (externalWorkspaces.length > 0) {
		const catalogs = { ...(config.catalogs ?? {}) };
		const injectedSilos = [];

		for (const wsRoot of externalWorkspaces) {
			const wsCatalogs = loadCatalogs(wsRoot);

			for (const [ catalogName, entries ] of Object.entries(wsCatalogs)) {
				if (Object.keys(entries).length === 0)
					continue;

				catalogs[catalogName] = { ...(catalogs[catalogName] ?? {}), ...entries };
				allCatalogs[catalogName] = catalogs[catalogName];
				injectedSilos.push(catalogName);
			}
		}

		config.catalogs = catalogs;

		if (injectedSilos.length > 0) {
			console.log('\x1b[36m[pnpmfile]\x1b[0m Injected named catalogs:');
			for (const silo of injectedSilos)
				console.log(`  \x1b[33m⬡\x1b[0m catalog:${ silo }`);

			console.log('');
		}
	}

	/* Store all catalogs for readPackage safety net. */
	for (const [ name, entries ] of Object.entries(config.catalogs ?? {}))
		allCatalogs[name] = { ...(allCatalogs[name] ?? {}), ...entries };

	return config;
}

// ---------------------------------------------------------------------------
// readPackage hook
// ---------------------------------------------------------------------------
/**
 * Rewrites `catalog:` and `catalog:default` specifiers to use a
 * named catalog for the package's originating workspace silo.
 * @param {Record<string, string> | undefined} deps
 * @param {string} siloName
 */
function rewriteCatalogSpecifiers(deps, siloName) {
	if (!deps)
		return;

	for (const [ name, specifier ] of Object.entries(deps)) {
		if (typeof specifier !== 'string' || !specifier.startsWith('catalog:'))
			continue;

		const catalogName = specifier.slice('catalog:'.length);

		if (catalogName === '' || catalogName === 'default')
			deps[name] = `catalog:${ siloName }`;
	}
}

/**
 * Safety-net resolver for any remaining `catalog:*` specifiers
 * that pnpm's built-in resolution didn't handle.
 * Looks up the named catalog from `allCatalogs`.
 * @param {Record<string, string> | undefined} deps
 * @returns {Record<string, string> | undefined}
 */
function resolveCatalogDeps(deps) {
	if (!deps)
		return deps;

	const resolved = { ...deps };

	for (const [ name, specifier ] of Object.entries(resolved)) {
		if (typeof specifier !== 'string' || !specifier.startsWith('catalog:'))
			continue;

		const catalogName = specifier.slice('catalog:'.length) || 'default';
		const catalog = allCatalogs[catalogName];

		if (catalog && name in catalog) {
			resolved[name] = catalog[name];
			continue;
		}

		/* Fallback: search all catalogs when the named one has no entry. */
		for (const entries of Object.values(allCatalogs)) {
			if (name in entries) {
				resolved[name] = entries[name];
				break;
			}
		}
	}

	return resolved;
}

function readPackage(pkg, _context) {
	/* Rewrite catalog: specifiers for cross-workspace packages,
	 * but only when the silo actually has a catalog registered. */
	const siloName = packageSiloMap.get(pkg.name);
	if (siloName && allCatalogs[siloName]) {
		rewriteCatalogSpecifiers(pkg.dependencies, siloName);
		rewriteCatalogSpecifiers(pkg.devDependencies, siloName);
		rewriteCatalogSpecifiers(pkg.peerDependencies, siloName);
		rewriteCatalogSpecifiers(pkg.optionalDependencies, siloName);
	}

	/* Safety net: resolve any remaining catalog: specifiers. */
	pkg.dependencies         = resolveCatalogDeps(pkg.dependencies);
	pkg.devDependencies      = resolveCatalogDeps(pkg.devDependencies);
	pkg.peerDependencies     = resolveCatalogDeps(pkg.peerDependencies);
	pkg.optionalDependencies = resolveCatalogDeps(pkg.optionalDependencies);

	return pkg;
}

module.exports = {
	hooks: {
		updateConfig,
		readPackage,
	},
};
