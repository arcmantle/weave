import { execSync } from 'node:child_process';

import * as semver from 'semver';

export interface VersionTag {
	tag:     string;
	version: semver.SemVer;
	commit:  string;
}

export interface ProspectorOptions {
	/** The git repository path. Defaults to current directory */
	cwd?:                string;
	/** The main branch name. Defaults to 'main' */
	mainBranch?:         string;
	/** Prefix for version tags. Defaults to 'v' */
	tagPrefix?:          string;
	/** Enable commit message based version bumping. Defaults to true */
	enableCommitBumps?:  boolean;
	/** Custom regex patterns to detect version bumps in commit messages */
	commitBumpPatterns?:     {
		major?: RegExp;
		minor?: RegExp;
		patch?: RegExp;
	};
}

export interface VersionInfo {
	/** The calculated version */
	version:         string;
	/** The current branch */
	branch:          string;
	/** Whether on main branch */
	isMainBranch:    boolean;
	/** Number of commits since last tag */
	commitsSinceTag: number;
	/** The last version tag found */
	lastTag:         VersionTag | null;
	/** Current git commit hash */
	currentCommit:   string;
	/** Version bumps detected from commit messages */
	commitBumps:     {
		major: number;
		minor: number;
		patch: number;
	};
}

export interface CommitInfo {
	hash:    string;
	message: string;
}

/**
 * Default patterns for detecting version bumps in commit messages
 */
const DEFAULT_BUMP_PATTERNS = {
	major: /\[major\]|\+semver:\s*major|BREAKING[\s-]CHANGE/i,
	minor: /\[minor\]|\+semver:\s*minor|feat:|feature:/i,
	patch: /\[patch\]|\+semver:\s*patch|fix:|bugfix:/i,
};

/**
 * Execute a git command and return the output
 */
function gitExec(command: string, cwd: string = '.'): string {
	try {
		return execSync(`git ${ command }`, {
			cwd,
			encoding: 'utf-8',
			stdio:    [ 'pipe', 'pipe', 'pipe' ],
		}).trim();
	}
	catch (error) {
		return '';
	}
}

/**
 * Get the current branch name
 */
function getCurrentBranch(cwd: string): string {
	const branch = gitExec('rev-parse --abbrev-ref HEAD', cwd);

	return branch || 'unknown';
}

/**
 * Get the current commit hash
 */
function getCurrentCommit(cwd: string): string {
	return gitExec('rev-parse HEAD', cwd);
}

/**
 * Get all version tags from the repository
 */
function getVersionTags(cwd: string, tagPrefix: string): VersionTag[] {
	const tags = gitExec('tag -l', cwd).split('\n').filter(Boolean);
	const versionTags: VersionTag[] = [];

	for (const tag of tags) {
		// Check if tag starts with prefix
		if (!tag.startsWith(tagPrefix))
			continue;

		// Extract version string
		const versionStr = tag.slice(tagPrefix.length);
		const version = semver.parse(versionStr);

		if (version) {
			// Get the commit hash for this tag
			const commit = gitExec(`rev-list -n 1 ${ tag }`, cwd);
			versionTags.push({ tag, version, commit });
		}
	}

	// Sort by version descending
	versionTags.sort((a, b) => semver.rcompare(a.version, b.version));

	return versionTags;
}

/**
 * Get the last version tag that is an ancestor of the current commit
 */
function getLastVersionTag(
	cwd: string,
	currentCommit: string,
	versionTags: VersionTag[],
): VersionTag | null {
	// Find the most recent tag that is an ancestor of current commit
	for (const tag of versionTags) {
		// Check if this tag's commit is an ancestor of current commit
		const isAncestor = gitExec(
			`merge-base --is-ancestor ${ tag.commit } ${ currentCommit } && echo "yes"`,
			cwd,
		);

		if (isAncestor === 'yes')
			return tag;
	}

	return null;
}

/**
 * Count commits between two points
 */
function countCommits(cwd: string, from: string, to: string = 'HEAD'): number {
	const count = gitExec(`rev-list --count ${ from }..${ to }`, cwd);

	return parseInt(count, 10) || 0;
}

/**
 * Count total commits on current branch
 */
function countAllCommits(cwd: string): number {
	const count = gitExec('rev-list --count HEAD', cwd);

	return parseInt(count, 10) || 0;
}

/**
 * Get commit messages between two points
 */
function getCommitMessages(cwd: string, from: string, to: string = 'HEAD'): CommitInfo[] {
	const range = from ? `${ from }..${ to }` : to;
	const output = gitExec(`log ${ range } --format=%H%n%B%n---COMMIT-END---`, cwd);

	if (!output)
		return [];

	const commits: CommitInfo[] = [];
	const commitBlocks = output.split('---COMMIT-END---').filter(Boolean);

	for (const block of commitBlocks) {
		const lines = block.trim().split('\n');
		if (lines.length < 2)
			continue;

		const hash = lines[0];
		const message = lines.slice(1).join('\n');

		commits.push({ hash, message });
	}

	return commits;
}

/**
 * Analyze commits for version bump indicators
 */
function analyzeCommitBumps(
	commits: CommitInfo[],
	patterns: { major?: RegExp; minor?: RegExp; patch?: RegExp; },
): { major: number; minor: number; patch: number; } {
	const bumps = { major: 0, minor: 0, patch: 0 };

	for (const commit of commits) {
		// Check in priority order: major > minor > patch
		// Only count the highest bump per commit
		if (patterns.major?.test(commit.message))
			bumps.major++;

		else if (patterns.minor?.test(commit.message))
			bumps.minor++;

		else if (patterns.patch?.test(commit.message))
			bumps.patch++;
	}

	return bumps;
}


/**
 * Calculate the version based on git history
 */
export function calculateVersion(options: ProspectorOptions = {}): VersionInfo {
	const cwd = options.cwd || '.';
	const mainBranch = options.mainBranch || 'main';
	const tagPrefix = options.tagPrefix || 'v';
	const enableCommitBumps = options.enableCommitBumps !== false; // Default true
	const bumpPatterns = {
		major: options.commitBumpPatterns?.major || DEFAULT_BUMP_PATTERNS.major,
		minor: options.commitBumpPatterns?.minor || DEFAULT_BUMP_PATTERNS.minor,
		patch: options.commitBumpPatterns?.patch || DEFAULT_BUMP_PATTERNS.patch,
	};

	const currentBranch = getCurrentBranch(cwd);
	const currentCommit = getCurrentCommit(cwd);
	const isMainBranch = currentBranch === mainBranch;

	// Get all version tags
	const versionTags = getVersionTags(cwd, tagPrefix);

	// Find the last version tag that's an ancestor of current commit
	const lastTag = getLastVersionTag(cwd, currentCommit, versionTags);

	let version: string;
	let commitsSinceTag: number;
	let commitBumps = { major: 0, minor: 0, patch: 0 };

	// Get commits since last tag (or all commits if no tag)
	const commits = lastTag
		? getCommitMessages(cwd, lastTag.commit, currentCommit)
		: getCommitMessages(cwd, '', currentCommit);

	// Analyze commit messages for version bumps if enabled
	if (enableCommitBumps && isMainBranch)
		commitBumps = analyzeCommitBumps(commits, bumpPatterns);

	if (lastTag) {
		// Count commits since the last tag
		commitsSinceTag = countCommits(cwd, lastTag.commit, currentCommit);

		if (isMainBranch) {
			// On main branch: apply commit-based bumps or count commits
			const newVersion = semver.parse(lastTag.version.version)!;

			if (enableCommitBumps && (commitBumps.major > 0 || commitBumps.minor > 0)) {
				// Apply explicit version bumps from commit messages
				newVersion.major += commitBumps.major;
				newVersion.minor += commitBumps.minor;

				// Reset lower version parts when bumping
				if (commitBumps.major > 0) {
					newVersion.minor = 0;
					newVersion.patch = 0;
				}
				else if (commitBumps.minor > 0) {
					newVersion.patch = 0;
				}

				// Add any patch bumps
				newVersion.patch += commitBumps.patch;
			}
			else {
				// Default behavior: increment patch by commit count
				newVersion.patch += commitsSinceTag;
			}

			version = newVersion.format();
		}
		else {
			// On feature branch: use prerelease version
			const baseVersion = semver.parse(lastTag.version.version)!;
			baseVersion.patch += 1; // Next patch version

			// Use branch name (sanitized) and commit count as prerelease identifier
			const branchName = currentBranch
				.replace(/[^a-zA-Z0-9-]/g, '-')
				.replace(/^-+|-+$/g, '');
			version = `${ baseVersion.format() }-${ branchName }.${ commitsSinceTag }`;
		}
	}
	else {
		// No tags found - start from 0.0.0
		commitsSinceTag = countAllCommits(cwd);

		if (isMainBranch) {
			if (enableCommitBumps && (commitBumps.major > 0 || commitBumps.minor > 0)) {
				// Apply explicit bumps from commits
				const newVersion = new semver.SemVer('0.0.0');
				newVersion.major = commitBumps.major;
				newVersion.minor = commitBumps.minor;
				newVersion.patch = commitBumps.patch;
				version = newVersion.format();
			}
			else {
				// On main branch: version is 0.0.{commitCount}
				version = `0.0.${ commitsSinceTag }`;
			}
		}
		else {
			// On feature branch: 0.0.1-{branch}.{commitCount}
			const branchName = currentBranch
				.replace(/[^a-zA-Z0-9-]/g, '-')
				.replace(/^-+|-+$/g, '');
			version = `0.0.1-${ branchName }.${ commitsSinceTag }`;
		}
	}

	return {
		version,
		branch: currentBranch,
		isMainBranch,
		commitsSinceTag,
		lastTag,
		currentCommit,
		commitBumps,
	};
}

/**
 * Get major.minor.patch version suggestion based on current state
 */
export function suggestVersionBump(
	bumpType: 'major' | 'minor' | 'patch',
	options: ProspectorOptions = {},
): string {
	const info = calculateVersion(options);
	const currentBase = info.lastTag
		? info.lastTag.version.version
		: '0.0.0';

	const bumped = semver.inc(currentBase, bumpType);

	return bumped || '1.0.0';
}
