import * as fs from 'node:fs';
import * as path from 'node:path';

import type * as tsModule from 'typescript/lib/tsserverlibrary';


/** Asset extensions recognized out of the box (without a leading dot). */
const DEFAULT_EXTENSIONS: readonly string[] = [
	'css', 'scss', 'sass', 'less', 'styl',
	'svg', 'html', 'htm', 'md', 'txt',
	'json', 'json5', 'yaml', 'yml',
	'graphql', 'gql', 'wasm',
];

/**
 * Build a case-insensitive regex matching a specifier ending in any of
 * `extensions`. Leading dots are tolerated and regex metacharacters escaped,
 * so callers can pass `'css'`, `'.css'`, or exotic extensions safely.
 */
function buildAssetRe(extensions: readonly string[]): RegExp {
	const escaped = extensions
		.map(ext => ext.replace(/^\.+/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.filter(Boolean);

	return new RegExp(`\\.(?:${ escaped.join('|') })$`, 'i');
}


/** TS-internal compiler options not surfaced on the public `CompilerOptions` type. */
interface ResolverOptions extends tsModule.CompilerOptions {
	configFilePath?: string;
	pathsBasePath?:  string;
}

/** Length of a `paths` pattern up to its `*` wildcard (full length if none). */
function patternPrefixLength(pattern: string): number {
	const star = pattern.indexOf('*');

	return star === -1 ? pattern.length : star;
}

/**
 * Match a tsconfig `paths` pattern (at most one `*`) against a request.
 * Returns the substring captured by `*` ('' for an exact, starless match), or
 * undefined when the pattern does not match.
 */
function matchStar(pattern: string, candidate: string): string | undefined {
	const star = pattern.indexOf('*');
	if (star === -1)
		return pattern === candidate ? '' : undefined;

	const prefix = pattern.slice(0, star);
	const suffix = pattern.slice(star + 1);
	if (candidate.length < prefix.length + suffix.length)
		return undefined;

	if (!candidate.startsWith(prefix) || !candidate.endsWith(suffix))
		return undefined;

	return candidate.slice(prefix.length, candidate.length - suffix.length);
}

/**
 * Resolve a module specifier to an absolute on-disk path. Handles relative
 * specifiers, absolute paths, and non-relative aliases via tsconfig
 * `paths` / `baseUrl`. Returns undefined when nothing exists at the
 * resolved location.
 */
function resolveModuleSpecifier(
	request: string,
	fromDir: string,
	options: ResolverOptions,
): string | undefined {
	// Relative specifier — resolve directly against the importing file.
	if (request.startsWith('.')) {
		const abs = path.resolve(fromDir, request);

		return fs.existsSync(abs) ? abs : undefined;
	}

	// Absolute filesystem path.
	if (path.isAbsolute(request))
		return fs.existsSync(request) ? request : undefined;

	const configDir = options.configFilePath
		? path.dirname(options.configFilePath)
		: undefined;

	const baseUrl = options.baseUrl
		? (path.isAbsolute(options.baseUrl)
			? options.baseUrl
			: path.resolve(configDir ?? process.cwd(), options.baseUrl))
		: undefined;

	// Directory that `paths` substitutions resolve against.
	const pathsBase = baseUrl ?? options.pathsBasePath ?? configDir;

	// 1. tsconfig `paths` mappings (longest-prefix pattern wins, like tsc).
	const paths = options.paths;
	if (paths && pathsBase) {
		const entries = Object.entries(paths)
			.sort(([ a ], [ b ]) => patternPrefixLength(b) - patternPrefixLength(a));

		for (const [ pattern, subs ] of entries) {
			const matched = matchStar(pattern, request);
			if (matched === undefined)
				continue;

			for (const sub of subs) {
				const candidate = sub.includes('*') ? sub.replace('*', matched) : sub;
				const abs = path.resolve(pathsBase, candidate);
				if (fs.existsSync(abs))
					return abs;
			}
		}
	}

	// 2. Bare specifier resolved directly under `baseUrl`.
	if (baseUrl) {
		const abs = path.resolve(baseUrl, request);
		if (fs.existsSync(abs))
			return abs;
	}

	return undefined;
}


/**
 * TypeScript Language Service plugin.
 *
 * Problem: imports like
 *     import styles from './foo.cmp.css' with { type: 'css' };
 * are typed by an ambient wildcard module (`declare module '*.css'`). "Go to
 * Definition" therefore lands on that useless wildcard declaration instead of
 * the actual `.css` file on disk.
 *
 * This plugin intercepts go-to-definition. When the symbol under the cursor is
 * bound to an asset import (css/scss/svg/json/...) — relative or aliased via
 * tsconfig `paths`/`baseUrl` — it returns a definition pointing at the real
 * file instead. It also fixes hover, which
 * otherwise shows a bare `import styles` with no type, by surfacing the real
 * resolved type (e.g. `CSSStyleSheet` for css, `string` for svg).
 */
function init(mod: { typescript: typeof tsModule; }) {
	const ts = mod.typescript;

	function create(info: tsModule.server.PluginCreateInfo): tsModule.LanguageService {
		const ls = info.languageService;

		// Extra asset extensions may be supplied via the plugin config in tsconfig:
		//   "plugins": [{ "name": "...", "extensions": ["vert", "frag"] }]
		const config = info.config as { extensions?: readonly string[]; } | undefined;
		const extraExtensions = Array.isArray(config?.extensions) ? config.extensions : [];
		const assetRe = buildAssetRe([ ...DEFAULT_EXTENSIONS, ...extraExtensions ]);

		// Proxy that forwards every method to the underlying language service.
		const proxy = Object.create(null) as tsModule.LanguageService;
		for (const key of Object.keys(ls) as (keyof tsModule.LanguageService)[]) {
			const member = ls[key] as (...args: unknown[]) => unknown;
			(proxy[key] as unknown) = (...args: unknown[]) => member.apply(ls, args);
		}

		const log = (msg: string) => {
			try {
				info.project.projectService.logger.info('[ts-asset-goto] ' + msg);
			}
			catch {
				/* logger unavailable — ignore */
			}
		};

		/** Deepest node whose range contains `position`. */
		function findNode(node: tsModule.Node, position: number): tsModule.Node | undefined {
			const sf = node.getSourceFile();
			if (position < node.getStart(sf) || position >= node.getEnd())
				return undefined;

			let result: tsModule.Node = node;
			node.forEachChild((child) => {
				const inner = findNode(child, position);
				if (inner)
					result = inner;
			});

			return result;
		}

		/**
		 * Find the import declaration whose binding `node` refers to.
		 * Handles clicking inside the import statement itself, and clicking a
		 * later usage of the imported identifier.
		 */
		function findAssetImport(
			node: tsModule.Node,
			checker: tsModule.TypeChecker,
		): tsModule.ImportDeclaration | undefined {
			// 1. The node is already (inside) an import declaration.
			for (let cur: tsModule.Node | undefined = node; cur; cur = cur.parent) {
				if (ts.isImportDeclaration(cur))
					return cur;
			}

			// 2. The node references an imported binding elsewhere in the file.
			const symbol = checker.getSymbolAtLocation(node);
			for (const decl of symbol?.declarations ?? []) {
				for (let cur: tsModule.Node | undefined = decl; cur; cur = cur.parent) {
					if (ts.isImportDeclaration(cur))
						return cur;
				}
			}

			return undefined;
		}

		/**
		 * If `position` sits on a binding (or later usage) of an asset import,
		 * return the surrounding context: the source file, the node under the
		 * cursor, the import's module specifier text and the type checker.
		 */
		function locateAssetImport(fileName: string, position: number): {
			sf:      tsModule.SourceFile;
			node:    tsModule.Node;
			request: string;
			checker: tsModule.TypeChecker;
		} | undefined {
			const program = ls.getProgram();
			const sf = program?.getSourceFile(fileName);
			if (!program || !sf)
				return undefined;

			const node = findNode(sf, position);
			if (!node)
				return undefined;

			const checker = program.getTypeChecker();
			const importDecl = findAssetImport(node, checker);
			const spec = importDecl?.moduleSpecifier;
			if (!spec || !ts.isStringLiteralLike(spec))
				return undefined;

			const request = spec.text;
			if (!assetRe.test(request))
				return undefined;

			return { sf, node, request, checker };
		}

		/**
		 * If the symbol at `position` is bound to an asset import, return the
		 * absolute path of that file plus the clicked binding's text span.
		 */
		function resolveAsset(
			fileName: string,
			position: number,
		): { file: string; span: tsModule.TextSpan; } | undefined {
			const loc = locateAssetImport(fileName, position);
			if (!loc)
				return undefined;

			const options = ls.getProgram()?.getCompilerOptions();
			if (!options)
				return undefined;

			const abs = resolveModuleSpecifier(loc.request, path.dirname(fileName), options);
			if (!abs)
				return undefined;

			return {
				file: abs,
				span: { start: loc.node.getStart(loc.sf), length: loc.node.getWidth(loc.sf) },
			};
		}

		function assetDefinition(file: string): tsModule.DefinitionInfo {
			return {
				fileName:      file,
				textSpan:      { start: 0, length: 0 },
				kind:          ts.ScriptElementKind.moduleElement,
				name:          path.basename(file),
				containerName: '',
				containerKind: ts.ScriptElementKind.unknown,
			};
		}

		proxy.getDefinitionAndBoundSpan = (fileName, position) => {
			const hit = resolveAsset(fileName, position);
			if (hit) {
				log('redirect -> ' + hit.file);

				return { textSpan: hit.span, definitions: [ assetDefinition(hit.file) ] };
			}

			return ls.getDefinitionAndBoundSpan(fileName, position);
		};

		proxy.getDefinitionAtPosition = (fileName, position) => {
			const hit = resolveAsset(fileName, position);
			if (hit)
				return [ assetDefinition(hit.file) ];

			return ls.getDefinitionAtPosition(fileName, position);
		};

		proxy.getQuickInfoAtPosition = (fileName, position) => {
			const loc = locateAssetImport(fileName, position);

			// Only override hover on the binding identifier / its usages — not on the
			// import statement keyword or the module-specifier string. For now this is
			// limited to `.css` imports, where the resolved type (CSSStyleSheet) is
			// reliable; other asset kinds keep native hover.
			if (loc && ts.isIdentifier(loc.node) && /\.css$/i.test(loc.request)) {
				const type = loc.checker.getTypeAtLocation(loc.node);
				const typeStr = loc.checker.typeToString(type);

				// The upstream `declare module '*.css'` exports an anonymous default, so
				// native hover shows `import styles` with no type. Surface the real
				// resolved type instead (e.g. CSSStyleSheet for css).
				if (typeStr && typeStr !== 'any' && typeStr !== 'error') {
					const name = loc.node.getText(loc.sf);

					return {
						kind:          ts.ScriptElementKind.alias,
						kindModifiers: '',
						textSpan:      {
							start: loc.node.getStart(loc.sf),
							length: loc.node.getWidth(loc.sf)
						},
						displayParts:  [
							{ text: '(', kind: 'punctuation' },
							{ text: 'alias', kind: 'text' },
							{ text: ')', kind: 'punctuation' },
							{ text: ' ', kind: 'space' },
							{ text: 'const', kind: 'keyword' },
							{ text: ' ', kind: 'space' },
							{ text: name, kind: 'localName' },
							{ text: ':', kind: 'punctuation' },
							{ text: ' ', kind: 'space' },
							{ text: typeStr, kind: 'className' },
						],
						documentation: [],
					};
				}
			}

			return ls.getQuickInfoAtPosition(fileName, position);
		};

		return proxy;
	}

	return { create };
}

export = init;
