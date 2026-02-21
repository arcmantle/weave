import { type ChildProcess, spawn } from 'child_process';
import { resolve } from 'path';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		try {
			const response = await fetch(url);
			if (response.ok || response.status === 404) {
				console.log(`[Coordinator] Server is ready at ${ url }`);

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

function coordinatorServerPlugin(): Plugin {
	let serverProcess: ChildProcess | null = null;
	const exampleDir = resolve(__dirname, '../Samples/CoordinatorExample');

	return {
		name: 'coordinator-server',
		async configureServer(server) {
			console.log('[Coordinator] Starting coordinator server...');

			serverProcess = spawn('dotnet', [ 'run', '-p:SkipClientBuild=true' ], {
				cwd: exampleDir,
				env: {
					...process.env,
					ASPNETCORE_ENVIRONMENT: 'Development',
					ASPNETCORE_URLS:        'http://localhost:5000',
				},
				shell: false,
			});

			serverProcess.stdout?.on('data', (data) => {
				console.log(`[Coordinator] ${ data.toString().trim() }`);
			});

			serverProcess.stderr?.on('data', (data) => {
				console.error(`[Coordinator Error] ${ data.toString().trim() }`);
			});

			serverProcess.on('exit', (code) => {
				if (code !== null && code !== 0)
					console.error(`[Coordinator] Server exited with code ${ code }`);
			});

			// Wait for server to be ready
			const ready = await waitForServer('http://localhost:5000/health');
			if (!ready)
				console.error('[Coordinator] Server failed to start within timeout');

			// Clean up on vite server close
			server.httpServer?.on('close', () => {
				if (serverProcess && !serverProcess.killed) {
					console.log('[Coordinator] Stopping coordinator server...');
					serverProcess.kill();
					serverProcess = null;
				}
			});
		},
		closeBundle() {
			if (serverProcess && !serverProcess.killed) {
				console.log('[Coordinator] Stopping coordinator server...');
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
			output: {
				manualChunks:         undefined,
				inlineDynamicImports: true,
			},
		},
	},
	plugins: [ coordinatorServerPlugin() ],
	server:  {
		port:  3100,
		proxy: {
			'/api': {
				target:       'http://localhost:5000',
				changeOrigin: true,
			},
			'/backends': {
				target:       'http://localhost:5000',
				changeOrigin: true,
			},
			'/reload': {
				target:       'http://localhost:5000',
				changeOrigin: true,
			},
			'/health': {
				target:       'http://localhost:5000',
				changeOrigin: true,
			},
		},
	},
}) as UserConfig;
