import { execSync } from 'node:child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateVersion } from '../src/index.js';

// Mock execSync
vi.mock('node:child_process', () => ({
	execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('Commit Message Version Bumping', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should bump minor version for [minor] commits', () => {
		// Mock: main branch with tag v1.0.0 and 2 [minor] commits
		mockExecSync
			.mockReturnValueOnce('main' as any) // getCurrentBranch
			.mockReturnValueOnce('abc123' as any) // getCurrentCommit
			.mockReturnValueOnce('v1.0.0' as any) // getVersionTags
			.mockReturnValueOnce('def456' as any) // rev-list for tag
			.mockReturnValueOnce('yes' as any) // merge-base check
			.mockReturnValueOnce('2' as any) // countCommits
			.mockReturnValueOnce('commit1\n[minor] add feature A\n---COMMIT-END---\ncommit2\n[minor] add feature B\n---COMMIT-END---' as any); // getCommitMessages

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		expect(result.version).toBe('1.2.0');
		expect(result.commitBumps.major).toBe(0);
		expect(result.commitBumps.minor).toBe(2);
		expect(result.commitBumps.patch).toBe(0);
	});

	it('should bump major version for [major] commits', () => {
		// Mock: main branch with tag v1.5.3 and a [major] commit
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.5.3' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('1' as any)
			.mockReturnValueOnce('commit1\n[major] new API\n---COMMIT-END---' as any);

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		expect(result.version).toBe('2.0.0');
		expect(result.commitBumps.major).toBe(1);
		expect(result.commitBumps.minor).toBe(0);
		expect(result.commitBumps.patch).toBe(0);
	});

	it('should bump patch version for [patch] commits', () => {
		// Mock: main branch with tag v2.1.0 and 2 [patch] commits
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v2.1.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('2' as any)
			.mockReturnValueOnce('commit1\n[patch] bug A\n---COMMIT-END---\ncommit2\n[patch] bug B\n---COMMIT-END---' as any);

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		expect(result.version).toBe('2.1.2');
		expect(result.commitBumps.patch).toBe(2);
	});

	it('should handle mixed commit types correctly', () => {
		// Mock: tag v1.0.0 with [minor], [patch], and regular commits
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('4' as any)
			.mockReturnValueOnce(
				'commit1\n[minor] feature A\n---COMMIT-END---\n' +
        'commit2\n[patch] bug fix\n---COMMIT-END---\n' +
        'commit3\nupdate deps\n---COMMIT-END---\n' +
        'commit4\n[minor] feature B\n---COMMIT-END---' as any,
			);

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		// Should be 1.2.1: 2 minor bumps reset patch, then 1 patch bump
		expect(result.version).toBe('1.2.1');
		expect(result.commitBumps.minor).toBe(2);
		expect(result.commitBumps.patch).toBe(1);
	});

	it('should fall back to commit count when bumping disabled', () => {
		// Mock: main branch with 3 commits after v1.0.0
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('3' as any)
			.mockReturnValueOnce('commit1\n[minor] feature\n---COMMIT-END---' as any);

		const result = calculateVersion({
			mainBranch:        'main',
			tagPrefix:         'v',
			enableCommitBumps: false,
		});

		// Should use commit count instead of parsing messages
		expect(result.version).toBe('1.0.3');
	});

	it('should support custom commit patterns', () => {
		// Mock: custom patterns using exclamation marks
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('1' as any)
			.mockReturnValueOnce('commit1\n!!! major change\n---COMMIT-END---' as any);

		const result = calculateVersion({
			mainBranch:         'main',
			tagPrefix:          'v',
			commitBumpPatterns: {
				major: /^!!!/,
			},
		});

		expect(result.version).toBe('2.0.0');
		expect(result.commitBumps.major).toBe(1);
	});

	it('should not apply commit bumps on feature branches', () => {
		// Mock: feature branch with [minor] commits
		mockExecSync
			.mockReturnValueOnce('feature/test' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('2' as any)
			.mockReturnValueOnce('commit1\n[minor] feature A\n---COMMIT-END---' as any);

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		// Should use prerelease format, not apply commit bumps
		expect(result.version).toBe('1.0.1-feature-test.2');
		expect(result.commitBumps.major).toBe(0);
		expect(result.commitBumps.minor).toBe(0);
	});

	it('should handle [major], [minor], [patch] syntax', () => {
		// Mock: explicit bump markers
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('3' as any)
			.mockReturnValueOnce(
				'commit1\n[minor] add feature\n---COMMIT-END---\n' +
        'commit2\n[patch] fix bug\n---COMMIT-END---\n' +
        'commit3\n[major] breaking change\n---COMMIT-END---' as any,
			);

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		expect(result.commitBumps.major).toBe(1);
		expect(result.commitBumps.minor).toBe(1);
		expect(result.commitBumps.patch).toBe(1);
		// Major bump should reset minor and patch
		expect(result.version).toBe('2.0.0');
	});

	it('should handle explicit version setting with [version:x.y.z]', () => {
		// Mock: explicit version setting
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('1' as any)
			.mockReturnValueOnce('commit1\n[version:2.5.0] Release 2.5.0\n---COMMIT-END---' as any);

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		expect(result.version).toBe('2.5.0');
		expect(result.commitBumps.explicitVersion).toBe('2.5.0');
	});

	it('should handle explicit version with [v:x.y.z] syntax', () => {
		// Mock: explicit version with short syntax
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('1' as any)
			.mockReturnValueOnce('commit1\n[v:3.1.4] Set to 3.1.4\n---COMMIT-END---' as any);

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		expect(result.version).toBe('3.1.4');
		expect(result.commitBumps.explicitVersion).toBe('3.1.4');
	});

	it('should prioritize explicit version over bump indicators', () => {
		// Mock: both explicit version and bump markers
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('2' as any)
			.mockReturnValueOnce(
				'commit1\n[minor] add feature\n---COMMIT-END---\n' +
        'commit2\n[version:5.0.0] Set to 5.0.0\n---COMMIT-END---' as any,
			);

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		// Explicit version should take precedence
		expect(result.version).toBe('5.0.0');
		expect(result.commitBumps.explicitVersion).toBe('5.0.0');
		expect(result.commitBumps.minor).toBe(1);
	});

	it('should respect maxCommitScan limit for large repositories', () => {
		// Mock: repository with many commits, but we only scan a limited number
		mockExecSync
			.mockReturnValueOnce('main' as any) // getCurrentBranch
			.mockReturnValueOnce('abc123' as any) // getCurrentCommit
			.mockReturnValueOnce('v1.0.0' as any) // getVersionTags - tag list
			.mockReturnValueOnce('def456 refs/tags/v1.0.0' as any) // show-ref for tags
			.mockReturnValueOnce('v1.0.0' as any) // tag --merged
			// With maxCommitScan: 2, git log should be called with -n 2
			// We'll check this by the messages returned
			.mockReturnValueOnce(
				'commit1\x00[major] breaking change\x00\x00' +
				'commit2\x00[minor] add feature\x00\x00' as any,
			) // Only 2 commits fetched due to limit
			.mockReturnValueOnce('1000' as any); // But actual count is 1000

		const result = calculateVersion({
			mainBranch:    'main',
			tagPrefix:     'v',
			maxCommitScan: 2, // Only scan 2 commits
		});

		// Should have accurate commit count (1000)
		expect(result.commitsSinceTag).toBe(1000);
		// But only analyzed 2 commits for bumps
		expect(result.commitBumps.major).toBe(1);
		expect(result.commitBumps.minor).toBe(1);
		// Version calculated from bumps found in the scanned commits
		expect(result.version).toBe('2.0.0');
	});

	it('should handle unlimited scan when maxCommitScan is 0', () => {
		// Mock: scan all commits when maxCommitScan is 0
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456 refs/tags/v1.0.0' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce(
				'commit1\x00[patch] fix\x00\x00' +
				'commit2\x00[minor] feature\x00\x00' +
				'commit3\x00normal commit\x00\x00' as any,
			); // All 3 commits fetched

		const result = calculateVersion({
			mainBranch:    'main',
			tagPrefix:     'v',
			maxCommitScan: 0, // Unlimited
		});

		expect(result.commitsSinceTag).toBe(3);
		expect(result.commitBumps.minor).toBe(1);
		expect(result.commitBumps.patch).toBe(1);
		expect(result.version).toBe('1.1.0');
	});
});
