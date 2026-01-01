using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Changelog.Storage;

/// <summary>
/// Storage interface for changelog
/// Implementations handle persistence of document state and change history
/// </summary>
public interface IChangelogStorage<T> where T : class {
	/// <summary>
	/// Load the current state of a document
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <returns>The current state or null if not found</returns>
	Task<T?> LoadStateAsync(string documentId);

	/// <summary>
	/// Load the current state of a document with version information
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <returns>The current state with version or null if not found</returns>
	Task<VersionedDocument<T>?> LoadVersionedStateAsync(string documentId);

	/// <summary>
	/// Save the current state of a document
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="state">The state to save</param>
	Task SaveStateAsync(string documentId, T state);

	/// <summary>
	/// Save the current state of a document with optimistic concurrency check
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="state">The state to save</param>
	/// <param name="expectedVersion">The expected current version (for optimistic concurrency)</param>
	/// <exception cref="ConcurrencyException">Thrown when version mismatch is detected</exception>
	Task SaveVersionedStateAsync(string documentId, T state, int? expectedVersion);

	/// <summary>
	/// Append changes to the changelog
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="changes">Array of change records to append</param>
	/// <param name="groupId">ID of the group these changes belong to</param>
	Task AppendChangesAsync(string documentId, List<ChangeRecord> changes, string groupId);

	/// <summary>
	/// Get change history for a document
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="options">Query options (since, limit)</param>
	/// <returns>List of change records</returns>
	Task<List<ChangeRecord>> GetChangesAsync(string documentId, QueryOptions? options = null);

	/// <summary>
	/// Stream change history for a document (memory-efficient for large result sets)
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="options">Query options (since, limit)</param>
	/// <param name="cancellationToken">Cancellation token</param>
	/// <returns>Async stream of change records</returns>
	IAsyncEnumerable<ChangeRecord> StreamChangesAsync(
		string documentId,
		QueryOptions? options = null,
		CancellationToken cancellationToken = default
	);

	/// <summary>
	/// Create a new change group
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="metadata">Optional metadata for the group</param>
	/// <returns>The ID of the created group</returns>
	Task<string> CreateGroupAsync(string documentId, Dictionary<string, object>? metadata = null);

	/// <summary>
	/// Get all change groups for a document
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <returns>List of change groups</returns>
	Task<List<ChangeGroup>> GetGroupsAsync(string documentId);

	/// <summary>
	/// Stream all change groups for a document (memory-efficient for large result sets)
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="cancellationToken">Cancellation token</param>
	/// <returns>Async stream of change groups</returns>
	IAsyncEnumerable<ChangeGroup> StreamGroupsAsync(
		string documentId,
		CancellationToken cancellationToken = default
	);

	/// <summary>
	/// Trim old history by removing oldest groups
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="maxGroups">Maximum number of groups to keep</param>
	Task TrimHistoryAsync(string documentId, int maxGroups);

	/// <summary>
	/// Clear all data for a document
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	Task ClearAsync(string documentId);

	/// <summary>
	/// Update the change count for a group
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="groupId">ID of the group to update</param>
	/// <param name="count">New change count</param>
	Task UpdateGroupChangeCountAsync(string documentId, string groupId, int count);

	/// <summary>
	/// Atomically commit a group with its changes and state
	/// Ensures all operations succeed or all fail together
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="groupId">ID of the group to commit</param>
	/// <param name="changes">List of changes to append</param>
	/// <param name="state">New state to save (optional)</param>
	Task CommitGroupAsync(string documentId, string groupId, List<ChangeRecord> changes, T? state);
}
