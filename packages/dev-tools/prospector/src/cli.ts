#!/usr/bin/env node

import { calculateVersion, suggestVersionBump } from './index.ts';

const args = process.argv.slice(2);

// Parse command line arguments
const options: {
	cwd?:               string;
	mainBranch?:        string;
	tagPrefix?:         string;
	format?:            'version' | 'json' | 'detailed';
	suggest?:           'major' | 'minor' | 'patch';
	enableCommitBumps?: boolean;
} = {
	mainBranch:        'main',
	tagPrefix:         'v',
	format:            'version',
	enableCommitBumps: true,
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
  - [major] or +semver: major or BREAKING CHANGE - increments major version
  - [minor] or +semver: minor or feat: - increments minor version
  - [patch] or +semver: patch or fix: - increments patch version

  Example commit messages:
    "feat: add new feature"           → bumps minor version
    "[major] breaking API change"     → bumps major version
    "fix: resolve bug"                → bumps patch version
    "chore: update deps"              → no explicit bump (uses commit count)
`);
}

try {
	if (options.suggest) {
		// Suggest a version bump
		const suggested = suggestVersionBump(options.suggest, options);
		console.log(suggested);
	}
	else {
		// Calculate current version
		const info = calculateVersion(options);

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
	console.error('Error:', error instanceof Error ? error.message : String(error));
	process.exit(1);
}
