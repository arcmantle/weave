import { defineConfig, type Plugin, type UserConfig } from 'vite';


/**
 * Converts a bare specifier to the same file name the build-time
 * shared bundler produces. Mirrors `specifierToFileName` from
 * `@arcmantle/pivot-vite-plugin`.
 */
function specifierToFileName(specifier: string): string {
	return specifier
		.replaceAll('/', '__')
		.replaceAll('.', '_');
}


/** All shared dependencies that plugins may externalize. */
const SHARED_SPECIFIERS = [
	'lit',
	'lit/decorators.js',
	'lit/directives/when.js',
	'lit/directives/map.js',
	'lit/directives/repeat.js',
	'lit/directives/class-map.js',
	'lit/directives/style-map.js',
	'lit/directives/if-defined.js',
	'lit/directives/guard.js',
	'lit/directives/cache.js',
	'lit/directives/live.js',
	'lit/directives/ref.js',
	'lit/directives/unsafe-html.js',
	'lit/static-html.js',
	'@lit/context',
	'@arcmantle/injector',
	'@arcmantle/pivot-client-router',
	'@arcmantle/pivot-client-plugin',
	'tslib',
] as const;

/**
 * Build a lookup from bundle filename → bare specifier.
 * E.g. `lit__decorators_js.js` → `lit/decorators.js`
 */
const FILE_TO_SPECIFIER: Map<string, string> = new Map(
	SHARED_SPECIFIERS.map(s => [ `${ specifierToFileName(s) }.js`, s ]),
);


/**
 * Vite plugin that serves shared dependencies at `/shared/` during dev.
 *
 * In production, plugins ship pre-built esbuild bundles in their `shared/`
 * directory and the backend serves the winning version at `/shared/`.
 *
 * In development, this plugin intercepts `/shared/{file}` requests,
 * reverse-maps the bundle filename back to the bare specifier, and creates
 * a virtual re-export module. Vite resolves that bare specifier to its
 * pre-bundled optimized dep — ensuring both the app shell and plugins
 * share the same module instance with full HMR support.
 */
function pivotSharedDeps(): Plugin {
	const PREFIX = '\0pivot-shared:';

	return {
		name:    'pivot-shared-deps',
		enforce: 'pre',

		resolveId(id: string): string | undefined {
			if (id.startsWith(PREFIX))
				return id;

			return undefined;
		},

		load(id: string): string | undefined {
			if (!id.startsWith(PREFIX))
				return undefined;

			// Use the bare specifier so Vite resolves it to the same pre-bundled
			// optimized dep that the app shell uses. This avoids loading a second
			// copy of the module from the raw source files.
			const specifier = id.slice(PREFIX.length);

			return `export * from '${ specifier }';`;
		},

		configureServer(server) {
			// Intercept `/shared/*` requests before Vite internals & proxies.
			// The URL path matches production-style bundle filenames
			// (e.g. `/shared/lit.js`, `/shared/lit__decorators_js.js`).
			// We reverse-map them to bare specifiers for Vite resolution.
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith('/shared/'))
					return next();

				// Strip the /shared/ prefix and any query string
				let fileName = req.url.slice('/shared/'.length);
				const queryIdx = fileName.indexOf('?');
				if (queryIdx >= 0)
					fileName = fileName.slice(0, queryIdx);

				// Reverse-map bundle filename to bare specifier
				const specifier = FILE_TO_SPECIFIER.get(fileName);
				if (!specifier) {
					// Could be a shared chunk from esbuild code splitting —
					// let the proxy/static serving handle it.
					return next();
				}

				try {
					const result = await server.transformRequest(`${ PREFIX }${ specifier }`);
					if (result) {
						res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
						res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
						res.statusCode = 200;
						res.end(result.code);

						return;
					}
				}
				catch (err) {
					server.config.logger.error(
						`[pivot] Failed to serve shared dep "${ specifier }": ${ err }`,
					);
				}

				return next();
			});
		},
	};
}


export default defineConfig({
	plugins: [ pivotSharedDeps() ],
	esbuild: {
		supported: {
			'top-level-await': true,
		},
	},
	build: {
		target: 'es2022',
		outDir: 'dist',
	},
	optimizeDeps: {
		include: [
			'lit',
			'lit/decorators.js',
			'lit/directives/when.js',
			'lit/directives/map.js',
			'lit/static-html.js',
			'@lit/context',
			'@arcmantle/injector',
		],
	},
	server: {
		port:  3200,
		proxy: {
			'/api': {
				target:       'http://localhost:5200',
				changeOrigin: true,
			},
			'/plugins': {
				target:       'http://localhost:5200',
				changeOrigin: true,
			},
		},
	},
}) as UserConfig;
