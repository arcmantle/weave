import { beforeEach, describe, expect, test } from 'vitest';

import { MemoryStorage } from '../src/storage/memory.js';

describe('MemoryStorage', () => {
	let storage: MemoryStorage;

	beforeEach(() => {
		storage = new MemoryStorage();
	});

	describe('loadState / saveState', () => {
		test('returns null for non-existent document', async () => {
			const state = await storage.loadState('doc-1');
			expect(state).toBeNull();
		});

		test('stores and retrieves state', async () => {
			await storage.saveState('doc-1', { name: 'Alice' });
			const state = await storage.loadState('doc-1');
			expect(state).toEqual({ name: 'Alice' });
		});

		test('stores state for multiple documents', async () => {
			await storage.saveState('doc-1', { name: 'Alice' });
			await storage.saveState('doc-2', { name: 'Bob' });

			const state1 = await storage.loadState('doc-1');
			const state2 = await storage.loadState('doc-2');

			expect(state1).toEqual({ name: 'Alice' });
			expect(state2).toEqual({ name: 'Bob' });
		});

		test('creates deep clone of state', async () => {
			const original = { nested: { value: 42 } };
			await storage.saveState('doc-1', original);

			original.nested.value = 100;

			const state = await storage.loadState('doc-1');
			expect(state).toEqual({ nested: { value: 42 } });
		});
	});

	describe('createGroup', () => {
		test('creates group with auto-incrementing ID', async () => {
			const id1 = await storage.createGroup('doc-1');
			const id2 = await storage.createGroup('doc-1');

			expect(id1).toBe('g1');
			expect(id2).toBe('g2');
		});

		test('creates group with metadata', async () => {
			const metadata = { author: 'Alice', message: 'Update' };
			await storage.createGroup('doc-1', metadata);

			const groups = await storage.getGroups('doc-1');
			expect(groups[0]?.metadata).toEqual(metadata);
		});

		test('separate counters for different documents', async () => {
			const id1 = await storage.createGroup('doc-1');
			const id2 = await storage.createGroup('doc-2');

			expect(id1).toBe('g1');
			expect(id2).toBe('g1'); // Counter resets for different document
		});
	});

	describe('appendChanges / getChanges', () => {
		test('returns empty array for no changes', async () => {
			const changes = await storage.getChanges('doc-1');
			expect(changes).toEqual([]);
		});

		test('appends and retrieves changes', async () => {
			const change = {
				path:      [ 'name' ],
				type:      'set' as const,
				oldValue:  'Alice',
				newValue:  'Bob',
				timestamp: Date.now(),
				groupId:   'g1',
			};

			await storage.appendChanges('doc-1', [ change ], 'g1');

			const changes = await storage.getChanges('doc-1');
			expect(changes).toHaveLength(1);
			expect(changes[0]).toMatchObject(change);
		});

		test('appends multiple changes', async () => {
			const changes = [
				{
					path:      [ 'a' ],
					type:      'set' as const,
					oldValue:  1,
					newValue:  10,
					timestamp: Date.now(),
				},
				{
					path:      [ 'b' ],
					type:      'set' as const,
					oldValue:  2,
					newValue:  20,
					timestamp: Date.now(),
				},
			];

			await storage.appendChanges('doc-1', changes, 'g1');

			const retrieved = await storage.getChanges('doc-1');
			expect(retrieved).toHaveLength(2);
		});

		test('filters changes by since timestamp', async () => {
			const timestamp1 = Date.now();
			await storage.appendChanges(
				'doc-1',
				[
					{
						path:      [ 'a' ],
						type:      'set' as const,
						oldValue:  1,
						newValue:  10,
						timestamp: timestamp1,
					},
				],
				'g1',
			);

			const timestamp2 = Date.now() + 100;
			await storage.appendChanges(
				'doc-1',
				[
					{
						path:      [ 'b' ],
						type:      'set' as const,
						oldValue:  2,
						newValue:  20,
						timestamp: timestamp2,
					},
				],
				'g2',
			);

			const changes = await storage.getChanges('doc-1', {
				since: timestamp2,
			});
			expect(changes).toHaveLength(1);
			expect(changes[0]?.path).toEqual([ 'b' ]);
		});

		test('limits results with limit option', async () => {
			const changes = Array.from({ length: 5 }, (_, i) => ({
				path:      [ String(i) ],
				type:      'set' as const,
				oldValue:  i,
				newValue:  i * 10,
				timestamp: Date.now(),
			}));

			await storage.appendChanges('doc-1', changes, 'g1');

			const retrieved = await storage.getChanges('doc-1', { limit: 3 });
			expect(retrieved).toHaveLength(3);
		});
	});

	describe('getGroups', () => {
		test('returns empty array for no groups', async () => {
			const groups = await storage.getGroups('doc-1');
			expect(groups).toEqual([]);
		});

		test('returns all groups for document', async () => {
			await storage.createGroup('doc-1', { message: 'First' });
			await storage.createGroup('doc-1', { message: 'Second' });

			const groups = await storage.getGroups('doc-1');
			expect(groups).toHaveLength(2);
			expect(groups[0]?.metadata?.message).toBe('First');
			expect(groups[1]?.metadata?.message).toBe('Second');
		});

		test('isolates groups by document', async () => {
			await storage.createGroup('doc-1');
			await storage.createGroup('doc-2');

			const groups1 = await storage.getGroups('doc-1');
			const groups2 = await storage.getGroups('doc-2');

			expect(groups1).toHaveLength(1);
			expect(groups2).toHaveLength(1);
		});
	});

	describe('trimHistory', () => {
		test('removes oldest groups', async () => {
			const g1 = await storage.createGroup('doc-1', { message: 'First' });
			const g2 = await storage.createGroup('doc-1', { message: 'Second' });
			const g3 = await storage.createGroup('doc-1', { message: 'Third' });

			await storage.trimHistory('doc-1', 2);

			const groups = await storage.getGroups('doc-1');
			expect(groups).toHaveLength(2);
			expect(groups.map((g) => g.id)).toEqual([ g2, g3 ]);
		});

		test('removes changes from trimmed groups', async () => {
			const g1 = await storage.createGroup('doc-1');
			const g2 = await storage.createGroup('doc-1');

			await storage.appendChanges(
				'doc-1',
				[
					{
						path:      [ 'a' ],
						type:      'set' as const,
						oldValue:  1,
						newValue:  10,
						timestamp: Date.now(),
						groupId:   g1,
					},
				],
				g1,
			);

			await storage.appendChanges(
				'doc-1',
				[
					{
						path:      [ 'b' ],
						type:      'set' as const,
						oldValue:  2,
						newValue:  20,
						timestamp: Date.now(),
						groupId:   g2,
					},
				],
				g2,
			);

			await storage.trimHistory('doc-1', 1);

			const changes = await storage.getChanges('doc-1');
			expect(changes).toHaveLength(1);
			expect(changes[0]?.groupId).toBe(g2);
		});

		test('does nothing when within limit', async () => {
			await storage.createGroup('doc-1');

			await storage.trimHistory('doc-1', 10);

			const groups = await storage.getGroups('doc-1');
			expect(groups).toHaveLength(1);
		});
	});

	describe('clear', () => {
		test('removes all data for document', async () => {
			await storage.saveState('doc-1', { name: 'Alice' });
			await storage.createGroup('doc-1');
			await storage.appendChanges(
				'doc-1',
				[
					{
						path:      [ 'a' ],
						type:      'set' as const,
						oldValue:  1,
						newValue:  10,
						timestamp: Date.now(),
					},
				],
				'g1',
			);

			await storage.clear('doc-1');

			const state = await storage.loadState('doc-1');
			const groups = await storage.getGroups('doc-1');
			const changes = await storage.getChanges('doc-1');

			expect(state).toBeNull();
			expect(groups).toEqual([]);
			expect(changes).toEqual([]);
		});

		test('does not affect other documents', async () => {
			await storage.saveState('doc-1', { name: 'Alice' });
			await storage.saveState('doc-2', { name: 'Bob' });

			await storage.clear('doc-1');

			const state2 = await storage.loadState('doc-2');
			expect(state2).toEqual({ name: 'Bob' });
		});
	});

	describe('updateGroupChangeCount', () => {
		test('updates change count for group', async () => {
			const groupId = await storage.createGroup('doc-1');

			await storage.updateGroupChangeCount('doc-1', groupId, 5);

			const groups = await storage.getGroups('doc-1');
			expect(groups[0]?.changeCount).toBe(5);
		});

		test('handles non-existent group gracefully', async () => {
			await expect(
				storage.updateGroupChangeCount('doc-1', 'non-existent', 5),
			).resolves.toBeUndefined();
		});
	});
});
