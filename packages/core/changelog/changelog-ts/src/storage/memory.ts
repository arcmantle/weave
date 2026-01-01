import type { ChangeGroup, ChangeRecord, QueryOptions } from '../types.js';
import type { ChangelogStorage } from './interface.js';

/**
 * In-memory implementation of ChangelogStorage
 * Stores all data in Maps - suitable for testing and simple use cases
 */
export class MemoryStorage<T = any> implements ChangelogStorage<T> {

	private states:       Map<string, T>              = new Map();
	private changes:      Map<string, ChangeRecord[]> = new Map();
	private groups:       Map<string, ChangeGroup[]>  = new Map();
	private groupCounter: Map<string, number>         = new Map();

	async loadState(documentId: string): Promise<T | null> {
		const state = this.states.get(documentId);
		if (state === undefined)
			return null;

		try {
			return structuredClone(state);
		}
		catch (err: any) {
			throw new Error(
				`Failed to clone state for document '${ documentId }': ${ err.message }. ` +
				'State may have been corrupted.',
			);
		}
	}

	async saveState(documentId: string, state: T): Promise<void> {
		try {
			this.states.set(documentId, structuredClone(state));
		}
		catch (err: any) {
			throw new Error(
				`Failed to clone state for document '${ documentId }': ${ err.message }. ` +
				'Ensure state contains only serializable data (no functions, symbols, DOM nodes, etc.)',
			);
		}
	}

	async appendChanges(
		documentId: string,
		changes: ChangeRecord[],
		groupId: string,
	): Promise<void> {
		const existing = this.changes.get(documentId) ?? [];
		this.changes.set(documentId, [ ...existing, ...changes ]);
	}

	async getChanges(
		documentId: string,
		options?: QueryOptions,
	): Promise<ChangeRecord[]> {
		let records = this.changes.get(documentId) ?? [];

		// Apply filters
		if (options?.since !== undefined)
			records = records.filter((r) => r.timestamp >= options.since!);

		if (options?.groupId !== undefined)
			records = records.filter((r) => r.groupId === options.groupId);

		if (options?.limit !== undefined)
			records = records.slice(0, options.limit);

		return records;
	}

	async createGroup(
		documentId: string,
		metadata?: Record<string, any>,
	): Promise<string> {
		const counter = this.groupCounter.get(documentId) ?? 0;
		const nextCounter = counter + 1;
		this.groupCounter.set(documentId, nextCounter);

		const groupId = `g${ nextCounter }`;
		const group: ChangeGroup = {
			id:          groupId,
			timestamp:   Date.now(),
			changeCount: 0,
			metadata,
		};

		const existing = this.groups.get(documentId) ?? [];
		this.groups.set(documentId, [ ...existing, group ]);

		return groupId;
	}

	async getGroups(documentId: string): Promise<ChangeGroup[]> {
		const groups = this.groups.get(documentId) ?? [];
		try {
			return structuredClone(groups);
		}
		catch (err: any) {
			throw new Error(
				`Failed to clone groups for document '${ documentId }': ${ err.message }`,
			);
		}
	}

	async trimHistory(documentId: string, maxGroups: number): Promise<void> {
		if (maxGroups < 0 || !Number.isInteger(maxGroups))
			throw new Error('maxGroups must be a non-negative integer');

		const groups = this.groups.get(documentId) ?? [];

		if (groups.length <= maxGroups)
			return;

		// Keep only the newest maxGroups
		const toKeep = groups.slice(-maxGroups);
		const groupIdsToKeep = new Set(toKeep.map((g) => g.id));

		// Remove groups
		this.groups.set(documentId, toKeep);

		// Remove changes not in kept groups
		const changes = this.changes.get(documentId) ?? [];
		const filteredChanges = changes.filter((c) => c.groupId ? groupIdsToKeep.has(c.groupId) : true);
		this.changes.set(documentId, filteredChanges);

		// Recalculate change counts for kept groups
		for (const group of toKeep) {
			const groupChangeCount = filteredChanges.filter((c) => c.groupId === group.id).length;
			group.changeCount = groupChangeCount;
		}
	}

	async clear(documentId: string): Promise<void> {
		this.states.delete(documentId);
		this.changes.delete(documentId);
		this.groups.delete(documentId);
		this.groupCounter.delete(documentId);
	}

	/**
	 * Update the change count for a group
	 * @internal
	 */
	async updateGroupChangeCount(
		documentId: string,
		groupId: string,
		count: number,
	): Promise<void> {
		const groups = this.groups.get(documentId) ?? [];
		const group = groups.find((g) => g.id === groupId);
		if (!group)
			return;

		group.changeCount = count;
	}

}
