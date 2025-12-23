import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateVersion, suggestVersionBump } from './index.js';

// Mock spawn
vi.mock('node:child_process', () => ({
	spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

// Helper to create a mock child process
function createMockProcess(stdout: string, exitCode = 0) {
	const mockProcess = new EventEmitter() as any;
	mockProcess.stdout = new EventEmitter();
	mockProcess.stderr = new EventEmitter();

	// Simulate async behavior
	setImmediate(() => {
		if (stdout)
			mockProcess.stdout.emit('data', Buffer.from(stdout));

		mockProcess.emit('close', exitCode);
	});

	return mockProcess;
}

describe('Prospector', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('calculateVersion', () => {
		it('should calculate version on main branch with no tags', async () => {
			// Mock: current branch is 'main', no tags, 5 commits total
			mockSpawn
				.mockReturnValueOnce(createMockProcess('main')) // getCurrentBranch
				.mockReturnValueOnce(createMockProcess('abc123')) // getCurrentCommit
				.mockReturnValueOnce(createMockProcess('')) // getVersionTags
				.mockReturnValueOnce(createMockProcess('')) // getCommitsWithBumps
				.mockReturnValueOnce(createMockProcess('5')); // countAllCommits

			const result = await calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

			expect(result.version).toBe('0.0.5');
			expect(result.branch).toBe('main');
			expect(result.isMainBranch).toBe(true);
			expect(result.commitsSinceTag).toBe(5);
			expect(result.lastTag).toBeNull();
		});

		it('should calculate version on feature branch with no tags', async () => {
			// Mock: current branch is 'feature/test', no tags, 3 commits total
			mockSpawn
				.mockReturnValueOnce(createMockProcess('feature/test')) // getCurrentBranch
				.mockReturnValueOnce(createMockProcess('abc123')) // getCurrentCommit
				.mockReturnValueOnce(createMockProcess('')) // getVersionTags
				.mockReturnValueOnce(createMockProcess('3')); // countAllCommits

			const result = await calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

			expect(result.version).toBe('0.0.1-feature-test.3');
			expect(result.branch).toBe('feature/test');
			expect(result.isMainBranch).toBe(false);
		});

		it('should calculate version on main branch with existing tag', async () => {
			// Mock: current branch is 'main', has tag v1.2.0, 3 commits since tag
			mockSpawn
				.mockReturnValueOnce(createMockProcess('main')) // getCurrentBranch
				.mockReturnValueOnce(createMockProcess('abc123')) // getCurrentCommit
				.mockReturnValueOnce(createMockProcess('v1.2.0')) // getVersionTags (tag list)
				.mockReturnValueOnce(createMockProcess('def456 refs/tags/v1.2.0')) // show-ref for tags
				.mockReturnValueOnce(createMockProcess('v1.2.0')) // tag --merged
				.mockReturnValueOnce(createMockProcess('')) // getCommitsWithBumps
				.mockReturnValueOnce(createMockProcess('3')); // countCommits

			const result = await calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

			expect(result.version).toBe('1.2.3');
			expect(result.commitsSinceTag).toBe(3);
			expect(result.lastTag).not.toBeNull();
			expect(result.lastTag?.tag).toBe('v1.2.0');
		});

		it('should calculate prerelease version on feature branch with existing tag', async () => {
			// Mock: current branch is 'feature/awesome', has tag v1.2.0, 5 commits since tag
			mockSpawn
				.mockReturnValueOnce(createMockProcess('feature/awesome')) // getCurrentBranch
				.mockReturnValueOnce(createMockProcess('abc123')) // getCurrentCommit
				.mockReturnValueOnce(createMockProcess('v1.2.0')) // getVersionTags
				.mockReturnValueOnce(createMockProcess('def456 refs/tags/v1.2.0')) // show-ref for tags
				.mockReturnValueOnce(createMockProcess('v1.2.0')) // tag --merged
				.mockReturnValueOnce(createMockProcess('5')); // countCommits

			const result = await calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

			expect(result.version).toBe('1.2.1-feature-awesome.5');
			expect(result.branch).toBe('feature/awesome');
			expect(result.isMainBranch).toBe(false);
		});

		it('should sanitize branch names in prerelease versions', async () => {
			// Mock: branch name with special characters
			mockSpawn
				.mockReturnValueOnce(createMockProcess('feature/test@123')) // getCurrentBranch
				.mockReturnValueOnce(createMockProcess('abc123')) // getCurrentCommit
				.mockReturnValueOnce(createMockProcess('v1.0.0')) // getVersionTags
				.mockReturnValueOnce(createMockProcess('def456 refs/tags/v1.0.0')) // show-ref for tags
				.mockReturnValueOnce(createMockProcess('v1.0.0')) // tag --merged
				.mockReturnValueOnce(createMockProcess('2')); // countCommits

			const result = await calculateVersion({ mainBranch: 'main', tagPrefix: 'v' });

			expect(result.version).toBe('1.0.1-feature-test-123.2');
		});
	});

	describe('suggestVersionBump', () => {
		it('should suggest major version bump', async () => {
			// Mock: current version is 1.2.3
			mockSpawn
				.mockReturnValueOnce(createMockProcess('main'))
				.mockReturnValueOnce(createMockProcess('abc123'))
				.mockReturnValueOnce(createMockProcess('v1.2.0'))
				.mockReturnValueOnce(createMockProcess('def456 refs/tags/v1.2.0'))
				.mockReturnValueOnce(createMockProcess('v1.2.0'))
				.mockReturnValueOnce(createMockProcess(''))
				.mockReturnValueOnce(createMockProcess('3'));

			const result = await suggestVersionBump('major');

			expect(result).toBe('2.0.0');
		});

		it('should suggest minor version bump', async () => {
			// Mock: current version is 1.2.3
			mockSpawn
				.mockReturnValueOnce(createMockProcess('main'))
				.mockReturnValueOnce(createMockProcess('abc123'))
				.mockReturnValueOnce(createMockProcess('v1.2.0'))
				.mockReturnValueOnce(createMockProcess('def456 refs/tags/v1.2.0'))
				.mockReturnValueOnce(createMockProcess('v1.2.0'))
				.mockReturnValueOnce(createMockProcess(''))
				.mockReturnValueOnce(createMockProcess('3'));

			const result = await suggestVersionBump('minor');

			expect(result).toBe('1.3.0');
		});

		it('should suggest patch version bump', async () => {
			// Mock: current version is 1.2.3
			mockSpawn
				.mockReturnValueOnce(createMockProcess('main'))
				.mockReturnValueOnce(createMockProcess('abc123'))
				.mockReturnValueOnce(createMockProcess('v1.2.0'))
				.mockReturnValueOnce(createMockProcess('def456 refs/tags/v1.2.0'))
				.mockReturnValueOnce(createMockProcess('v1.2.0'))
				.mockReturnValueOnce(createMockProcess(''))
				.mockReturnValueOnce(createMockProcess('3'));

			const result = await suggestVersionBump('patch');

			expect(result).toBe('1.2.1');
		});

		it('should handle no tags', async () => {
			// Mock: no tags
			mockSpawn
				.mockReturnValueOnce(createMockProcess('main'))
				.mockReturnValueOnce(createMockProcess('abc123'))
				.mockReturnValueOnce(createMockProcess(''))
				.mockReturnValueOnce(createMockProcess(''))
				.mockReturnValueOnce(createMockProcess('5'));

			const result = await suggestVersionBump('minor');

			expect(result).toBe('0.1.0');
		});
	});
});
