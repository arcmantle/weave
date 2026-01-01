/**
 * Represents a single difference between two values at a specific path
 */
export interface DiffRecord {
	/**
	 * Path to the changed value as an array of keys
	 * @example ['user', 'profile', 'name']
	 */
	path: string[];
	/**
	 * Type of change that occurred
	 * - 'added': A new property/element was added
	 * - 'removed': An existing property/element was removed
	 * - 'changed': An existing value was modified
	 */

	kind: 'added' | 'removed' | 'changed';

	/**
	 * Previous value before the change
	 * @remarks undefined for 'added' kind
	 */
	oldValue?: any;

	/**
	 * New value after the change
	 * @remarks undefined for 'removed' kind
	 */
	newValue?: any;
}

/**
 * Represents a single change record in the changelog
 */
export interface ChangeRecord {
	/**
	 * Path to the changed value as an array of property keys
	 * @example ['settings', 'theme', 'color']
	 */
	path:      string[];
	/**
	 * Type of change operation
	 * - 'set': Set or update a value
	 * - 'delete': Remove a value
	 */
	type:      'set' | 'delete';
	/**
	 * Previous value before the change
	 */
	oldValue:  any;
	/**
	 * New value after the change
	 */
	newValue:  any;
	/**
	 * Timestamp when the change occurred (milliseconds since epoch)
	 */
	timestamp: number;
	/**
	 * ID of the group this change belongs to
	 * @remarks Optional - may be undefined for ungrouped changes
	 */
	groupId?:  string;
}

/**
 * Represents a group of related changes (similar to a git commit)
 */
export interface ChangeGroup {
	/**
	 * Unique identifier for this group
	 * @example 'g1', 'g2', etc.
	 */
	id:          string;
	/**
	 * Timestamp when the group was created (milliseconds since epoch)
	 */
	timestamp:   number;
	/**
	 * Number of changes in this group
	 */
	changeCount: number;
	/**
	 * Flexible metadata for user-defined properties
	 * @example { author: 'user@example.com', message: 'Updated user profile' }
	 */
	metadata?:   Record<string, any>;
}

/**
 * Represents the current state of a document
 */
export interface DocumentState<T = any> {
	/**
	 * Unique identifier for the document
	 */
	id:        string;
	/**
	 * Current version number (incremented on each update)
	 */
	version:   number;
	/**
	 * The actual document data
	 */
	data:      T;
	/**
	 * Timestamp of last update (milliseconds since epoch)
	 */
	timestamp: number;
}

/**
 * Options for querying change history
 */
export interface QueryOptions {
	/**
	 * Only return changes after this timestamp (milliseconds since epoch)
	 * @remarks Filters changes with timestamp >= since
	 */
	since?:   number;
	/**
	 * Maximum number of changes to return
	 * @remarks Applied after other filters
	 */
	limit?:   number;
	/**
	 * Only return changes from this specific group ID
	 * @remarks Filters changes with matching groupId
	 */
	groupId?: string;
}
