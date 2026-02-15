import type { Connect, Plugin } from 'vite';


export interface LoginRewriteOptions {
	/** The URL path that should serve the login page. @default '/login' */
	path?: string;
}

/**
 * Vite dev-server plugin that rewrites requests for the login path to
 * the MPA entry point (`login/index.html`).
 *
 * Without this, Vite's built-in SPA fallback would serve the main
 * `index.html` for `/login`, which is incorrect in a multi-page setup.
 *
 * @example
 * ```ts
 * import { loginRewritePlugin } from '@arcmantle/pivot-client-auth/vite';
 *
 * export default defineConfig({
 *   plugins: [loginRewritePlugin()],
 * });
 * ```
 */
export function loginRewritePlugin(options?: LoginRewriteOptions): Plugin {
	const loginPath = options?.path ?? '/login';

	return {
		name: 'pivot-login-rewrite',
		configureServer(server) {
			const handler: Connect.NextHandleFunction = (req, _res, next) => {
				if (req.url === loginPath || req.url?.startsWith(loginPath + '?'))
					req.url = loginPath + '/index.html';

				next();
			};

			server.middlewares.use(handler);
		},
	};
}
