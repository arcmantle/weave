import { loginRewritePlugin } from '@arcmantle/pivot-client-auth/vite';
import { type ChildProcess, spawn } from 'child_process';
import { resolve } from 'path';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			const response = await fetch(url);
			if (response.ok || response.status === 404) {
				console.log(`[Registry] Server is ready at ${ url }`);

				return true;
			}
		}
		catch {
			// Server not ready yet
		}
		await new Promise(resolve => setTimeout(resolve, 1000));
	}

	return false;
}

function registryServerPlugin(): Plugin {
	let serverProcess: ChildProcess | null = null;
	const exampleDir = resolve(__dirname, '../Samples/RegistryExample');

	return {
		name: 'registry-server',
		async configureServer(server) {
			console.log('[Registry] Starting registry server...');

			serverProcess = spawn('dotnet', [ 'run', '-p:SkipClientBuild=true' ], {
				cwd: exampleDir,
				env: {
					...process.env,
					ASPNETCORE_ENVIRONMENT: 'Development',
					ASPNETCORE_URLS:        'http://localhost:5100',
				},
				shell: false,
			});

			serverProcess.stdout?.on('data', (data) => {
				console.log(`[Registry] ${ data.toString().trim() }`);
			});

			serverProcess.stderr?.on('data', (data) => {
				console.error(`[Registry Error] ${ data.toString().trim() }`);
			});

			serverProcess.on('exit', (code) => {
				if (code !== null && code !== 0)
					console.error(`[Registry] Server exited with code ${ code }`);
			});

			// Wait for server to be ready
			const ready = await waitForServer('http://localhost:5100');
			if (!ready)
				console.error('[Registry] Server failed to start within timeout');

			// Clean up on vite server close
			server.httpServer?.on('close', () => {
				if (serverProcess && !serverProcess.killed) {
					console.log('[Registry] Stopping registry server...');
					serverProcess.kill();
					serverProcess = null;
				}
			});
		},
		closeBundle() {
			if (serverProcess && !serverProcess.killed) {
				console.log('[Registry] Stopping registry server...');
				serverProcess.kill();
				serverProcess = null;
			}
		},
	};
}

export default defineConfig({
	esbuild: {
		supported: {
			'top-level-await': true,
		},
	},
	build: {
		target:        'es2022',
		outDir:        'dist',
		rollupOptions: {
			input: {
				main:  resolve(__dirname, 'index.html'),
				login: resolve(__dirname, 'src/login/index.html'),
			},
		},
	},
	plugins: [
		registryServerPlugin(),
		loginRewritePlugin(),
	],
	server: {
		port:  3000,
		proxy: {
			'/api': {
				target:       'http://localhost:5100',
				changeOrigin: true,
			},
		},
	},
}) as UserConfig;
