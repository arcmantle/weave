import { spawn } from 'node:child_process';

import * as semver from 'semver';

export interface VersionTag {
	tag:     string;
	version: semver.SemVer;
	commit:  string;
}

export interface ProspectorOptions {
	/** The git repository path. Defaults to current directory */
	cwd?:                string;
	/**
	 * The main/trunk branch name(s). Can be a string or array of strings.
	 * Defaults to ['main', 'master'] to support both common conventions.
	 * All specified branches are treated as trunk branches.
	 */
	mainBranch?:         string | string[];
	/** Prefix for version tags. Defaults to 'v' */
	tagPrefix?:          string;
	/** Enable commit message based version bumping. Defaults to true */
	enableCommitBumps?:  boolean;
	/**
	 * Maximum number of commits to scan for bump patterns.
	 * Only applied if useOptimizedScanning is false.
	 * When optimized scanning is enabled (default), this limit is ignored.
	 * Set this option to enable the limit if you experience performance issues.
	 * Defaults to undefined (no limit when using optimized scanning).
	 */
	maxCommitScan?:      number;
	/** Custom regex patterns to detect version bumps in commit messages */
	commitBumpPatterns?:     {
		major?: RegExp;
		minor?: RegExp;
		patch?: RegExp;
	};
	/** Progress callback for status updates */
	onProgress?: (message: string) => void;
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
		major:           number;
		minor:           number;
		patch:           number;
		explicitVersion: string | null;
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
	major: /\[major\]/i,
	minor: /\[minor\]/i,
	patch: /\[patch\]/i,
};

/**
 * Pattern for detecting explicit version setting in commit messages
 * Matches [version:1.2.3] or [v:1.2.3]
 */
const VERSION_SET_PATTERN = /\[(?:version|v):(\d+\.\d+\.\d+)\]/i;

/**
 * Parse a command string into arguments, handling quotes properly
 */
function parseCommandArgs(command: string): string[] {
	const args: string[] = [];
	let current = '';
	let inQuote = false;
	let quoteChar = '';

	for (const char of command) {
		if ((char === '"' || char === "'") && !inQuote) {
			inQuote = true;
			quoteChar = char;
		}
		else if (char === quoteChar && inQuote) {
			inQuote = false;
			quoteChar = '';
		}
		else if (char === ' ' && !inQuote) {
			if (current) {
				args.push(current);
				current = '';
			}
		}
		else {
			current += char;
		}
	}

	if (current)
		args.push(current);

	return args;
}

/**
 * Execute a git command asynchronously and return the output
 */
async function gitExec(command: string, cwd: string = '.'): Promise<string> {
	return new Promise((resolve) => {
		const args = parseCommandArgs(command);
		const proc = spawn('git', args, { cwd });

		let stdout = '';

		proc.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		proc.on('close', (code) => {
			if (code !== 0)
				resolve('');
			else
				resolve(stdout.trim());
		});

		proc.on('error', () => {
			resolve('');
		});
	});
}

/**
 * Get the current branch name
 */
async function getCurrentBranch(cwd: string): Promise<string> {
	const branch = await gitExec('rev-parse --abbrev-ref HEAD', cwd);

	return branch || 'unknown';
}

/**
 * Get the current commit hash
 */
async function getCurrentCommit(cwd: string): Promise<string> {
	return gitExec('rev-parse HEAD', cwd);
}

/**
 * Get all version tags from the repository
 */
async function getVersionTags(cwd: string, tagPrefix: string): Promise<VersionTag[]> {
	const tagsOutput = await gitExec('tag -l', cwd);
	const tags = tagsOutput.split('\n').filter(Boolean);

	if (tags.length === 0)
		return [];

	const versionTags: VersionTag[] = [];

	// Get all tag commits in a single command for efficiency
	const tagCommits: Map<string, string> = new Map();
	for (const tag of tags) {
		if (!tag.startsWith(tagPrefix))
			continue;

		const versionStr = tag.slice(tagPrefix.length);
		const version = semver.parse(versionStr);

		if (version) {
			// Defer getting commit hash
			tagCommits.set(tag, '');
		}
	}

	// Batch fetch all tag commits in one git command
	if (tagCommits.size > 0) {
		const tagList = Array.from(tagCommits.keys()).join(' ');
		const output = await gitExec(`show-ref --tags ${ tagList }`, cwd);

		// Parse output: "commit_hash refs/tags/tagname"
		for (const line of output.split('\n')) {
			const parts = line.trim().split(/\s+/);
			if (parts.length >= 2) {
				const commit = parts[0]!;
				const ref = parts[1]!;
				const tag = ref.replace('refs/tags/', '');
				if (tagCommits.has(tag))
					tagCommits.set(tag, commit);
			}
		}

		// Build version tags array
		for (const [ tag, commit ] of tagCommits) {
			if (commit) {
				const versionStr = tag.slice(tagPrefix.length);
				const version = semver.parse(versionStr);
				if (version)
					versionTags.push({ tag, version, commit });
			}
		}
	}

	// Sort by version descending
	versionTags.sort((a, b) => semver.rcompare(a.version, b.version));

	return versionTags;
}

/**
 * Get the last version tag that is an ancestor of the current commit
 */
async function getLastVersionTag(
	cwd: string,
	currentCommit: string,
	versionTags: VersionTag[],
): Promise<VersionTag | null> {
	if (versionTags.length === 0)
		return null;

	// Get all reachable tags from current commit in one command
	const reachableTagsOutput = await gitExec(
		`tag --merged ${ currentCommit }`,
		cwd,
	);
	const reachableTags = reachableTagsOutput.split('\n').filter(Boolean);

	if (reachableTags.length === 0)
		return null;

	// Convert to set for O(1) lookup
	const reachableSet = new Set(reachableTags);

	// Find the first (highest version) tag that is reachable
	for (const tag of versionTags) {
		if (reachableSet.has(tag.tag))
			return tag;
	}

	return null;
}

/**
 * Count commits between two points with progress updates
 */
async function countCommits(
	cwd: string,
	from: string,
	to: string = 'HEAD',
	onProgress?: (message: string) => void,
): Promise<number> {
	// For large repos, stream the count to show progress
	return new Promise((resolve) => {
		const range = `${ from }..${ to }`;
		const args = parseCommandArgs(`rev-list --count ${ range }`);
		const proc = spawn('git', args, { cwd });

		let stdout = '';
		let updateInterval: NodeJS.Timeout | null = null;
		let dots = 0;

		// Show progress while waiting
		if (onProgress) {
			updateInterval = setInterval(() => {
				dots = (dots + 1) % 4;
				onProgress(`Counting commits${ '.'.repeat(dots) }`);
			}, 500);
		}

		proc.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		proc.on('close', (code) => {
			if (updateInterval)
				clearInterval(updateInterval);

			if (code !== 0)
				resolve(0);
			else
				resolve(parseInt(stdout.trim(), 10) || 0);
		});

		proc.on('error', () => {
			if (updateInterval)
				clearInterval(updateInterval);

			resolve(0);
		});
	});
}

/**
 * Count total commits on current branch with progress updates
 */
async function countAllCommits(cwd: string, onProgress?: (message: string) => void): Promise<number> {
	// For large repos, stream the count to show progress
	return new Promise((resolve) => {
		const args = parseCommandArgs('rev-list --count HEAD');
		const proc = spawn('git', args, { cwd });

		let stdout = '';
		let updateInterval: NodeJS.Timeout | null = null;
		let dots = 0;

		// Show progress while waiting
		if (onProgress) {
			updateInterval = setInterval(() => {
				dots = (dots + 1) % 4;
				onProgress(`Counting all commits${ '.'.repeat(dots) }`);
			}, 500);
		}

		proc.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		proc.on('close', (code) => {
			if (updateInterval)
				clearInterval(updateInterval);

			if (code !== 0)
				resolve(0);
			else
				resolve(parseInt(stdout.trim(), 10) || 0);
		});

		proc.on('error', () => {
			if (updateInterval)
				clearInterval(updateInterval);

			resolve(0);
		});
	});
}

/**
 * Get commit messages between two points
 * Returns both the commits and the count for efficiency
 * @param limit Optional limit on number of commits to fetch (for performance)
 */
async function getCommitMessages(
	cwd: string,
	from: string,
	to: string = 'HEAD',
	limit?: number,
): Promise<CommitInfo[]> {
	const range = from ? `${ from }..${ to }` : to;
	const limitFlag = limit ? `-n ${ limit }` : '';
	// Use null-byte separator for better performance and reliability
	const output = await gitExec(`log ${ range } ${ limitFlag } --format=%H%x00%B%x00`, cwd);

	if (!output)
		return [];

	const commits: CommitInfo[] = [];
	const commitBlocks = output.split('\x00\x00').filter(Boolean);

	for (const block of commitBlocks) {
		const [ hash, message ] = block.split('\x00');
		if (hash && message !== undefined)
			commits.push({ hash, message });
	}

	return commits;
}

/**
 * Get commit messages that contain version bump patterns (optimized)
 * Uses git log --grep to only fetch commits with bump markers
 * Does a single scan, then processes results in chunks to keep UI responsive
 */
async function getCommitsWithBumps(
	cwd: string,
	from: string,
	to: string = 'HEAD',
	onProgress?: (message: string) => void,
): Promise<CommitInfo[]> {
	const range = from ? `${ from }..${ to }` : to;

	// Build grep pattern for all bump indicators
	const pattern = '\\[major\\]\\|\\[minor\\]\\|\\[patch\\]\\|\\[version:\\|\\[v:';

	onProgress?.('Searching for version bump markers...');

	// Do ONE git log --grep to get ALL matching commits
	// This scans the repo once instead of multiple times with --skip
	const output = await gitExec(
		`log ${ range } --grep='${ pattern }' -E -i --format=%H%x00%B%x00`,
		cwd,
	);

	if (!output) {
		onProgress?.('Search complete - no bump markers found');

		return [];
	}

	const commitBlocks = output.split('\x00\x00').filter(Boolean);

	if (commitBlocks.length === 0) {
		onProgress?.('Search complete - no bump markers found');

		return [];
	}

	onProgress?.(`Found ${ commitBlocks.length.toLocaleString() } commits with bump markers, parsing...`);

	// Process in chunks to keep progress responsive
	const allCommits: CommitInfo[] = [];
	const PARSE_CHUNK_SIZE = 1000;

	for (let i = 0; i < commitBlocks.length; i += PARSE_CHUNK_SIZE) {
		const chunk = commitBlocks.slice(i, i + PARSE_CHUNK_SIZE);
		const chunkNum = Math.floor(i / PARSE_CHUNK_SIZE) + 1;
		const totalChunks = Math.ceil(commitBlocks.length / PARSE_CHUNK_SIZE);

		for (const block of chunk) {
			const [ hash, message ] = block.split('\x00');
			if (hash && message !== undefined)
				allCommits.push({ hash, message });
		}

		const parsed = allCommits.length.toLocaleString();
		const total = commitBlocks.length.toLocaleString();
		onProgress?.(`Parsed ${ parsed } / ${ total } commits (chunk ${ chunkNum }/${ totalChunks })`);

		// Small delay to ensure progress updates are visible
		await new Promise(resolve => setTimeout(resolve, 5));
	}

	onProgress?.(`Parsing complete - ${ allCommits.length.toLocaleString() } commits with bump markers`);

	return allCommits;
}

/**
 * Analyze commits for version bump indicators and explicit version setting
 * With early termination optimization
 */
function analyzeCommitBumps(
	commits: CommitInfo[],
	patterns: { major?: RegExp; minor?: RegExp; patch?: RegExp; },
): { major: number; minor: number; patch: number; explicitVersion: string | null; } {
	const bumps = { major: 0, minor: 0, patch: 0, explicitVersion: null as string | null };

	for (const commit of commits) {
		// Check for explicit version setting first
		const versionMatch = VERSION_SET_PATTERN.exec(commit.message);
		if (versionMatch?.[1]) {
			// Use the most recent explicit version found
			bumps.explicitVersion = versionMatch[1];
			// Early termination: explicit version takes precedence, no need to scan older commits
			break;
		}

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
export async function calculateVersion(options: ProspectorOptions = {}): Promise<VersionInfo> {
	const cwd = options.cwd || '.';
	// Support both 'main' and 'master' by default, or custom branch names
	const mainBranchOption = options.mainBranch || [ 'main', 'master' ];
	const mainBranches = Array.isArray(mainBranchOption) ? mainBranchOption : [ mainBranchOption ];
	const tagPrefix = options.tagPrefix || 'v';
	const enableCommitBumps = options.enableCommitBumps !== false; // Default true
	const maxCommitScan = options.maxCommitScan; // Optional limit for performance issues
	const onProgress = options.onProgress || (() => {}); // Optional progress callback
	const bumpPatterns = {
		major: options.commitBumpPatterns?.major || DEFAULT_BUMP_PATTERNS.major,
		minor: options.commitBumpPatterns?.minor || DEFAULT_BUMP_PATTERNS.minor,
		patch: options.commitBumpPatterns?.patch || DEFAULT_BUMP_PATTERNS.patch,
	};

	onProgress('Getting current branch and commit...');
	const currentBranch = await getCurrentBranch(cwd);
	const currentCommit = await getCurrentCommit(cwd);
	const isMainBranch = mainBranches.includes(currentBranch);

	onProgress(`Branch: ${ currentBranch } | Commit: ${ currentCommit.slice(0, 8) } | Main: ${ isMainBranch ? 'Yes' : 'No' }`);

	onProgress('Fetching version tags...');
	// Get all version tags
	const versionTags = await getVersionTags(cwd, tagPrefix);

	if (versionTags.length > 0)
		onProgress(`Found ${ versionTags.length } version tag(s) | Latest: ${ versionTags[0]?.tag }`);
	else
		onProgress('Found 0 version tags');

	// Find the last version tag that's an ancestor of current commit
	const lastTag = await getLastVersionTag(cwd, currentCommit, versionTags);

	let version: string;
	let commitsSinceTag: number;
	let commitBumps = { major: 0, minor: 0, patch: 0, explicitVersion: null as string | null };

	// Only fetch commit messages if we need them for bump analysis
	let commits: CommitInfo[] = [];
	if (enableCommitBumps && isMainBranch) {
		if (maxCommitScan !== undefined) {
			// Legacy mode: Use scan limit if explicitly set (for performance issues)
			onProgress(`Scanning up to ${ maxCommitScan } commits for version bumps...`);
			const scanLimit = maxCommitScan > 0 ? maxCommitScan : undefined;

			commits = lastTag
				? await getCommitMessages(cwd, lastTag.commit, currentCommit, scanLimit)
				: await getCommitMessages(cwd, '', currentCommit, scanLimit);
		}
		else {
			// Optimized mode (default): Use git grep to only fetch commits with bump patterns
			onProgress('Scanning for commits with version bumps (optimized)...');
			commits = lastTag
				? await getCommitsWithBumps(cwd, lastTag.commit, currentCommit, onProgress)
				: await getCommitsWithBumps(cwd, '', currentCommit, onProgress);
			onProgress(`Found ${ commits.length } commit(s) with bump markers`);
		}

		commitBumps = analyzeCommitBumps(commits, bumpPatterns);

		// Report bump analysis results
		if (commitBumps.explicitVersion) {
			onProgress(`Explicit version found: ${ commitBumps.explicitVersion }`);
		}
		else if (commitBumps.major > 0 || commitBumps.minor > 0 || commitBumps.patch > 0) {
			onProgress(
				`Bumps detected | Major: ${ commitBumps.major } | Minor: ${ commitBumps.minor } | Patch: ${ commitBumps.patch }`,
			);
		}
	}

	if (lastTag) {
		// If using optimized mode (no limit) or we fetched all commits, use commits.length
		// Otherwise get accurate count separately
		if (maxCommitScan === undefined || commits.length === 0) {
			// Optimized mode or no commits fetched - need accurate count
			commitsSinceTag = await countCommits(cwd, lastTag.commit, currentCommit, onProgress);
			onProgress(`Counted ${ commitsSinceTag.toLocaleString() } commit(s) since ${ lastTag.tag }`);
		}
		else if (maxCommitScan === 0 || commits.length < maxCommitScan) {
			// Legacy mode: fetched all commits, use the length
			commitsSinceTag = commits.length;
		}
		else {
			// Legacy mode: hit the limit - need accurate count
			commitsSinceTag = await countCommits(cwd, lastTag.commit, currentCommit, onProgress);
			onProgress(`Counted ${ commitsSinceTag.toLocaleString() } commit(s) since ${ lastTag.tag }`);
		}

		onProgress(`${ commitsSinceTag } commit(s) since last tag (${ lastTag.tag })`);

		if (isMainBranch) {
			// Check for explicit version setting first
			if (enableCommitBumps && commitBumps.explicitVersion) {
				version = commitBumps.explicitVersion;
			}
			else if (enableCommitBumps && (commitBumps.major > 0 || commitBumps.minor > 0)) {
				// Apply explicit version bumps from commit messages
				const newVersion = semver.parse(lastTag.version.version)!;
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
				version = newVersion.format();
			}
			else {
				// Default behavior: increment patch by commit count
				const newVersion = semver.parse(lastTag.version.version)!;
				newVersion.patch += commitsSinceTag;
				version = newVersion.format();
			}
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
		onProgress('No version tags found, starting from 0.0.0');
		// If using optimized mode (no limit) or we fetched all commits, use commits.length
		// Otherwise get accurate count separately
		if (maxCommitScan === undefined || commits.length === 0) {
			// Optimized mode or no commits fetched - need accurate count
			commitsSinceTag = await countAllCommits(cwd, onProgress);
			onProgress(`Total commits in repository: ${ commitsSinceTag.toLocaleString() }`);
		}
		else if (maxCommitScan === 0 || commits.length < maxCommitScan) {
			// Legacy mode: fetched all commits, use the length
			commitsSinceTag = commits.length;
		}
		else {
			// Legacy mode: hit the limit - need accurate count
			commitsSinceTag = await countAllCommits(cwd, onProgress);
			onProgress(`Total commits in repository: ${ commitsSinceTag.toLocaleString() }`);
		}

		if (isMainBranch) {
			if (enableCommitBumps && commitBumps.explicitVersion) {
				// Use explicit version if set
				version = commitBumps.explicitVersion;
			}
			else if (enableCommitBumps && (commitBumps.major > 0 || commitBumps.minor > 0)) {
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

	onProgress(`Calculated version: ${ version }`);

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
export async function suggestVersionBump(
	bumpType: 'major' | 'minor' | 'patch',
	options: ProspectorOptions = {},
): Promise<string> {
	const info = await calculateVersion(options);
	const currentBase = info.lastTag
		? info.lastTag.version.version
		: '0.0.0';

	const bumped = semver.inc(currentBase, bumpType);

	return bumped || '1.0.0';
}
