import { extname, join, normalize } from 'node:path';

const ROOT = normalize(join(process.cwd(), '..', 'internal', 'docs', 'dist'));
const PORT = 4173;

const MIME_TYPES: Record<string, string> = {
	'.css':  'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.js':   'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map':  'application/json; charset=utf-8',
	'.svg':  'image/svg+xml',
};

function resolveFile(urlPath: string): string | null {
	const pathname = decodeURIComponent(urlPath || '/');
	const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
	const filePath = normalize(join(ROOT, relativePath));
	if (!filePath.startsWith(ROOT))
		return null;

	return filePath;
}

const server = Bun.serve({
	port:     PORT,
	hostname: '127.0.0.1',
	async fetch(request: Request): Promise<Response> {
		const method = request.method || 'GET';
		if (method !== 'GET' && method !== 'HEAD')
			return new Response('Method Not Allowed', { status: 405 });

		const url = new URL(request.url);
		const path = resolveFile(url.pathname);
		if (!path)
			return new Response('Forbidden', { status: 403 });

		const file = Bun.file(path);
		if (!(await file.exists()))
			return new Response('Not Found', { status: 404 });

		return new Response(method === 'HEAD' ? null : file, {
			status:  200,
			headers: {
				'Content-Type': MIME_TYPES[extname(path)] || 'application/octet-stream',
			},
		});
	},
});

process.stdout.write(`forge-docs static test server running at http://${ server.hostname }:${ server.port }\n`);
