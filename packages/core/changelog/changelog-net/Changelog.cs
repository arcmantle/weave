using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Changelog.Storage;

namespace Changelog;

/// <summary>
/// Batch frame for tracking uncommitted changes
/// </summary>
internal class BatchFrame<T> where T : class {
	/// <summary>ID of the group this batch belongs to</summary>
	public required string GroupId { get; init; }

	/// <summary>List of changes accumulated during this batch</summary>
	public List<ChangeRecord> Changes { get; init; } = new();

	/// <summary>Original state before batch started (for rollback)</summary>
	public T? OldState { get; init; }

	/// <summary>Current state being built up during the batch</summary>
	public T? PendingState { get; set; }
}

/// <summary>
/// Main changelog class for tracking document changes
/// Supports explicit batching/grouping of changes with hybrid storage
/// </summary>
public class Changelog<T> where T : class {
	private readonly IChangelogStorage<T> _storage;
	private readonly string _documentId;
	private readonly Stack<BatchFrame<T>> _batchStack = new();

	public Changelog(IChangelogStorage<T> storage, string documentId) {
		if (string.IsNullOrWhiteSpace(documentId))
			throw new ArgumentException("documentId must be a non-empty string", nameof(documentId));

		_storage = storage;
		_documentId = documentId;
	}

	/// <summary>
	/// Get the current document state directly from storage
	/// </summary>
	/// <returns>The current document state or null if not found</returns>
	public async Task<T?> GetDocumentAsync() {
		return await _storage.LoadStateAsync(_documentId);
	}

	/// <summary>
	/// Set the current document state
	/// </summary>
	/// <param name="state">The new state to save</param>
	public async Task SetDocumentAsync(T state) {
		await _storage.SaveStateAsync(_documentId, state);
	}

	/// <summary>
	/// Begin a new change group (batch/transaction)
	/// All changes until CommitGroupAsync() will be grouped together
	/// </summary>
	/// <param name="metadata">Optional metadata for the group (e.g., author, message)</param>
	/// <returns>The group ID</returns>
	public async Task<string> BeginGroupAsync(Dictionary<string, object>? metadata = null) {
		var groupId = await _storage.CreateGroupAsync(_documentId, metadata);
		var currentState = await GetDocumentAsync();

		T? oldState;
		T? pendingState;

		if (currentState != null) {
			try {
				oldState = DeepClone(currentState);
				pendingState = DeepClone(currentState);
			}
			catch (Exception ex) {
				throw new InvalidOperationException(
					$"Failed to clone current state for document '{_documentId}': {ex.Message}. " +
					"Ensure document state contains only serializable data.",
					ex);
			}
		}
		else {
			oldState = null;
			pendingState = null;
		}

		_batchStack.Push(new BatchFrame<T> {
			GroupId = groupId,
			Changes = new List<ChangeRecord>(),
			OldState = oldState,
			PendingState = pendingState
		});

		return groupId;
	}

	/// <summary>
	/// Commit the current change group
	/// Saves all changes made since BeginGroupAsync() to storage
	/// </summary>
	public async Task CommitGroupAsync() {
		if (_batchStack.Count == 0)
			throw new InvalidOperationException("No active group to commit");

		var frame = _batchStack.Pop();

		// Save changes to storage
		if (frame.Changes.Count > 0) {
			await _storage.AppendChangesAsync(_documentId, frame.Changes, frame.GroupId);

			// Update group change count
			await _storage.UpdateGroupChangeCountAsync(_documentId, frame.GroupId, frame.Changes.Count);

			// Save the pending state after successfully saving changes
			if (frame.PendingState != null)
				await _storage.SaveStateAsync(_documentId, frame.PendingState);
		}
	}

	/// <summary>
	/// Rollback the current change group
	/// Discards all changes made since BeginGroupAsync() and restores old state
	/// </summary>
	public async Task RollbackGroupAsync() {
		if (_batchStack.Count == 0)
			throw new InvalidOperationException("No active group to rollback");

		var frame = _batchStack.Pop();

		// Restore old state
		if (frame.OldState != null)
			await _storage.SaveStateAsync(_documentId, frame.OldState);
	}

	/// <summary>
	/// Apply changes to the document
	/// If in a batch, changes are tracked; otherwise, a new group is auto-created
	/// </summary>
	/// <param name="newState">The new state after changes</param>
	public async Task ApplyChangesAsync(T newState) {
		if (newState == null)
			throw new ArgumentNullException(nameof(newState), "newState cannot be null");

		var oldState = await GetDocumentAsync();

		// Compute diff
		var diffs = DiffEngine.Diff(oldState, newState);
		if (diffs.Count == 0)
			return; // No changes

		// Convert diffs to change records
		var changes = DiffsToChangeRecords(diffs);

		// Check if we're in a batch
		if (_batchStack.Count > 0) {
			var frame = _batchStack.Peek();

			// Set groupId on changes before adding to frame
			var changesWithGroup = changes.Select(c => new ChangeRecord {
				Path = c.Path,
				Type = c.Type,
				OldValue = c.OldValue,
				NewValue = c.NewValue,
				Timestamp = c.Timestamp,
				GroupId = frame.GroupId
			}).ToList();

			frame.Changes.AddRange(changesWithGroup);
			// Update pending state in the frame
			frame.PendingState = newState;
			// Don't save state yet - will be saved on CommitGroupAsync
		}
		else {
			// Auto-create and commit a group
			var groupId = await _storage.CreateGroupAsync(_documentId);
			var changesWithGroup = changes.Select(c => new ChangeRecord {
				Path = c.Path,
				Type = c.Type,
				OldValue = c.OldValue,
				NewValue = c.NewValue,
				Timestamp = c.Timestamp,
				GroupId = groupId
			}).ToList();

			await _storage.AppendChangesAsync(_documentId, changesWithGroup, groupId);
			await _storage.UpdateGroupChangeCountAsync(_documentId, groupId, changes.Count);

			// Save state immediately when not in batch
			await _storage.SaveStateAsync(_documentId, newState);
		}
	}

	/// <summary>
	/// Get change history for the document
	/// </summary>
	/// <param name="options">Query options (since, limit, groupId)</param>
	/// <returns>List of change records</returns>
	public async Task<List<ChangeRecord>> GetHistoryAsync(QueryOptions? options = null) {
		return await _storage.GetChangesAsync(_documentId, options);
	}

	/// <summary>
	/// Get changes for a specific group
	/// </summary>
	/// <param name="groupId">The group ID to get changes for</param>
	/// <returns>List of change records for that group</returns>
	public async Task<List<ChangeRecord>> GetGroupChangesAsync(string groupId) {
		return await _storage.GetChangesAsync(_documentId, new QueryOptions { GroupId = groupId });
	}

	/// <summary>
	/// Get all change groups for the document
	/// </summary>
	/// <returns>List of change groups</returns>
	public async Task<List<ChangeGroup>> GetGroupsAsync() {
		return await _storage.GetGroupsAsync(_documentId);
	}

	/// <summary>
	/// Trim old history by removing oldest groups
	/// </summary>
	/// <param name="maxGroups">Maximum number of groups to keep</param>
	public async Task TrimHistoryAsync(int maxGroups) {
		await _storage.TrimHistoryAsync(_documentId, maxGroups);
	}

	/// <summary>
	/// Clear all data for this document
	/// </summary>
	public async Task ClearAsync() {
		await _storage.ClearAsync(_documentId);
		_batchStack.Clear();
	}

	/// <summary>
	/// Convert diff records to change records
	/// </summary>
	private List<ChangeRecord> DiffsToChangeRecords(List<DiffRecord> diffs) {
		var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
		var changes = new List<ChangeRecord>();

		foreach (var diff in diffs) {
			var (path, kind, oldValue, newValue) = (diff.Path, diff.Kind, diff.OldValue, diff.NewValue);

			if (kind == DiffKind.Removed) {
				changes.Add(new ChangeRecord {
					Path = path,
					Type = ChangeType.Delete,
					OldValue = oldValue,
					NewValue = null,
					Timestamp = timestamp
				});
			}
			else {
				// 'Added' or 'Changed'
				changes.Add(new ChangeRecord {
					Path = path,
					Type = ChangeType.Set,
					OldValue = oldValue,
					NewValue = newValue,
					Timestamp = timestamp
				});
			}
		}

		return changes;
	}

	private static T DeepClone(T obj) {
		var json = System.Text.Json.JsonSerializer.Serialize(obj);
		return System.Text.Json.JsonSerializer.Deserialize<T>(json)
			?? throw new InvalidOperationException("Failed to deserialize cloned object");
	}
}
