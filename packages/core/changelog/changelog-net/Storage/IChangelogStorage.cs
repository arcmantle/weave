using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Changelog.Storage;

/// <summary>
/// Storage interface for changelog
/// Implementations handle persistence of document state and change history
/// </summary>
public interface IChangelogStorage<T> {
	/// <summary>
	/// Load the current state of a document
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <returns>The current state or null if not found</returns>
	Task<T?> LoadStateAsync(string documentId);

	/// <summary>
	/// Save the current state of a document
	/// </summary>
	/// <param name="documentId">Unique identifier for the document</param>
	/// <param name="state">The state to save</param>
	Task SaveStateAsync(string documentId, T state);

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
}
