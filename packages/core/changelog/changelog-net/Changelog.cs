using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Diagnostics.Metrics;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Changelog.Storage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

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
	private readonly ILogger _logger;

	public Changelog(
		IChangelogStorage<T> storage,
		string documentId,
		ILogger<Changelog<T>>? logger = null
	) {
		if (string.IsNullOrWhiteSpace(documentId))
			throw new ArgumentException("documentId must be a non-empty string", nameof(documentId));

		_storage = storage;
		_documentId = documentId;
		_logger = logger ?? NullLogger<Changelog<T>>.Instance;
	}

	/// <summary>
	/// Get the current document state directly from storage
	/// </summary>
	/// <returns>The current document state or null if not found</returns>
	public async Task<T?> GetDocumentAsync() {
		using var logScope = _logger.BeginScope(new Dictionary<string, object> {
			["DocumentId"] = _documentId,
			["Operation"] = "GetDocument",
			["TraceId"] = Activity.Current?.TraceId.ToString() ?? "none"
		});

		_logger.LogDebug("Getting document {DocumentId}", _documentId);

		var stopwatch = Stopwatch.StartNew();
		var tags = new TagList {
		{ ChangelogMetrics.OperationKey, "get_document" },
		{ ChangelogMetrics.DocumentIdKey, _documentId }
	};

		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"GetDocument",
			ActivityKind.Internal
		);

		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
		activity?.SetTag(ChangelogTelemetry.OperationKey, "get_document");

		try {
			var result = await _storage.LoadStateAsync(_documentId);
			activity?.SetStatus(ActivityStatusCode.Ok);

			stopwatch.Stop();
			ChangelogMetrics.OperationCount.Add(1, tags);
			ChangelogMetrics.OperationDuration.Record(stopwatch.ElapsedMilliseconds, tags);

			_logger.LogDebug(
				"Retrieved document {DocumentId} in {DurationMs}ms. Found: {Found}",
				_documentId,
				stopwatch.ElapsedMilliseconds,
				result != null
			);

			return result;
		}
		catch (Exception ex) {
			activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
			RecordException(activity, ex);

			tags.Add(ChangelogMetrics.ErrorTypeKey, ex.GetType().Name);
			ChangelogMetrics.ErrorCount.Add(1, tags);

			_logger.LogError(
				ex,
				"Failed to get document {DocumentId}",
				_documentId
			);
			throw;
		}
	}

	/// <summary>
	/// Set the current document state
	/// </summary>
	/// <param name="state">The new state to save</param>
	public async Task SetDocumentAsync(T state) {
		var stopwatch = Stopwatch.StartNew();
		var tags = new TagList {
			{ ChangelogMetrics.OperationKey, "set_document" },
			{ ChangelogMetrics.DocumentIdKey, _documentId }
		};

		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"SetDocument",
			ActivityKind.Internal
		);

		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
		activity?.SetTag(ChangelogTelemetry.OperationKey, "set_document");

		try {
			await _storage.SaveStateAsync(_documentId, state);
			activity?.SetStatus(ActivityStatusCode.Ok);

			stopwatch.Stop();
			ChangelogMetrics.OperationCount.Add(1, tags);
			ChangelogMetrics.OperationDuration.Record(stopwatch.ElapsedMilliseconds, tags);
		}
		catch (Exception ex) {
			activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
			RecordException(activity, ex);

			tags.Add(ChangelogMetrics.ErrorTypeKey, ex.GetType().Name);
			ChangelogMetrics.ErrorCount.Add(1, tags);
			throw;
		}
	}

	/// <summary>
	/// Begin a new change group (batch/transaction)
	/// All changes until CommitGroupAsync() will be grouped together
	/// </summary>
	/// <param name="metadata">Optional metadata for the group (e.g., author, message)</param>
	/// <returns>The group ID</returns>
	public async Task<string> BeginGroupAsync(Dictionary<string, object>? metadata = null) {
		var stopwatch = Stopwatch.StartNew();
		var tags = new TagList {
			{ ChangelogMetrics.OperationKey, "begin_group" },
			{ ChangelogMetrics.DocumentIdKey, _documentId }
		};

		try {
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

			stopwatch.Stop();
			ChangelogMetrics.OperationCount.Add(1, tags);
			ChangelogMetrics.OperationDuration.Record(stopwatch.ElapsedMilliseconds, tags);
			return groupId;
		}
		catch (Exception ex) {
			tags.Add(ChangelogMetrics.ErrorTypeKey, ex.GetType().Name);
			ChangelogMetrics.ErrorCount.Add(1, tags);
			throw;
		}
	}

	/// <summary>
	/// Commit the current change group
	/// Saves all changes made since BeginGroupAsync() to storage atomically
	/// </summary>
	public async Task CommitGroupAsync() {
		var stopwatch = Stopwatch.StartNew();
		var tags = new TagList {
			{ ChangelogMetrics.OperationKey, "commit_group" },
			{ ChangelogMetrics.DocumentIdKey, _documentId }
		};

		try {
			if (_batchStack.Count == 0)
				throw new InvalidOperationException("No active group to commit");

			var frame = _batchStack.Pop();

			// Atomically commit the group with all changes and state
			if (frame.Changes.Count > 0) {
				await _storage.CommitGroupAsync(_documentId, frame.GroupId, frame.Changes, frame.PendingState);
			}

			stopwatch.Stop();
			ChangelogMetrics.OperationCount.Add(1, tags);
			ChangelogMetrics.ChangeCount.Add(frame.Changes.Count, tags);
			ChangelogMetrics.OperationDuration.Record(stopwatch.ElapsedMilliseconds, tags);
		}
		catch (Exception ex) {
			tags.Add(ChangelogMetrics.ErrorTypeKey, ex.GetType().Name);
			ChangelogMetrics.ErrorCount.Add(1, tags);
			throw;
		}
	}

	/// <summary>
	/// Rollback the current change group
	/// Discards all changes made since BeginGroupAsync() and restores old state
	/// </summary>
	public async Task RollbackGroupAsync() {
		var stopwatch = Stopwatch.StartNew();
		var tags = new TagList {
			{ ChangelogMetrics.OperationKey, "rollback_group" },
			{ ChangelogMetrics.DocumentIdKey, _documentId }
		};

		try {
			if (_batchStack.Count == 0)
				throw new InvalidOperationException("No active group to rollback");

			var frame = _batchStack.Pop();

			// Restore old state
			if (frame.OldState != null)
				await _storage.SaveStateAsync(_documentId, frame.OldState);

			stopwatch.Stop();
			ChangelogMetrics.OperationCount.Add(1, tags);
			ChangelogMetrics.OperationDuration.Record(stopwatch.ElapsedMilliseconds, tags);
		}
		catch (Exception ex) {
			tags.Add(ChangelogMetrics.ErrorTypeKey, ex.GetType().Name);
			ChangelogMetrics.ErrorCount.Add(1, tags);
			throw;
		}
	}

	/// <summary>
	/// Apply changes to the document
	/// If in a batch, changes are tracked; otherwise, a new group is auto-created
	/// </summary>
	/// <param name="newState">The new state after changes</param>
	public async Task ApplyChangesAsync(T newState) {
		var stopwatch = Stopwatch.StartNew();
		var tags = new TagList {
		{ ChangelogMetrics.OperationKey, "apply_changes" },
		{ ChangelogMetrics.DocumentIdKey, _documentId }
	};

		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"ApplyChanges",
			ActivityKind.Internal
		);

		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
		activity?.SetTag(ChangelogTelemetry.OperationKey, "apply_changes");

		if (newState == null)
			throw new ArgumentNullException(nameof(newState), "newState cannot be null");

		try {

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

			activity?.SetTag(ChangelogTelemetry.ChangeCountKey, changes.Count);
			activity?.SetStatus(ActivityStatusCode.Ok);

			stopwatch.Stop();
			ChangelogMetrics.OperationCount.Add(1, tags);
			ChangelogMetrics.ChangeCount.Add(changes.Count, tags);
			ChangelogMetrics.DiffComplexity.Record(diffs.Count, tags);
			ChangelogMetrics.OperationDuration.Record(stopwatch.ElapsedMilliseconds, tags);
		}
		catch (Exception ex) {
			activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
			RecordException(activity, ex);

			tags.Add(ChangelogMetrics.ErrorTypeKey, ex.GetType().Name);
			ChangelogMetrics.ErrorCount.Add(1, tags);
		}
	}

	/// <summary>
	/// Get change history for the document
	/// </summary>
	/// <param name="options">Query options (since, limit, groupId)</param>
	/// <returns>List of change records</returns>
	public async Task<List<ChangeRecord>> GetHistoryAsync(QueryOptions? options = null) {
		var stopwatch = Stopwatch.StartNew();
		var tags = new TagList {
		{ ChangelogMetrics.OperationKey, "get_history" },
		{ ChangelogMetrics.DocumentIdKey, _documentId }
	};

		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"GetHistory",
			ActivityKind.Internal
		);

		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
		activity?.SetTag(ChangelogTelemetry.OperationKey, "get_history");
		if (options?.Skip != null)
			activity?.SetTag(ChangelogTelemetry.QuerySkipKey, options.Skip);
		if (options?.Limit != null)
			activity?.SetTag(ChangelogTelemetry.QueryLimitKey, options.Limit);

		try {
			var result = await _storage.GetChangesAsync(_documentId, options);
			activity?.SetTag(ChangelogTelemetry.ChangeCountKey, result.Count);
			activity?.SetStatus(ActivityStatusCode.Ok);

			stopwatch.Stop();
			ChangelogMetrics.OperationCount.Add(1, tags);
			ChangelogMetrics.HistorySize.Record(result.Count, tags);
			ChangelogMetrics.OperationDuration.Record(stopwatch.ElapsedMilliseconds, tags);

			return result;
		}
		catch (Exception ex) {
			activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
			RecordException(activity, ex);

			tags.Add(ChangelogMetrics.ErrorTypeKey, ex.GetType().Name);
			ChangelogMetrics.ErrorCount.Add(1, tags);
			throw;
		}
	}

	/// <summary>
	/// Stream change history for the document (memory-efficient for large result sets)
	/// </summary>
	/// <param name="options">Query options (since, limit, groupId)</param>
	/// <param name="cancellationToken">Cancellation token</param>
	/// <returns>Async stream of change records</returns>
	public async IAsyncEnumerable<ChangeRecord> GetHistoryStreamAsync(
		QueryOptions? options = null,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"GetHistoryStream",
			ActivityKind.Internal
		);

		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
		activity?.SetTag(ChangelogTelemetry.OperationKey, "get_history_stream");
		if (options?.Skip != null)
			activity?.SetTag(ChangelogTelemetry.QuerySkipKey, options.Skip);
		if (options?.Limit != null)
			activity?.SetTag(ChangelogTelemetry.QueryLimitKey, options.Limit);

		var count = 0;
		Exception? capturedException = null;

		await foreach (var change in _storage.StreamChangesAsync(_documentId, options, cancellationToken).ConfigureAwait(false)) {
			count++;
			yield return change;
		}

		activity?.SetTag(ChangelogTelemetry.ChangeCountKey, count);
		if (capturedException != null) {
			activity?.SetStatus(ActivityStatusCode.Error, capturedException.Message);
			RecordException(activity, capturedException);
		}
		else {
			activity?.SetStatus(ActivityStatusCode.Ok);
		}
	}

	/// <summary>
	/// Get changes for a specific group
	/// </summary>
	/// <param name="groupId">The group ID to get changes for</param>
	/// <returns>List of change records for that group</returns>
	public async Task<List<ChangeRecord>> GetGroupChangesAsync(string groupId) {
		var stopwatch = Stopwatch.StartNew();
		var tags = new TagList {
			{ ChangelogMetrics.OperationKey, "get_group_changes" },
			{ ChangelogMetrics.DocumentIdKey, _documentId }
		};

		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"GetGroupChanges",
			ActivityKind.Internal
		);

		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
		activity?.SetTag(ChangelogTelemetry.GroupIdKey, groupId);
		activity?.SetTag(ChangelogTelemetry.OperationKey, "get_group_changes");

		try {
			var result = await _storage.GetChangesAsync(_documentId, new QueryOptions { GroupId = groupId });
			activity?.SetTag(ChangelogTelemetry.ChangeCountKey, result.Count);
			activity?.SetStatus(ActivityStatusCode.Ok);

			stopwatch.Stop();
			ChangelogMetrics.OperationCount.Add(1, tags);
			ChangelogMetrics.HistorySize.Record(result.Count, tags);
			ChangelogMetrics.OperationDuration.Record(stopwatch.ElapsedMilliseconds, tags);
			return result;
		}
		catch (Exception ex) {
			activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
			RecordException(activity, ex);
			throw;
		}
	}

	/// <summary>
	/// Stream changes for a specific group (memory-efficient for large result sets)
	/// </summary>
	/// <param name="groupId">The group ID to get changes for</param>
	/// <param name="cancellationToken">Cancellation token</param>
	/// <returns>Async stream of change records for that group</returns>
	public async IAsyncEnumerable<ChangeRecord> GetGroupChangesStreamAsync(
		string groupId,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"GetGroupChangesStream",
			ActivityKind.Internal
		);

		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
		activity?.SetTag(ChangelogTelemetry.GroupIdKey, groupId);
		activity?.SetTag(ChangelogTelemetry.OperationKey, "get_group_changes_stream");

		var count = 0;
		Exception? capturedException = null;

		await foreach (var change in _storage.StreamChangesAsync(_documentId, new QueryOptions { GroupId = groupId }, cancellationToken).ConfigureAwait(false)) {
			count++;
			yield return change;
		}

		activity?.SetTag(ChangelogTelemetry.ChangeCountKey, count);
		if (capturedException != null) {
			activity?.SetStatus(ActivityStatusCode.Error, capturedException.Message);
			RecordException(activity, capturedException);
		}
		else {
			activity?.SetStatus(ActivityStatusCode.Ok);
		}
	}

	/// <summary>
	/// Get all change groups for the document
	/// </summary>
	/// <returns>List of change groups</returns>
	public async Task<List<ChangeGroup>> GetGroupsAsync() {
		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"GetGroups",
			ActivityKind.Internal
		);

		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
		activity?.SetTag(ChangelogTelemetry.OperationKey, "get_groups");

		try {
			var result = await _storage.GetGroupsAsync(_documentId);
			activity?.SetTag("changelog.group.count", result.Count);
			activity?.SetStatus(ActivityStatusCode.Ok);
			return result;
		}
		catch (Exception ex) {
			activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
			RecordException(activity, ex);
			throw;
		}
	}

	/// <summary>
	/// Stream all change groups for the document (memory-efficient for large result sets)
	/// </summary>
	/// <param name="cancellationToken">Cancellation token</param>
	/// <returns>Async stream of change groups</returns>
	public async IAsyncEnumerable<ChangeGroup> GetGroupsStreamAsync(
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"GetGroupsStream",
			ActivityKind.Internal
		);

		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
		activity?.SetTag(ChangelogTelemetry.OperationKey, "get_groups_stream");

		var count = 0;
		Exception? capturedException = null;

		await foreach (var group in _storage.StreamGroupsAsync(_documentId, cancellationToken).ConfigureAwait(false)) {
			count++;
			yield return group;
		}

		activity?.SetTag("changelog.group.count", count);
		if (capturedException != null) {
			activity?.SetStatus(ActivityStatusCode.Error, capturedException.Message);
			RecordException(activity, capturedException);
		}
		else {
			activity?.SetStatus(ActivityStatusCode.Ok);
		}
	}

	/// <summary>
	/// Trim old history by removing oldest groups
	/// </summary>
	/// <param name="maxGroups">Maximum number of groups to keep</param>
	public async Task TrimHistoryAsync(int maxGroups) {
		await _storage.TrimHistoryAsync(_documentId, maxGroups);
	}

	/// <summary>
	/// Apply retention policy to manage history growth.
	/// Removes old change groups according to the policy rules.
	/// </summary>
	/// <param name="policy">The retention policy to apply</param>
	public async Task ApplyRetentionPolicyAsync(RetentionPolicy policy) {
		if (policy == null)
			throw new ArgumentNullException(nameof(policy));

		// Get all groups to evaluate
		var allGroups = await _storage.GetGroupsAsync(_documentId);

		if (allGroups.Count == 0)
			return;

		// Calculate how many groups to keep
		int groupsToKeep = allGroups.Count;

		// Apply MaxGroups limit
		if (policy.MaxGroups.HasValue && policy.MaxGroups.Value < groupsToKeep) {
			groupsToKeep = policy.MaxGroups.Value;
		}

		// Apply MaxAge limit
		if (policy.MaxAge.HasValue) {
			var cutoffTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() -
											 (long)policy.MaxAge.Value.TotalMilliseconds;

			// Count groups newer than cutoff
			var recentGroups = allGroups.Count(g => g.Timestamp >= cutoffTime);

			// Use the more restrictive of the two limits (keep fewer groups)
			groupsToKeep = Math.Min(groupsToKeep, recentGroups);
		}

		// Ensure we respect MinGroups
		groupsToKeep = Math.Max(groupsToKeep, policy.MinGroups);

		// Only trim if we need to reduce the count
		if (groupsToKeep < allGroups.Count) {
			await _storage.TrimHistoryAsync(_documentId, groupsToKeep);
		}
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

	/// <summary>
	/// Helper method to record exceptions in Activity using standard .NET API
	/// </summary>
	private static void RecordException(Activity? activity, Exception ex) {
		if (activity == null) return;

		activity.AddEvent(new ActivityEvent("exception",
			tags: new ActivityTagsCollection {
				{ "exception.type", ex.GetType().FullName },
				{ "exception.message", ex.Message },
				{ "exception.stacktrace", ex.StackTrace }
			}));
	}
}
