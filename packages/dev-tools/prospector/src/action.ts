#!/usr/bin/env node

/**
 * GitHub Action entry point for Prospector
 * Calculates version and sets GitHub Action outputs
 */

import * as core from '@actions/core';

import { calculateVersion, suggestVersionBump } from './index.js';


async function run(): Promise<void> {
	try {
		// Get inputs
		const dir = core.getInput('dir') || '.';
		const branchInput = core.getInput('branch') || 'main,master';
		const mainBranch = branchInput.includes(',')
			? branchInput.split(',').map((b: string) => b.trim())
			: branchInput;
		const tagPrefix = core.getInput('prefix') || 'v';
		const suggest = core.getInput('suggest') as 'major' | 'minor' | 'patch' | '';
		const noCommitBumps = core.getInput('no-commit-bumps') === 'true';

		core.info(`Calculating version for: ${ dir }`);

		// Calculate version
		const info = await calculateVersion({
			cwd:               dir,
			mainBranch,
			tagPrefix,
			enableCommitBumps: !noCommitBumps,
			onProgress:        (msg) => {
				core.info(msg);
			},
		});

		// Determine output version
		let outputVersion = info.version;
		if (suggest) {
			core.info(`Suggesting next ${ suggest } version...`);
			outputVersion = await suggestVersionBump(suggest, {
				cwd: dir,
				mainBranch,
				tagPrefix,
			});
		}

		// Set outputs
		core.setOutput('version', outputVersion);
		core.setOutput('branch', info.branch);
		core.setOutput('is-main-branch', info.isMainBranch.toString());
		core.setOutput('commits-since-tag', info.commitsSinceTag.toString());
		core.setOutput('last-tag', info.lastTag?.tag || '');
		core.setOutput('current-commit', info.currentCommit);
		core.setOutput('major-bumps', info.commitBumps.major.toString());
		core.setOutput('minor-bumps', info.commitBumps.minor.toString());
		core.setOutput('patch-bumps', info.commitBumps.patch.toString());

		// Summary
		core.summary
			.addHeading('📦 Prospector Version')
			.addTable([
				[ { data: 'Property', header: true }, { data: 'Value', header: true } ],
				[ 'Version', outputVersion ],
				[ 'Branch', info.branch ],
				[ 'Main Branch', info.isMainBranch ? '✅ Yes' : '❌ No' ],
				[ 'Commits Since Tag', info.commitsSinceTag.toString() ],
				[ 'Last Tag', info.lastTag?.tag || '(none)' ],
				[ 'Current Commit', info.currentCommit.slice(0, 8) ],
			]);

		if (info.commitBumps.major > 0 || info.commitBumps.minor > 0 || info.commitBumps.patch > 0) {
			core.summary.addTable([
				[ { data: 'Bump Type', header: true }, { data: 'Count', header: true } ],
				[ 'Major', info.commitBumps.major.toString() ],
				[ 'Minor', info.commitBumps.minor.toString() ],
				[ 'Patch', info.commitBumps.patch.toString() ],
			]);
		}

		await core.summary.write();

		core.info(`✅ Version: ${ outputVersion }`);
	}
	catch (error) {
		core.setFailed(error instanceof Error ? error.message : String(error));
	}
}

await run();
