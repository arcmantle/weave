#!/usr/bin/env node

import ora from 'ora';

import { calculateVersion, suggestVersionBump } from './index.ts';

const args = process.argv.slice(2);

// Parse command line arguments
const options: {
	cwd?:               string;
	mainBranch?:        string | string[];
	tagPrefix?:         string;
	format?:            'version' | 'json' | 'detailed';
	suggest?:           'major' | 'minor' | 'patch';
	enableCommitBumps?: boolean;
	showMemory?:        boolean;
} = {
	mainBranch:        undefined,
	tagPrefix:         'v',
	format:            'version',
	enableCommitBumps: true,
	showMemory:        false,
};

for (let i = 0; i < args.length; i++) {
	const arg = args[i];

	switch (arg) {
	case '-h':
	case '--help':
		printHelp();
		process.exit(0);
		break;

	case '-d':
	case '--dir':
		options.cwd = args[++i];
		break;

	case '-b':
	case '--branch':
		options.mainBranch = args[++i];
		break;

	case '-p':
	case '--prefix':
		options.tagPrefix = args[++i];
		break;

	case '--json':
		options.format = 'json';
		break;

	case '--detailed':
		options.format = 'detailed';
		break;

	case '--suggest':
		options.suggest = args[++i] as 'major' | 'minor' | 'patch';
		break;

	case '--no-commit-bumps':
		options.enableCommitBumps = false;
		break;

	case '--show-memory':
		options.showMemory = true;
		break;

	default:
		if (arg!.startsWith('-')) {
			console.error(`Unknown option: ${ arg }`);
			console.error('Use --help for usage information');
			process.exit(1);
		}
	}
}

function printHelp() {
	console.log(`
Prospector - Semver Version Calculator

Usage: prospector [options]

Options:
  -h, --help              Show this help message
  -d, --dir <path>        Git repository path (default: current directory)
  -b, --branch <name>     Main branch name (default: main)
  -p, --prefix <prefix>   Version tag prefix (default: v)
  --json                  Output as JSON
  --detailed              Output detailed information
  --suggest <type>        Suggest next version (major|minor|patch)
  --no-commit-bumps       Disable commit message based version bumping
  --show-memory           Show memory usage statistics

Examples:
  prospector                          # Output current version
  prospector --json                   # Output as JSON
  prospector --detailed               # Show detailed version info
  prospector --suggest minor          # Suggest next minor version
  prospector -d /path/to/repo         # Check version in specific repo
  prospector -b master -p version-    # Use 'master' branch and 'version-' prefix

Versioning Rules:
  - Each commit on main branch increments patch version by 1
  - Feature branches use prerelease versioning (e.g., 1.2.3-feature.5)
  - Use git tags to set major/minor versions (e.g., git tag v2.0.0)
  - When a branch merges to main, it increments patch by 1

Commit Message Version Bumping:
  - [major] - increments major version (resets minor and patch to 0)
  - [minor] - increments minor version (resets patch to 0)
  - [patch] - increments patch version
  - [version:x.y.z] or [v:x.y.z] - sets exact version

  Example commit messages:
    "[minor] add new feature"         → bumps minor version
    "[major] breaking API change"     → bumps major version
    "[patch] fix bug"                 → bumps patch version
    "[version:2.5.0] release 2.5.0"   → sets version to 2.5.0
    "update dependencies"             → no explicit bump (uses commit count)
`);
}

try {
	if (options.suggest) {
		// Suggest a version bump
		const spinner = ora('Calculating version...').start();
		const startMem = process.memoryUsage();

		const suggested = await suggestVersionBump(options.suggest, {
			...options,
			onProgress: (msg) => {
				spinner.text = msg;
			},
		});

		const endMem = process.memoryUsage();
		const heapUsedMB = (endMem.heapUsed / 1024 / 1024).toFixed(2);
		const deltaMB = ((endMem.heapUsed - startMem.heapUsed) / 1024 / 1024).toFixed(2);

		const memStats = options.showMemory ? ` | Memory: ${ heapUsedMB } MB (Δ${ deltaMB } MB)` : '';
		spinner.succeed(`Suggested version: ${ suggested }${ memStats }`);
		console.log(suggested);
	}
	else {
		// Calculate current version
		const spinner = ora('Calculating version...').start();
		const startMem = process.memoryUsage();

		const info = await calculateVersion({
			...options,
			onProgress: (msg) => {
				spinner.text = msg;
			},
		});

		const endMem = process.memoryUsage();
		const heapUsedMB = (endMem.heapUsed / 1024 / 1024).toFixed(2);
		const deltaMB = ((endMem.heapUsed - startMem.heapUsed) / 1024 / 1024).toFixed(2);

		const memStats = options.showMemory ? ` | Memory: ${ heapUsedMB } MB (Δ${ deltaMB } MB)` : '';
		spinner.succeed(`Version calculated${ memStats }`);

		switch (options.format) {
		case 'json':
			console.log(JSON.stringify(info, null, 2));
			break;

		case 'detailed':
			console.log('Current Version Information:');
			console.log('─'.repeat(50));
			console.log(`Version:           ${ info.version }`);
			console.log(`Branch:            ${ info.branch }`);
			console.log(`Main Branch:       ${ info.isMainBranch ? 'Yes' : 'No' }`);
			console.log(`Commits Since Tag: ${ info.commitsSinceTag }`);
			console.log(`Current Commit:    ${ info.currentCommit.slice(0, 8) }`);
			if (info.lastTag) {
				console.log(`Last Tag:          ${ info.lastTag.tag } (${ info.lastTag.version.version })`);
				console.log(`Tag Commit:        ${ info.lastTag.commit.slice(0, 8) }`);
			}
			else {
				console.log('Last Tag:          (none)');
			}

			if (info.commitBumps.major > 0 || info.commitBumps.minor > 0 || info.commitBumps.patch > 0) {
				console.log('\nCommit-Based Bumps:');
				console.log(`  Major:           ${ info.commitBumps.major }`);
				console.log(`  Minor:           ${ info.commitBumps.minor }`);
				console.log(`  Patch:           ${ info.commitBumps.patch }`);
			}

			break;

		case 'version':
		default:
			console.log(info.version);
			break;
		}
	}
}
catch (error) {
	const spinner = ora();
	spinner.fail('Error calculating version');
	console.error('Error:', error instanceof Error ? error.message : String(error));
	process.exit(1);
}
