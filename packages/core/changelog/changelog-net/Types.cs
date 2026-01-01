using System;
using System.Collections.Generic;

namespace Changelog;

/// <summary>
/// Exception thrown when a concurrent update is detected (optimistic concurrency violation)
/// </summary>
public class ConcurrencyException : Exception {
	/// <summary>
	/// The document ID that had the concurrency conflict
	/// </summary>
	public string DocumentId { get; }

	/// <summary>
	/// The version that was expected during the update
	/// </summary>
	public int ExpectedVersion { get; }

	/// <summary>
	/// The actual current version in storage
	/// </summary>
	public int ActualVersion { get; }

	public ConcurrencyException(string documentId, int expectedVersion, int actualVersion)
		: base($"Concurrency conflict detected for document '{documentId}'. Expected version {expectedVersion}, but found version {actualVersion}.") {
		DocumentId = documentId;
		ExpectedVersion = expectedVersion;
		ActualVersion = actualVersion;
	}
}

/// <summary>
/// Represents a single difference between two values at a specific path
/// </summary>
public class DiffRecord {
	/// <summary>
	/// Path to the changed value as an array of keys
	/// Example: ["user", "profile", "name"]
	/// </summary>
	public required string[] Path { get; init; }

	/// <summary>
	/// Type of change that occurred
	/// - Added: A new property/element was added
	/// - Removed: An existing property/element was removed
	/// - Changed: An existing value was modified
	/// </summary>
	public required DiffKind Kind { get; init; }

	/// <summary>
	/// Previous value before the change
	/// Null for 'Added' kind
	/// </summary>
	public object? OldValue { get; init; }

	/// <summary>
	/// New value after the change
	/// Null for 'Removed' kind
	/// </summary>
	public object? NewValue { get; init; }
}

/// <summary>
/// Type of change that occurred
/// </summary>
public enum DiffKind {
	/// <summary>A new property/element was added</summary>
	Added,
	/// <summary>An existing property/element was removed</summary>
	Removed,
	/// <summary>An existing value was modified</summary>
	Changed
}

/// <summary>
/// Represents a single change record in the changelog
/// </summary>
public class ChangeRecord {
	/// <summary>
	/// Path to the changed value as an array of property keys
	/// Example: ["settings", "theme", "color"]
	/// </summary>
	public required string[] Path { get; init; }

	/// <summary>
	/// Type of change operation
	/// - Set: Set or update a value
	/// - Delete: Remove a value
	/// </summary>
	public required ChangeType Type { get; init; }

	/// <summary>
	/// Previous value before the change
	/// </summary>
	public object? OldValue { get; init; }

	/// <summary>
	/// New value after the change
	/// </summary>
	public object? NewValue { get; init; }

	/// <summary>
	/// Timestamp when the change occurred (milliseconds since epoch)
	/// </summary>
	public required long Timestamp { get; init; }

	/// <summary>
	/// ID of the group this change belongs to
	/// Optional - may be null for ungrouped changes
	/// </summary>
	public string? GroupId { get; init; }
}

/// <summary>
/// Type of change operation
/// </summary>
public enum ChangeType {
	/// <summary>Set or update a value</summary>
	Set,
	/// <summary>Remove a value</summary>
	Delete
}

/// <summary>
/// Represents a group of related changes (similar to a git commit)
/// </summary>
public class ChangeGroup {
	/// <summary>
	/// Unique identifier for this group
	/// Example: "g1", "g2", etc.
	/// </summary>
	public required string Id { get; init; }

	/// <summary>
	/// Timestamp when the group was created (milliseconds since epoch)
	/// </summary>
	public required long Timestamp { get; init; }

	/// <summary>
	/// Number of changes in this group
	/// </summary>
	public int ChangeCount { get; set; }

	/// <summary>
	/// Flexible metadata for user-defined properties
	/// Example: { "author": "user@example.com", "message": "Updated user profile" }
	/// </summary>
	public Dictionary<string, object>? Metadata { get; init; }
}

/// <summary>
/// Represents the current state of a document
/// </summary>
public class DocumentState<T> {
	/// <summary>
	/// Unique identifier for the document
	/// </summary>
	public required string Id { get; init; }

	/// <summary>
	/// Current version number (incremented on each update)
	/// </summary>
	public required int Version { get; init; }

	/// <summary>
	/// The actual document data
	/// </summary>
	public required T Data { get; init; }

	/// <summary>
	/// Timestamp of last update (milliseconds since epoch)
	/// </summary>
	public required long Timestamp { get; init; }
}

/// <summary>
/// Represents a document with version information for optimistic concurrency control
/// </summary>
public class VersionedDocument<T> where T : class {
	/// <summary>
	/// The document data
	/// </summary>
	public required T Document { get; init; }

	/// <summary>
	/// Current version number
	/// </summary>
	public required int Version { get; init; }
}

/// <summary>
/// Options for querying change history
/// </summary>
public class QueryOptions {
	/// <summary>
	/// Only return changes after this timestamp (milliseconds since epoch)
	/// Filters changes with timestamp >= since
	/// </summary>
	public long? Since { get; init; }

	/// <summary>
	/// Maximum number of changes to return
	/// Applied after other filters
	/// </summary>
	public int? Limit { get; init; }

	/// <summary>
	/// Only return changes from this specific group ID
	/// Filters changes with matching groupId
	/// </summary>
	public string? GroupId { get; init; }

	/// <summary>
	/// Number of records to skip (for pagination)
	/// Applied after filtering but before Take
	/// </summary>
	public int? Skip { get; init; }

	/// <summary>
	/// Maximum number of records to return (for pagination)
	/// Alternative to Limit - if both are specified, Take takes precedence
	/// </summary>
	public int? Take { get; init; }
}
