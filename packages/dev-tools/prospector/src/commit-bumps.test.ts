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

	it('should bump minor version for feat: commits', () => {
		// Mock: main branch with tag v1.0.0 and 2 feat commits
		mockExecSync
			.mockReturnValueOnce('main' as any) // getCurrentBranch
			.mockReturnValueOnce('abc123' as any) // getCurrentCommit
			.mockReturnValueOnce('v1.0.0' as any) // getVersionTags
			.mockReturnValueOnce('def456' as any) // rev-list for tag
			.mockReturnValueOnce('yes' as any) // merge-base check
			.mockReturnValueOnce('2' as any) // countCommits
			.mockReturnValueOnce('commit1\nfeat: add feature A\n---COMMIT-END---\ncommit2\nfeat: add feature B\n---COMMIT-END---' as any); // getCommitMessages

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		expect(result.version).toBe('1.2.0');
		expect(result.commitBumps.major).toBe(0);
		expect(result.commitBumps.minor).toBe(2);
		expect(result.commitBumps.patch).toBe(0);
	});

	it('should bump major version for BREAKING CHANGE commits', () => {
		// Mock: main branch with tag v1.5.3 and a breaking change
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.5.3' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('1' as any)
			.mockReturnValueOnce('commit1\nBREAKING CHANGE: new API\n---COMMIT-END---' as any);

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		expect(result.version).toBe('2.0.0');
		expect(result.commitBumps.major).toBe(1);
		expect(result.commitBumps.minor).toBe(0);
		expect(result.commitBumps.patch).toBe(0);
	});

	it('should bump patch version for fix: commits', () => {
		// Mock: main branch with tag v2.1.0 and 2 fix commits
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v2.1.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('2' as any)
			.mockReturnValueOnce('commit1\nfix: bug A\n---COMMIT-END---\ncommit2\nfix: bug B\n---COMMIT-END---' as any);

		const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

		expect(result.version).toBe('2.1.2');
		expect(result.commitBumps.patch).toBe(2);
	});

	it('should handle mixed commit types correctly', () => {
		// Mock: tag v1.0.0 with feat, fix, and chore commits
		mockExecSync
			.mockReturnValueOnce('main' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('4' as any)
			.mockReturnValueOnce(
				'commit1\nfeat: feature A\n---COMMIT-END---\n' +
        'commit2\nfix: bug fix\n---COMMIT-END---\n' +
        'commit3\nchore: update deps\n---COMMIT-END---\n' +
        'commit4\nfeat: feature B\n---COMMIT-END---' as any,
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
			.mockReturnValueOnce('commit1\nfeat: feature\n---COMMIT-END---' as any);

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
			.mockReturnValueOnce('commit1\n! major change\n---COMMIT-END---' as any);

		const result = calculateVersion({
			mainBranch:         'main',
			tagPrefix:          'v',
			commitBumpPatterns: {
				major: /^!/,
			},
		});

		expect(result.version).toBe('2.0.0');
		expect(result.commitBumps.major).toBe(1);
	});

	it('should not apply commit bumps on feature branches', () => {
		// Mock: feature branch with feat commits
		mockExecSync
			.mockReturnValueOnce('feature/test' as any)
			.mockReturnValueOnce('abc123' as any)
			.mockReturnValueOnce('v1.0.0' as any)
			.mockReturnValueOnce('def456' as any)
			.mockReturnValueOnce('yes' as any)
			.mockReturnValueOnce('2' as any)
			.mockReturnValueOnce('commit1\nfeat: feature A\n---COMMIT-END---' as any);

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
});
