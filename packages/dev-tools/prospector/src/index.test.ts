import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { calculateVersion, suggestVersionBump } from './index.js';

/**
 * Helper to create a temporary git repository for testing
 */
function createTempGitRepo(): { path: string; cleanup: () => void; } {
	const tempDir = mkdtempSync(join(tmpdir(), 'prospector-test-'));

	// Initialize git repo with main branch
	execSync('git init -b main', { cwd: tempDir, stdio: 'pipe' });
	execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'pipe' });
	execSync('git config user.name "Test User"', { cwd: tempDir, stdio: 'pipe' });
	execSync('git config commit.gpgsign false', { cwd: tempDir, stdio: 'pipe' });

	// Create initial commit
	execSync('git commit --allow-empty -m "Initial commit"', { cwd: tempDir, stdio: 'pipe' });

	return {
		path:    tempDir,
		cleanup: () => {
			try {
				rmSync(tempDir, { recursive: true, force: true });
			}
			catch {
				// Ignore cleanup errors
			}
		},
	};
}

/**
 * Helper to add commits to a repo
 */
function addCommit(repoPath: string, message: string): void {
	execSync(`git commit --allow-empty -m "${ message.replace(/"/g, '\\"') }"`, {
		cwd:   repoPath,
		stdio: 'pipe',
	});
}

/**
 * Helper to create a tag
 */
function createTag(repoPath: string, tagName: string): void {
	execSync(`git tag ${ tagName }`, { cwd: repoPath, stdio: 'pipe' });
}

/**
 * Helper to create and checkout a branch
 */
function createBranch(repoPath: string, branchName: string): void {
	execSync(`git checkout -b ${ branchName }`, { cwd: repoPath, stdio: 'pipe' });
}

describe('Prospector', () => {
	describe('calculateVersion', () => {
		it('should calculate version on main branch with no tags', async () => {
			const repo = createTempGitRepo();

			try {
				// Add 4 more commits (already have 1 from init)
				for (let i = 0; i < 4; i++)
					addCommit(repo.path, `Commit ${ i + 1 }`);

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('0.0.5');
				expect(result.branch).toBe('main');
				expect(result.isMainBranch).toBe(true);
				expect(result.commitsSinceTag).toBe(5);
				expect(result.lastTag).toBeNull();
			}
			finally {
				repo.cleanup();
			}
		});

		it('should calculate version on feature branch with no tags', async () => {
			const repo = createTempGitRepo();

			try {
				// Add commits and create feature branch
				addCommit(repo.path, 'Commit 1');
				addCommit(repo.path, 'Commit 2');
				createBranch(repo.path, 'feature/test');

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('0.0.1-feature-test.3');
				expect(result.branch).toBe('feature/test');
				expect(result.isMainBranch).toBe(false);
			}
			finally {
				repo.cleanup();
			}
		});

		it('should calculate version on main branch with existing tag', async () => {
			const repo = createTempGitRepo();

			try {
				// Create a tag at first commit
				createTag(repo.path, 'v1.2.0');

				// Add 3 more commits
				for (let i = 0; i < 3; i++)
					addCommit(repo.path, `Commit ${ i + 1 }`);

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('1.2.3');
				expect(result.commitsSinceTag).toBe(3);
				expect(result.lastTag).not.toBeNull();
				expect(result.lastTag?.tag).toBe('v1.2.0');
			}
			finally {
				repo.cleanup();
			}
		});

		it('should calculate prerelease version on feature branch with existing tag', async () => {
			const repo = createTempGitRepo();

			try {
				// Create tag and feature branch
				createTag(repo.path, 'v1.2.0');
				createBranch(repo.path, 'feature/awesome');

				// Add 5 commits on feature branch
				for (let i = 0; i < 5; i++)
					addCommit(repo.path, `Feature commit ${ i + 1 }`);

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('1.2.1-feature-awesome.5');
				expect(result.branch).toBe('feature/awesome');
				expect(result.isMainBranch).toBe(false);
			}
			finally {
				repo.cleanup();
			}
		});

		it('should sanitize branch names in prerelease versions', async () => {
			const repo = createTempGitRepo();

			try {
				createTag(repo.path, 'v1.0.0');
				createBranch(repo.path, 'feature/test@123');

				// Add 2 commits
				addCommit(repo.path, 'Commit 1');
				addCommit(repo.path, 'Commit 2');

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('1.0.1-feature-test-123.2');
			}
			finally {
				repo.cleanup();
			}
		});
	});

	describe('commit message version bumps', () => {
		it('should handle [v:1.0.0] explicit version syntax', async () => {
			const repo = createTempGitRepo();

			try {
				// Add commit with explicit version
				addCommit(repo.path, '[v:1.0.0] Set version to 1.0.0');

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('1.0.0');
				expect(result.commitBumps?.explicitVersion).toBe('1.0.0');
			}
			finally {
				repo.cleanup();
			}
		});

		it('should handle [version:2.5.0] explicit version syntax', async () => {
			const repo = createTempGitRepo();

			try {
				// Add commit with explicit version
				addCommit(repo.path, '[version:2.5.0] Release version 2.5.0');

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('2.5.0');
				expect(result.commitBumps?.explicitVersion).toBe('2.5.0');
			}
			finally {
				repo.cleanup();
			}
		});

		it('should increment patch after explicit version', async () => {
			const repo = createTempGitRepo();

			try {
				// Add commit with explicit version
				addCommit(repo.path, '[v:1.0.0] Set version to 1.0.0');

				// Add 3 more commits
				for (let i = 0; i < 3; i++)
					addCommit(repo.path, `Commit after explicit version ${ i + 1 }`);

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('1.0.3');
				expect(result.commitBumps?.explicitVersion).toBe('1.0.0');
			}
			finally {
				repo.cleanup();
			}
		});

		it('should handle [major] bump', async () => {
			const repo = createTempGitRepo();

			try {
				createTag(repo.path, 'v1.2.0');

				// Add commits with major bump
				addCommit(repo.path, '[major] Breaking change');
				addCommit(repo.path, 'Regular commit 1');
				addCommit(repo.path, 'Regular commit 2');

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('2.0.0');
				expect(result.commitBumps?.major).toBe(1);
			}
			finally {
				repo.cleanup();
			}
		});

		it('should handle [minor] bump', async () => {
			const repo = createTempGitRepo();

			try {
				createTag(repo.path, 'v1.2.0');

				// Add commits with minor bump
				addCommit(repo.path, '[minor] Add new feature');
				addCommit(repo.path, 'Regular commit 1');
				addCommit(repo.path, 'Regular commit 2');

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('1.3.0');
				expect(result.commitBumps?.minor).toBe(1);
			}
			finally {
				repo.cleanup();
			}
		});

		it('should handle [patch] bump', async () => {
			const repo = createTempGitRepo();

			try {
				createTag(repo.path, 'v1.2.0');

				// Add commits with patch bump
				addCommit(repo.path, '[patch] Fix bug');
				addCommit(repo.path, 'Regular commit 1');
				addCommit(repo.path, 'Regular commit 2');

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				expect(result.version).toBe('1.2.1');
				expect(result.commitBumps?.patch).toBe(1);
			}
			finally {
				repo.cleanup();
			}
		});

		it('should use explicit version from commit when tag exists before it', async () => {
			const repo = createTempGitRepo();

			try {
				// Create a tag first
				createTag(repo.path, 'v1.0.0');

				// Then add commit with explicit version (overrides tag)
				addCommit(repo.path, '[v:2.0.0] Jump to 2.0.0');

				// Add more commits
				addCommit(repo.path, 'Commit 1');
				addCommit(repo.path, 'Commit 2');

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				// Should use explicit version from commit, not tag
				expect(result.version).toBe('2.0.2');
				expect(result.commitBumps?.explicitVersion).toBe('2.0.0');
				expect(result.lastTag?.tag).toBe('v1.0.0');
			}
			finally {
				repo.cleanup();
			}
		});

		it('should ignore tags created after explicit version commit', async () => {
			const repo = createTempGitRepo();

			try {
				// Start with explicit version in commit
				addCommit(repo.path, '[v:1.5.0] Set to 1.5.0');

				// Create a tag on same commit (tag takes precedence as it's the "official" version)
				createTag(repo.path, 'v1.0.0');

				// Add more commits
				addCommit(repo.path, 'Commit 1');
				addCommit(repo.path, 'Commit 2');

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				// Tag takes precedence - commits are counted from the tag
				// Explicit version markers only apply to commits AFTER the last tag
				expect(result.version).toBe('1.0.2');
				expect(result.lastTag?.tag).toBe('v1.0.0');
			}
			finally {
				repo.cleanup();
			}
		});

		it('should use most recent explicit version when multiple exist', async () => {
			const repo = createTempGitRepo();

			try {
				// Add multiple explicit versions
				addCommit(repo.path, '[v:1.0.0] First version');
				addCommit(repo.path, 'Regular commit');
				addCommit(repo.path, '[v:2.0.0] Second version');
				addCommit(repo.path, 'Another commit');
				addCommit(repo.path, '[v:3.0.0] Third version');

				// Add commits after
				addCommit(repo.path, 'Commit 1');
				addCommit(repo.path, 'Commit 2');

				const result = await calculateVersion({ cwd: repo.path, mainBranch: 'main', tagPrefix: 'v' });

				// Should use the most recent explicit version (3.0.0) and count commits after
				expect(result.version).toBe('3.0.2');
				expect(result.commitBumps?.explicitVersion).toBe('3.0.0');
			}
			finally {
				repo.cleanup();
			}
		});
	});

	describe('suggestVersionBump', () => {
		it('should suggest major version bump', async () => {
			const repo = createTempGitRepo();

			try {
				createTag(repo.path, 'v1.2.0');

				// Add some commits
				for (let i = 0; i < 3; i++)
					addCommit(repo.path, `Commit ${ i + 1 }`);

				const result = await suggestVersionBump('major', { cwd: repo.path });

				expect(result).toBe('2.0.0');
			}
			finally {
				repo.cleanup();
			}
		});

		it('should suggest minor version bump', async () => {
			const repo = createTempGitRepo();

			try {
				createTag(repo.path, 'v1.2.0');

				// Add some commits
				for (let i = 0; i < 3; i++)
					addCommit(repo.path, `Commit ${ i + 1 }`);

				const result = await suggestVersionBump('minor', { cwd: repo.path });

				expect(result).toBe('1.3.0');
			}
			finally {
				repo.cleanup();
			}
		});

		it('should suggest patch version bump', async () => {
			const repo = createTempGitRepo();

			try {
				createTag(repo.path, 'v1.2.0');

				// Add some commits
				for (let i = 0; i < 3; i++)
					addCommit(repo.path, `Commit ${ i + 1 }`);

				const result = await suggestVersionBump('patch', { cwd: repo.path });

				expect(result).toBe('1.2.1');
			}
			finally {
				repo.cleanup();
			}
		});

		it('should handle no tags', async () => {
			const repo = createTempGitRepo();

			try {
				// Add some commits
				for (let i = 0; i < 4; i++)
					addCommit(repo.path, `Commit ${ i + 1 }`);

				const result = await suggestVersionBump('minor', { cwd: repo.path });

				expect(result).toBe('0.1.0');
			}
			finally {
				repo.cleanup();
			}
		});
	});
});
