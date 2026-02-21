/**
 * Shared pnpmfile that auto-discovers workspace dependencies and merges
 * catalogs from the workspaces they originate from.
 *
 * Lives at the monorepo root and is referenced by each workspace via
 * their `pnpm-workspace.yaml`:  pnpmfile=../.pnpmfile.cjs
 *
 * Uses the `updateConfig` hook to modify `config.packages` and
 * `config.catalogs` at runtime — no file modification needed.
 *
 * When a workspace package has `workspace:` protocol dependencies that
 * aren't in this workspace, the pnpmfile scans the monorepo to find
 * them and adds them to the config. It also merges the catalog from
 * the workspace each external package belongs to.
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

// ---------------------------------------------------------------------------
// YAML parsing (zero-dependency)
// ---------------------------------------------------------------------------
/**
 * Parses the `catalog:` section out of a pnpm-workspace.yaml string.
 * @param {string} content - Raw YAML file content.
 * @returns {Record<string, string>}
 */
function parseYamlCatalog(content) {
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

// ---------------------------------------------------------------------------
// Catalog loading
// ---------------------------------------------------------------------------
/**
 * Loads the default catalog from a workspace directory.
 * @param {string} wsDir
 * @returns {Record<string, string>}
 */
function loadCatalog(wsDir) {
	const yamlPath = path.join(wsDir, 'pnpm-workspace.yaml');
	if (!fs.existsSync(yamlPath))
		return {};

	return parseYamlCatalog(fs.readFileSync(yamlPath, 'utf8'));
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
				if (wsRoot && path.resolve(wsRoot) !== path.resolve(workspaceDir))
					involvedWorkspaces.add(wsRoot);

				changed = true;
			}
		}
	}

	/* Track workspace roots for already-existing external packages too. */
	for (const [ , pkgDir ] of currentPackages) {
		if (path.relative(workspaceDir, pkgDir).startsWith('..')) {
			const wsRoot = findWorkspaceRoot(pkgDir);
			if (wsRoot && path.resolve(wsRoot) !== path.resolve(workspaceDir))
				involvedWorkspaces.add(wsRoot);
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
 *   2. Merge external catalogs into `catalogs.default`
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

	/* 2. Merge external catalogs. */
	const allWorkspaces = [ ...involvedWorkspaces ];
	for (const rel of EXTRA_CATALOG_WORKSPACES) {
		const abs = path.resolve(workspaceDir, rel);
		if (!allWorkspaces.some(ws => path.resolve(ws) === abs))
			allWorkspaces.push(abs);
	}

	if (allWorkspaces.length > 0) {
		const localCatalog = { ...(config.catalogs?.default ?? config.catalog ?? {}) };

		/* Merge external catalogs; first workspace wins conflicts. */
		const externalCatalog = {};
		for (const wsRoot of allWorkspaces) {
			const catalog = loadCatalog(wsRoot);
			for (const [ key, value ] of Object.entries(catalog)) {
				if (!(key in externalCatalog))
					externalCatalog[key] = value;
			}
		}

		/* Local entries override external ones. */
		const merged = { ...externalCatalog, ...localCatalog };

		config.catalogs = { ...(config.catalogs ?? {}), default: merged };
		config.catalog = merged;
	}

	return config;
}

// ---------------------------------------------------------------------------
// readPackage hook
// ---------------------------------------------------------------------------
/**
 * Resolves `catalog:` and `catalog:default` specifiers using the
 * merged catalog. This is needed because pnpm resolves catalog:
 * specifiers from its own parsed catalogs config, and for entries
 * coming from external workspaces the readPackage hook provides
 * a safety net.
 */
function resolveCatalogDeps(deps, catalog) {
	if (!deps)
		return deps;

	const resolved = { ...deps };

	for (const [ name, specifier ] of Object.entries(resolved)) {
		if (typeof specifier !== 'string' || !specifier.startsWith('catalog:'))
			continue;

		const catalogName = specifier.slice('catalog:'.length);

		if (catalogName !== '' && catalogName !== 'default')
			continue;

		if (name in catalog)
			resolved[name] = catalog[name];
	}

	return resolved;
}

/** Cached merged catalog for readPackage. */
let cachedCatalog;

function readPackage(pkg, _context) {
	if (!cachedCatalog) {
		/* Build catalog from disk as fallback. */
		const localCatalog = loadCatalog(workspaceDir);
		const externalCatalog = {};

		/* Re-discover involved workspaces. */
		const patterns = parseYamlPackagesFromDisk();
		const { involvedWorkspaces } = discoverMissingPackages(patterns);

		for (const wsRoot of involvedWorkspaces) {
			const catalog = loadCatalog(wsRoot);
			for (const [ key, value ] of Object.entries(catalog)) {
				if (!(key in externalCatalog))
					externalCatalog[key] = value;
			}
		}

		for (const rel of EXTRA_CATALOG_WORKSPACES) {
			const catalog = loadCatalog(path.resolve(workspaceDir, rel));
			for (const [ key, value ] of Object.entries(catalog)) {
				if (!(key in externalCatalog))
					externalCatalog[key] = value;
			}
		}

		cachedCatalog = { ...externalCatalog, ...localCatalog };
	}

	pkg.dependencies         = resolveCatalogDeps(pkg.dependencies, cachedCatalog);
	pkg.devDependencies      = resolveCatalogDeps(pkg.devDependencies, cachedCatalog);
	pkg.peerDependencies     = resolveCatalogDeps(pkg.peerDependencies, cachedCatalog);
	pkg.optionalDependencies = resolveCatalogDeps(pkg.optionalDependencies, cachedCatalog);

	return pkg;
}

/**
 * Parses the packages list from the on-disk yaml as fallback
 * for readPackage (which runs after updateConfig).
 */
function parseYamlPackagesFromDisk() {
	const yamlPath = path.join(workspaceDir, 'pnpm-workspace.yaml');
	if (!fs.existsSync(yamlPath))
		return [];

	const content = fs.readFileSync(yamlPath, 'utf8');
	const packages = [];
	const lines = content.split('\n');
	let inPackages = false;
	let baseIndent = -1;

	for (const line of lines) {
		if (/^packages\s*:\s*$/.test(line)) {
			inPackages = true;
			baseIndent = -1;
			continue;
		}

		if (!inPackages)
			continue;

		const trimmed = line.trim();

		if (trimmed === '' || trimmed.startsWith('#'))
			continue;

		const indent = line.match(/^(\s*)/)[1].length;
		if (baseIndent === -1)
			baseIndent = indent;
		if (indent < baseIndent) {
			inPackages = false;
			continue;
		}

		const match = trimmed.match(/^-\s+(?:"([^"]+)"|'([^']+)'|(.+))$/);
		if (match)
			packages.push((match[1] ?? match[2] ?? match[3]).trim());
	}

	return packages;
}

module.exports = {
	hooks: {
		updateConfig,
		readPackage,
	},
};
