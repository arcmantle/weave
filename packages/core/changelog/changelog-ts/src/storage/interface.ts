import type { ChangeGroup, ChangeRecord, QueryOptions } from '../types.js';

/**
 * Storage interface for changelog
 * Implementations handle persistence of document state and change history
 */
export interface ChangelogStorage<T = any> {
	/**
	 * Load the current state of a document
	 * @param documentId - Unique identifier for the document
	 * @returns The current state or null if not found
	 */
	loadState(documentId: string): Promise<T | null>;

	/**
	 * Save the current state of a document
	 * @param documentId - Unique identifier for the document
	 * @param state - The state to save
	 */
	saveState(documentId: string, state: T): Promise<void>;

	/**
	 * Append changes to the changelog
	 * @param documentId - Unique identifier for the document
	 * @param changes - Array of change records to append
	 * @param groupId - ID of the group these changes belong to
	 */
	appendChanges(
		documentId: string,
		changes: ChangeRecord[],
		groupId: string,
	): Promise<void>;

	/**
	 * Get change history for a document
	 * @param documentId - Unique identifier for the document
	 * @param options - Query options (since, limit)
	 * @returns Array of change records
	 */
	getChanges(
		documentId: string,
		options?: QueryOptions,
	): Promise<ChangeRecord[]>;

	/**
	 * Create a new change group
	 * @param documentId - Unique identifier for the document
	 * @param metadata - Optional metadata for the group
	 * @returns The ID of the created group
	 */
	createGroup(
		documentId: string,
		metadata?: Record<string, any>,
	): Promise<string>;

	/**
	 * Get all change groups for a document
	 * @param documentId - Unique identifier for the document
	 * @returns Array of change groups
	 */
	getGroups(documentId: string): Promise<ChangeGroup[]>;

	/**
	 * Trim old history by removing oldest groups
	 * @param documentId - Unique identifier for the document
	 * @param maxGroups - Maximum number of groups to keep
	 */
	trimHistory(documentId: string, maxGroups: number): Promise<void>;

	/**
	 * Clear all data for a document
	 * @param documentId - Unique identifier for the document
	 */
	clear(documentId: string): Promise<void>;

	/**
	 * Update the change count for a group (optional)
	 * @param documentId - Unique identifier for the document
	 * @param groupId - ID of the group to update
	 * @param count - New change count
	 */
	updateGroupChangeCount?(
		documentId: string,
		groupId: string,
		count: number,
	): Promise<void>;
}
