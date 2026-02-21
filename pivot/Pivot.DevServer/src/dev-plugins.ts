import fs from 'node:fs';
import path from 'node:path';

import type { Plugin, ViteDevServer } from 'vite';


export interface DevPluginEntry {
	name:      string;
	clientDir: string;
}


/**
 * Discovers plugin client directories under the given base directory.
 * A directory qualifies if it has a `client/package.json`.
 */
export function discoverDevPlugins(pluginsDir: string): DevPluginEntry[] {
	if (!fs.existsSync(pluginsDir))
		return [];

	const entries: DevPluginEntry[] = [];

	for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
		if (!entry.isDirectory())
			continue;

		const clientDir = path.join(pluginsDir, entry.name, 'client');
		if (fs.existsSync(path.join(clientDir, 'package.json')))
			entries.push({ name: entry.name, clientDir });
	}

	return entries;
}


/**
 * Vite plugin that intercepts requests for plugin client assets and
 * serves the TypeScript source files through Vite's transform pipeline
 * instead of letting them fall through to the backend proxy.
 *
 * This enables full HMR support during development — editing a plugin's
 * source triggers an automatic page update without rebuilding.
 *
 * The backend still serves the client manifests so that routes and
 * metadata are discovered normally; only the module code is intercepted.
 */
export function pivotDevPlugins(pluginsDir: string): Plugin {
	const absDir  = path.resolve(pluginsDir);
	const plugins = discoverDevPlugins(absDir);
	const pluginMap = new Map(plugins.map(p => [ p.name, p ]));

	if (plugins.length) {
		const names = plugins.map(p => p.name).join(', ');
		console.log(`[pivot-dev] Serving ${ plugins.length } plugin(s) from source: ${ names }`);
	}

	return {
		name:    'pivot-dev-plugins',
		apply:   'serve',
		enforce: 'pre',

		config() {
			return {
				server: {
					fs: {
						allow: plugins.map(p => p.clientDir),
					},
				},
			};
		},

		/**
		 * Map plugin asset URLs to their TypeScript source files.
		 *
		 * When the browser requests `/plugins/WeatherPlugin/client/index.js`,
		 * this hook resolves it to the absolute path of `src/index.ts` inside
		 * the plugin's client directory. Vite then loads, transforms, and
		 * watches that file for HMR.
		 */
		resolveId(id: string): string | undefined {
			const match = id.match(/^\/plugins\/([^/]+)\/client\/(.+?)(?:\?.*)?$/);
			if (!match)
				return undefined;

			const devPlugin = pluginMap.get(match[1]!);
			if (!devPlugin)
				return undefined;

			let file = match[2]!;
			if (file.endsWith('.js'))
				file = 'src/' + file.replace(/\.js$/, '.ts');

			return path.resolve(devPlugin.clientDir, file);
		},

		/**
		 * Intercept `/plugins/{name}/client/**` requests for discovered dev
		 * plugins before the proxy forwards them to the backend.
		 *
		 * The request is piped through `server.transformRequest()` so Vite
		 * adds the module to its graph, resolves imports, and tracks the
		 * file for HMR updates.
		 */
		configureServer(server: ViteDevServer) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith('/plugins/'))
					return next();

				const match = req.url.match(/^\/plugins\/([^/]+)\/client\//);
				if (!match)
					return next();

				const devPlugin = pluginMap.get(match[1]!);
				if (!devPlugin)
					return next();

				try {
					const url = req.url.split('?')[0]!;
					const result = await server.transformRequest(url);

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
						`[pivot-dev] Failed to transform plugin "${ match[1] }": ${ err }`,
					);
				}

				return next();
			});
		},
	};
}
