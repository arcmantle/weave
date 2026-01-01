import { diff } from './diff-engine.js';
import type { ChangelogStorage } from './storage/interface.js';
import type {
	ChangeGroup,
	ChangeRecord,
	DiffRecord,
	QueryOptions,
} from './types.js';


/**
 * Batch frame for tracking uncommitted changes
 */
interface BatchFrame {
	/** ID of the group this batch belongs to */
	groupId:      string;
	/** Array of changes accumulated during this batch */
	changes:      ChangeRecord[];
	/** Original state before batch started (for rollback) */
	oldState:     any;
	/** Current state being built up during the batch */
	pendingState: any;
}

/**
 * Main changelog class for tracking document changes
 * Supports explicit batching/grouping of changes with hybrid storage
 */
export class Changelog<T = any> {

	private storage:    ChangelogStorage<T>;
	private documentId: string;
	private batchStack: BatchFrame[] = [];

	constructor(storage: ChangelogStorage<T>, documentId: string) {
		if (!documentId || typeof documentId !== 'string')
			throw new Error('documentId must be a non-empty string');

		this.storage = storage;
		this.documentId = documentId;
	}

	/**
	 * Get the current document state directly from storage
	 * @returns The current document state or null if not found
	 */
	async getDocument(): Promise<T | null> {
		return this.storage.loadState(this.documentId);
	}

	/**
	 * Set the current document state
	 * @param state - The new state to save
	 */
	async setDocument(state: T): Promise<void> {
		await this.storage.saveState(this.documentId, state);
	}

	/**
	 * Begin a new change group (batch/transaction)
	 * All changes until commitGroup() will be grouped together
	 * @param metadata - Optional metadata for the group (e.g., author, message)
	 * @returns The group ID
	 */
	async beginGroup(metadata?: Record<string, any>): Promise<string> {
		const groupId = await this.storage.createGroup(this.documentId, metadata);
		const currentState = await this.getDocument();

		let oldState: any;
		let pendingState: any;

		if (currentState !== null) {
			try {
				oldState = structuredClone(currentState);
				pendingState = structuredClone(currentState);
			}
			catch (err: any) {
				throw new Error(
					`Failed to clone current state for document '${ this.documentId }': ${ err.message }. ` +
					'Ensure document state contains only serializable data.',
				);
			}
		}
		else {
			oldState = null;
			pendingState = null;
		}

		this.batchStack.push({
			groupId,
			changes: [],
			oldState,
			pendingState,
		});

		return groupId;
	}

	/**
	 * Commit the current change group
	 * Saves all changes made since beginGroup() to storage
	 */
	async commitGroup(): Promise<void> {
		const frame = this.batchStack.pop();
		if (!frame)
			throw new Error('No active group to commit');

		// Save changes to storage
		if (frame.changes.length > 0) {
			await this.storage.appendChanges(
				this.documentId,
				frame.changes,
				frame.groupId,
			);

			// Update group change count
			await this.storage.updateGroupChangeCount?.(
				this.documentId,
				frame.groupId,
				frame.changes.length,
			);

			// Save the pending state after successfully saving changes
			if (frame.pendingState !== null)
				await this.storage.saveState(this.documentId, frame.pendingState);
		}
	}

	/**
	 * Rollback the current change group
	 * Discards all changes made since beginGroup() and restores old state
	 */
	async rollbackGroup(): Promise<void> {
		const frame = this.batchStack.pop();
		if (!frame)
			throw new Error('No active group to rollback');

		// Restore old state
		if (frame.oldState !== null)
			await this.storage.saveState(this.documentId, frame.oldState);
	}

	/**
	 * Apply changes to the document
	 * If in a batch, changes are tracked; otherwise, a new group is auto-created
	 * @param newState - The new state after changes
	 */
	async applyChanges(newState: T): Promise<void> {
		if (newState === undefined)
			throw new Error('newState cannot be undefined');

		const oldState = await this.getDocument();

		// Compute diff
		const diffs = diff(oldState, newState);
		if (diffs.length === 0)
			return; // No changes

		// Convert diffs to change records
		const changes = this.diffsToChangeRecords(diffs);

		// Check if we're in a batch
		if (this.batchStack.length > 0) {
			const frame = this.batchStack[this.batchStack.length - 1]!;

			// Set groupId on changes before adding to frame
			const changesWithGroup = changes.map((c) => ({
				...c,
				groupId: frame.groupId,
			}));
			frame.changes.push(...changesWithGroup);
			// Update pending state in the frame
			frame.pendingState = newState;
			// Don't save state yet - will be saved on commitGroup
		}
		else {
			// Auto-create and commit a group
			const groupId = await this.storage.createGroup(this.documentId);
			const changesWithGroup = changes.map((c) => ({ ...c, groupId }));
			await this.storage.appendChanges(this.documentId, changesWithGroup, groupId);

			await this.storage.updateGroupChangeCount?.(
				this.documentId,
				groupId,
				changes.length,
			);

			// Save state immediately when not in batch
			await this.storage.saveState(this.documentId, newState);
		}
	}

	/**
	 * Get change history for the document
	 * @param options - Query options (since, limit, groupId)
	 * @returns Array of change records
	 */
	async getHistory(options?: QueryOptions): Promise<ChangeRecord[]> {
		return this.storage.getChanges(this.documentId, options);
	}

	/**
	 * Get changes for a specific group
	 * @param groupId - The group ID to get changes for
	 * @returns Array of change records for that group
	 */
	async getGroupChanges(groupId: string): Promise<ChangeRecord[]> {
		return this.storage.getChanges(this.documentId, { groupId });
	}

	/**
	 * Get all change groups for the document
	 * @returns Array of change groups
	 */
	async getGroups(): Promise<ChangeGroup[]> {
		return this.storage.getGroups(this.documentId);
	}

	/**
	 * Trim old history by removing oldest groups
	 * @param maxGroups - Maximum number of groups to keep
	 */
	async trimHistory(maxGroups: number): Promise<void> {
		await this.storage.trimHistory(this.documentId, maxGroups);
	}

	/**
	 * Clear all data for this document
	 */
	async clear(): Promise<void> {
		await this.storage.clear(this.documentId);
		this.batchStack = [];
	}

	/**
	 * Convert diff records to change records
	 * @private
	 */
	private diffsToChangeRecords(diffs: DiffRecord[]): ChangeRecord[] {
		const timestamp = Date.now();
		const changes: ChangeRecord[] = [];

		for (const diff of diffs) {
			const { path, kind, oldValue, newValue } = diff;

			if (kind === 'removed') {
				changes.push({
					path,
					type:     'delete',
					oldValue,
					newValue: undefined,
					timestamp,
				});
			}
			else {
				// 'added' or 'changed'
				changes.push({
					path,
					type:     'set',
					oldValue: oldValue ?? undefined,
					newValue,
					timestamp,
				});
			}
		}

		return changes;
	}

}
