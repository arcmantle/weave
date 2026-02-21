import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer, type InlineConfig } from 'vite';

import { pivotDevPlugins } from './dev-plugins.js';
import { pivotSharedDeps } from './shared-deps.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


export interface PivotDevServerOptions {
	/** Absolute path to the directory containing plugin subdirectories. */
	pluginsDir: string;

	/** Port for the Vite dev server. @default 3200 */
	port?: number;

	/** Backend origin to proxy API requests to. @default 'http://localhost:5200' */
	backendUrl?: string;

	/** Additional Vite config overrides. */
	viteConfig?: InlineConfig;
}


/**
 * Resolves the path to the app shell source directory.
 * The `app-shell/` directory ships alongside `dist/` in this package.
 */
function resolveAppShellRoot(): string {
	const root = path.resolve(__dirname, '..', 'app-shell');
	if (!fs.existsSync(path.join(root, 'index.html'))) {
		throw new Error(
			'[pivot-dev] Could not locate the Pivot app shell. ' +
			'Ensure @arcmantle/pivot-dev-server is installed correctly.',
		);
	}

	return root;
}


/**
 * Creates and starts a Pivot development server.
 *
 * This wraps Vite's `createServer` with the correct configuration to:
 * - Serve the app shell from the bundled `app-shell/` directory
 * - Serve plugin source code with full HMR via `pivotDevPlugins`
 * - Serve shared dependencies through Vite's dep optimizer via `pivotSharedDeps`
 * - Proxy API and plugin asset requests to the .NET backend
 */
export async function createPivotDevServer(options: PivotDevServerOptions): Promise<import('vite').ViteDevServer> {
	const {
		pluginsDir,
		port       = 3200,
		backendUrl = 'http://localhost:5200',
		viteConfig = {},
	} = options;

	const appShellRoot = resolveAppShellRoot();

	const serverConfig: InlineConfig = {
		...viteConfig,
		configFile: false,
		root:       appShellRoot,
		plugins:    [
			pivotDevPlugins(pluginsDir),
			pivotSharedDeps(),
			...(viteConfig.plugins ?? []),
		],
		esbuild: {
			supported: {
				'top-level-await': true,
			},
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
			port,
			fs: {
				allow: [ appShellRoot ],
			},
			proxy: {
				'/api': {
					target:       backendUrl,
					changeOrigin: true,
				},
				'/plugins': {
					target:       backendUrl,
					changeOrigin: true,
				},
			},
		},
	};

	const server = await createServer(serverConfig);
	await server.listen();

	server.printUrls();

	return server;
}
