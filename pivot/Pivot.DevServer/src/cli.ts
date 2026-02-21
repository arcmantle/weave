#!/usr/bin/env node

import path from 'node:path';

import { createPivotDevServer } from './server.js';


interface CliArgs {
	pluginsDir: string;
	port:       number;
	backendUrl: string;
}


function parseArgs(argv: string[]): CliArgs {
	const args: CliArgs = {
		pluginsDir: '',
		port:       3200,
		backendUrl: 'http://localhost:5200',
	};

	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i]!;

		switch (arg) {
		case '--plugins':
		case '-p':
			args.pluginsDir = argv[++i] ?? '';
			break;

		case '--port':
			args.port = parseInt(argv[++i] ?? '3200', 10);
			break;

		case '--backend':
		case '-b':
			args.backendUrl = argv[++i] ?? 'http://localhost:5200';
			break;

		case '--help':
		case '-h':
			printHelp();
			process.exit(0);
			break;

		default:
			if (!arg.startsWith('-') && !args.pluginsDir)
				args.pluginsDir = arg;

			break;
		}
	}

	if (!args.pluginsDir) {
		console.error('Error: --plugins <directory> is required.\n');
		printHelp();
		process.exit(1);
	}

	return args;
}


function printHelp(): void {
	console.log(`
Usage: pivot-dev --plugins <directory> [options]

Start the Pivot development server with HMR support for plugin source code.

Options:
  --plugins, -p <dir>    Path to the plugins directory (required)
  --port <number>        Dev server port (default: 3200)
  --backend, -b <url>    Backend URL for API proxy (default: http://localhost:5200)
  --help, -h             Show this help message

Example:
  pivot-dev --plugins ./Plugins --port 3200 --backend http://localhost:5200
`);
}


async function main(): Promise<void> {
	const args = parseArgs(process.argv);
	const pluginsDir = path.resolve(args.pluginsDir);

	console.log(`[pivot-dev] Plugins directory: ${ pluginsDir }`);
	console.log(`[pivot-dev] Backend proxy:     ${ args.backendUrl }`);
	console.log();

	await createPivotDevServer({
		pluginsDir,
		port:       args.port,
		backendUrl: args.backendUrl,
	});
}

main().catch(err => {
	console.error('[pivot-dev] Fatal error:', err);
	process.exit(1);
});
