import { execSync } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateVersion, suggestVersionBump } from './index.js';

// Mock execSync
vi.mock('node:child_process', () => ({
	execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('Prospector', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('calculateVersion', () => {
		it('should calculate version on main branch with no tags', () => {
			// Mock: current branch is 'main', no tags, 5 commits total
			mockExecSync
				.mockReturnValueOnce('main' as any) // getCurrentBranch
				.mockReturnValueOnce('abc123' as any) // getCurrentCommit
				.mockReturnValueOnce('' as any) // getVersionTags
				.mockReturnValueOnce('5' as any); // countAllCommits

			const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

			expect(result.version).toBe('0.0.5');
			expect(result.branch).toBe('main');
			expect(result.isMainBranch).toBe(true);
			expect(result.commitsSinceTag).toBe(5);
			expect(result.lastTag).toBeNull();
		});

		it('should calculate version on feature branch with no tags', () => {
			// Mock: current branch is 'feature/test', no tags, 3 commits total
			mockExecSync
				.mockReturnValueOnce('feature/test' as any) // getCurrentBranch
				.mockReturnValueOnce('abc123' as any) // getCurrentCommit
				.mockReturnValueOnce('' as any) // getVersionTags
				.mockReturnValueOnce('3' as any); // countAllCommits

			const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

			expect(result.version).toBe('0.0.1-feature-test.3');
			expect(result.branch).toBe('feature/test');
			expect(result.isMainBranch).toBe(false);
		});

		it('should calculate version on main branch with existing tag', () => {
			// Mock: current branch is 'main', has tag v1.2.0, 3 commits since tag
			mockExecSync
				.mockReturnValueOnce('main' as any) // getCurrentBranch
				.mockReturnValueOnce('abc123' as any) // getCurrentCommit
				.mockReturnValueOnce('v1.2.0' as any) // getVersionTags (tag list)
				.mockReturnValueOnce('def456' as any) // rev-list for tag v1.2.0
				.mockReturnValueOnce('yes' as any) // merge-base check
				.mockReturnValueOnce('3' as any); // countCommits

			const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

			expect(result.version).toBe('1.2.3');
			expect(result.commitsSinceTag).toBe(3);
			expect(result.lastTag).not.toBeNull();
			expect(result.lastTag?.tag).toBe('v1.2.0');
		});

		it('should calculate prerelease version on feature branch with existing tag', () => {
			// Mock: current branch is 'feature/awesome', has tag v1.2.0, 5 commits since tag
			mockExecSync
				.mockReturnValueOnce('feature/awesome' as any) // getCurrentBranch
				.mockReturnValueOnce('abc123' as any) // getCurrentCommit
				.mockReturnValueOnce('v1.2.0' as any) // getVersionTags
				.mockReturnValueOnce('def456' as any) // rev-list for tag
				.mockReturnValueOnce('yes' as any) // merge-base check
				.mockReturnValueOnce('5' as any); // countCommits

			const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

			expect(result.version).toBe('1.2.1-feature-awesome.5');
			expect(result.branch).toBe('feature/awesome');
			expect(result.isMainBranch).toBe(false);
		});

		it('should sanitize branch names in prerelease versions', () => {
			// Mock: branch name with special characters
			mockExecSync
				.mockReturnValueOnce('feature/test@123' as any) // getCurrentBranch
				.mockReturnValueOnce('abc123' as any) // getCurrentCommit
				.mockReturnValueOnce('v1.0.0' as any) // getVersionTags
				.mockReturnValueOnce('def456' as any) // rev-list for tag
				.mockReturnValueOnce('yes' as any) // merge-base check
				.mockReturnValueOnce('2' as any); // countCommits

			const result = calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

			expect(result.version).toBe('1.0.1-feature-test-123.2');
		});
	});

	describe('suggestVersionBump', () => {
		it('should suggest major version bump', () => {
			// Mock: current version is 1.2.3
			mockExecSync
				.mockReturnValueOnce('main' as any)
				.mockReturnValueOnce('abc123' as any)
				.mockReturnValueOnce('v1.2.0' as any)
				.mockReturnValueOnce('def456' as any)
				.mockReturnValueOnce('yes' as any)
				.mockReturnValueOnce('3' as any);

			const result = suggestVersionBump('major');

			expect(result).toBe('2.0.0');
		});

		it('should suggest minor version bump', () => {
			// Mock: current version is 1.2.3
			mockExecSync
				.mockReturnValueOnce('main' as any)
				.mockReturnValueOnce('abc123' as any)
				.mockReturnValueOnce('v1.2.0' as any)
				.mockReturnValueOnce('def456' as any)
				.mockReturnValueOnce('yes' as any)
				.mockReturnValueOnce('3' as any);

			const result = suggestVersionBump('minor');

			expect(result).toBe('1.3.0');
		});

		it('should suggest patch version bump', () => {
			// Mock: current version is 1.2.3
			mockExecSync
				.mockReturnValueOnce('main' as any)
				.mockReturnValueOnce('abc123' as any)
				.mockReturnValueOnce('v1.2.0' as any)
				.mockReturnValueOnce('def456' as any)
				.mockReturnValueOnce('yes' as any)
				.mockReturnValueOnce('3' as any);

			const result = suggestVersionBump('patch');

			expect(result).toBe('1.2.1');
		});

		it('should handle no tags', () => {
			// Mock: no tags
			mockExecSync
				.mockReturnValueOnce('main' as any)
				.mockReturnValueOnce('abc123' as any)
				.mockReturnValueOnce('' as any)
				.mockReturnValueOnce('5' as any);

			const result = suggestVersionBump('minor');

			expect(result).toBe('0.1.0');
		});
	});
});
