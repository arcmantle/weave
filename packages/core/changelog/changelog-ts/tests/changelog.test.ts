import { beforeEach, describe, expect, test } from 'vitest';

import { Changelog } from '../src/changelog.js';
import { MemoryStorage } from '../src/storage/memory.js';

describe('Changelog', () => {
	let storage: MemoryStorage;
	let changelog: Changelog;

	beforeEach(() => {
		storage = new MemoryStorage();
		changelog = new Changelog(storage, 'doc-1');
	});

	describe('getDocument / setDocument', () => {
		test('returns null for non-existent document', async () => {
			const doc = await changelog.getDocument();
			expect(doc).toBeNull();
		});

		test('stores and retrieves document state', async () => {
			const state = { name: 'Alice', age: 30 };
			await changelog.setDocument(state);

			const retrieved = await changelog.getDocument();
			expect(retrieved).toEqual(state);
		});

		test('overwrites existing document state', async () => {
			await changelog.setDocument({ name: 'Alice' });
			await changelog.setDocument({ name: 'Bob' });

			const retrieved = await changelog.getDocument();
			expect(retrieved).toEqual({ name: 'Bob' });
		});
	});

	describe('applyChanges', () => {
		test('creates auto-group when not in batch', async () => {
			await changelog.setDocument({ count: 0 });
			await changelog.applyChanges({ count: 1 });

			const history = await changelog.getHistory();
			expect(history.length).toBeGreaterThan(0);
			expect(history[0]?.path).toEqual([ 'count' ]);
		});

		test('tracks changes to document', async () => {
			await changelog.setDocument({ name: 'Alice', age: 30 });
			await changelog.applyChanges({ name: 'Alice', age: 31 });

			const history = await changelog.getHistory();
			expect(history).toHaveLength(1);
			expect(history[0]).toMatchObject({
				path:     [ 'age' ],
				type:     'set',
				oldValue: 30,
				newValue: 31,
			});
		});

		test('does not create changes for identical states', async () => {
			const state = { name: 'Alice' };
			await changelog.setDocument(state);
			await changelog.applyChanges(state);

			const history = await changelog.getHistory();
			expect(history).toHaveLength(0);
		});

		test('tracks multiple property changes', async () => {
			await changelog.setDocument({ a: 1, b: 2 });
			await changelog.applyChanges({ a: 10, b: 20 });

			const history = await changelog.getHistory();
			expect(history).toHaveLength(2);
			expect(history.some((h) => h.path[0] === 'a')).toBe(true);
			expect(history.some((h) => h.path[0] === 'b')).toBe(true);
		});

		test('tracks deep nested changes', async () => {
			await changelog.setDocument({
				user: { profile: { name: 'Alice', age: 30 } },
			});
			await changelog.applyChanges({
				user: { profile: { name: 'Alice', age: 31 } },
			});

			const history = await changelog.getHistory();
			expect(history[0]?.path).toEqual([ 'user', 'profile', 'age' ]);
		});
	});

	describe('explicit batching', () => {
		test('beginGroup creates a new group', async () => {
			const groupId = await changelog.beginGroup();
			expect(groupId).toBeTruthy();
			expect(groupId).toMatch(/^g\d+$/);
		});

		test('beginGroup accepts metadata', async () => {
			await changelog.beginGroup({ author: 'Alice', message: 'Update user' });

			const groups = await changelog.getGroups();
			expect(groups[0]?.metadata).toEqual({
				author:  'Alice',
				message: 'Update user',
			});
		});

		test('commitGroup saves changes', async () => {
			await changelog.setDocument({ count: 0 });

			await changelog.beginGroup();
			await changelog.applyChanges({ count: 1 });
			await changelog.commitGroup();

			const history = await changelog.getHistory();
			expect(history.length).toBeGreaterThan(0);
		});

		test('rollbackGroup discards changes', async () => {
			await changelog.setDocument({ count: 0 });

			await changelog.beginGroup();
			await changelog.applyChanges({ count: 1 });
			await changelog.rollbackGroup();

			const doc = await changelog.getDocument();
			expect(doc).toEqual({ count: 0 }); // State restored

			const history = await changelog.getHistory();
			expect(history).toHaveLength(0); // No changes saved
		});

		test('groups multiple changes together', async () => {
			await changelog.setDocument({ a: 1, b: 2, c: 3 });

			const groupId = await changelog.beginGroup({
				message: 'Batch update',
			});
			await changelog.applyChanges({ a: 10, b: 2, c: 3 });
			await changelog.applyChanges({ a: 10, b: 20, c: 3 });
			await changelog.commitGroup();

			const history = await changelog.getHistory();
			const groupChanges = history.filter((h) => h.groupId === groupId);
			expect(groupChanges.length).toBeGreaterThan(0);
		});

		test('nested batches are not supported (stack-based)', async () => {
			await changelog.setDocument({ count: 0 });

			await changelog.beginGroup();
			await changelog.beginGroup(); // Second group
			await changelog.applyChanges({ count: 1 });
			await changelog.commitGroup(); // Commits second group

			// First group is still active
			await changelog.commitGroup(); // Commits first group

			const groups = await changelog.getGroups();
			expect(groups.length).toBe(2);
		});

		test('throws error when committing without active group', async () => {
			await expect(changelog.commitGroup()).rejects.toThrow(
				'No active group to commit',
			);
		});

		test('throws error when rolling back without active group', async () => {
			await expect(changelog.rollbackGroup()).rejects.toThrow(
				'No active group to rollback',
			);
		});
	});

	describe('getHistory', () => {
		test('returns empty array for no changes', async () => {
			const history = await changelog.getHistory();
			expect(history).toEqual([]);
		});

		test('returns all changes by default', async () => {
			await changelog.setDocument({ a: 1, b: 2 });
			await changelog.applyChanges({ a: 10, b: 2 });
			await changelog.applyChanges({ a: 10, b: 20 });

			const history = await changelog.getHistory();
			expect(history.length).toBeGreaterThanOrEqual(2);
		});

		test('filters by since timestamp', async () => {
			await changelog.setDocument({ count: 0 });
			await changelog.applyChanges({ count: 1 });

			const timestamp = Date.now();
			await new Promise((resolve) => setTimeout(resolve, 10));

			await changelog.applyChanges({ count: 2 });

			const history = await changelog.getHistory({ since: timestamp });
			expect(history.length).toBeGreaterThan(0);
			expect(history.every((h) => h.timestamp >= timestamp)).toBe(true);
		});

		test('limits results with limit option', async () => {
			await changelog.setDocument({ a: 1, b: 2, c: 3 });
			await changelog.applyChanges({ a: 10, b: 20, c: 30 });

			const history = await changelog.getHistory({ limit: 2 });
			expect(history.length).toBeLessThanOrEqual(2);
		});
	});

	describe('getGroups', () => {
		test('returns empty array when no groups exist', async () => {
			const groups = await changelog.getGroups();
			expect(groups).toEqual([]);
		});

		test('returns all groups', async () => {
			await changelog.setDocument({ count: 0 });

			await changelog.beginGroup({ message: 'First' });
			await changelog.applyChanges({ count: 1 });
			await changelog.commitGroup();

			await changelog.beginGroup({ message: 'Second' });
			await changelog.applyChanges({ count: 2 });
			await changelog.commitGroup();

			const groups = await changelog.getGroups();
			expect(groups.length).toBe(2);
		});
	});

	describe('trimHistory', () => {
		test('removes oldest groups when exceeding maxGroups', async () => {
			await changelog.setDocument({ count: 0 });

			// Create 3 groups
			for (let i = 1; i <= 3; i++) {
				await changelog.beginGroup({ message: `Group ${ i }` });
				await changelog.applyChanges({ count: i });
				await changelog.commitGroup();
			}

			// Trim to keep only 2 newest groups
			await changelog.trimHistory(2);

			const groups = await changelog.getGroups();
			expect(groups.length).toBe(2);
			expect(groups[0]?.metadata?.message).toBe('Group 2');
			expect(groups[1]?.metadata?.message).toBe('Group 3');
		});

		test('does nothing when groups are within limit', async () => {
			await changelog.setDocument({ count: 0 });

			await changelog.beginGroup();
			await changelog.applyChanges({ count: 1 });
			await changelog.commitGroup();

			await changelog.trimHistory(10);

			const groups = await changelog.getGroups();
			expect(groups.length).toBe(1);
		});
	});

	describe('clear', () => {
		test('removes all document data', async () => {
			await changelog.setDocument({ name: 'Alice' });
			await changelog.applyChanges({ name: 'Bob' });

			await changelog.clear();

			const doc = await changelog.getDocument();
			const history = await changelog.getHistory();
			const groups = await changelog.getGroups();

			expect(doc).toBeNull();
			expect(history).toEqual([]);
			expect(groups).toEqual([]);
		});

		test('clears active batch stack', async () => {
			await changelog.setDocument({ count: 0 });
			await changelog.beginGroup();

			await changelog.clear();

			// Should not throw since stack was cleared
			await expect(changelog.commitGroup()).rejects.toThrow();
		});
	});
});
