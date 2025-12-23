import { SemVer } from 'semver';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ProspectorCLI } from './cli.ts';


vi.mock('./index.ts', () => ({
	calculateVersion:   vi.fn(),
	suggestVersionBump: vi.fn(),
}));

vi.mock('ora', () => ({
	default: vi.fn(() => ({
		start:   vi.fn().mockReturnThis(),
		succeed: vi.fn().mockReturnThis(),
		fail:    vi.fn().mockReturnThis(),
		text:    '',
	})),
}));

describe('ProspectorCLI', () => {
	let consoleLogSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let processExitSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
			throw new Error(`Process.exit called with code ${ code }`);
		}) as never);
		vi.clearAllMocks();
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		processExitSpy.mockRestore();
	});

	describe('argument parsing', () => {
		test('parses --help flag and exits', () => {
			expect(() => new ProspectorCLI([ '--help' ])).toThrow('Process.exit called with code 0');
			expect(consoleLogSpy).toHaveBeenCalled();
			expect(consoleLogSpy.mock.calls[0]?.[0]).toContain('Prospector - Semver Version Calculator');
		});

		test('parses -h flag and exits', () => {
			expect(() => new ProspectorCLI([ '-h' ])).toThrow('Process.exit called with code 0');
			expect(consoleLogSpy).toHaveBeenCalled();
			expect(consoleLogSpy.mock.calls[0]?.[0]).toContain('Prospector - Semver Version Calculator');
		});

		test('rejects unknown option and exits with error', () => {
			expect(() => new ProspectorCLI([ '--unknown-option' ])).toThrow('Process.exit called with code 1');
			expect(consoleErrorSpy).toHaveBeenCalledWith('Unknown option: --unknown-option');
			expect(consoleErrorSpy).toHaveBeenCalledWith('Use --help for usage information');
		});

		test('parses multiple options together', () => {
			const cli = new ProspectorCLI([
				'-d',
				'/path',
				'-b',
				'main',
				'-p',
				'v',
				'--json',
				'--no-commit-bumps',
				'--show-memory',
			]);
			expect(cli).toBeDefined();
		});
	});

	describe('run method', () => {
		test('runs version calculation successfully', async () => {
			const { calculateVersion } = await import('./index.ts');
			const mockCalculateVersion = vi.mocked(calculateVersion);

			mockCalculateVersion.mockResolvedValue({
				version:         '1.2.3',
				branch:          'main',
				isMainBranch:    true,
				commitsSinceTag: 5,
				currentCommit:   'abc123def456',
				lastTag:         {
					tag:     'v1.2.0',
					version: new SemVer('1.2.0'),
					commit:  'def456abc123',
				},
				commitBumps: { major: 0, minor: 0, patch: 0, explicitVersion: null },
			});

			const cli = new ProspectorCLI([]);
			await cli.run();

			expect(mockCalculateVersion).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith('1.2.3');
		});

		test('handles errors gracefully', async () => {
			const { calculateVersion } = await import('./index.ts');
			const mockCalculateVersion = vi.mocked(calculateVersion);

			mockCalculateVersion.mockRejectedValue(new Error('Git command failed'));

			const cli = new ProspectorCLI([]);

			await expect(cli.run()).rejects.toThrow('Process.exit called with code 1');
			expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', 'Git command failed');
		});
	});
});
