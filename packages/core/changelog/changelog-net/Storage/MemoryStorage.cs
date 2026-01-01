using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Changelog.Storage;

/// <summary>
/// In-memory implementation of IChangelogStorage
/// Stores all data in dictionaries - suitable for testing and simple use cases
/// </summary>
public class MemoryStorage<T> : IChangelogStorage<T> where T : class {
	private readonly Dictionary<string, T> _states = [];
	private readonly Dictionary<string, int> _versions = [];
	private readonly Dictionary<string, List<ChangeRecord>> _changes = [];
	private readonly Dictionary<string, List<ChangeGroup>> _groups = [];
	private readonly Dictionary<string, int> _groupCounter = [];
	private readonly object _lock = new();

	public Task<T?> LoadStateAsync(string documentId) {
		lock (_lock) {
			if (!_states.TryGetValue(documentId, out var state))
				return Task.FromResult<T?>(null);

			try {
				return Task.FromResult<T?>(DeepClone(state));
			}
			catch (Exception ex) {
				throw new InvalidOperationException(
					$"Failed to clone state for document '{documentId}': {ex.Message}. State may have been corrupted.",
					ex);
			}
		}
	}

	public Task<VersionedDocument<T>?> LoadVersionedStateAsync(string documentId) {
		lock (_lock) {
			if (!_states.TryGetValue(documentId, out var state))
				return Task.FromResult<VersionedDocument<T>?>(null);

			try {
				var version = _versions.GetValueOrDefault(documentId, 1);
				return Task.FromResult<VersionedDocument<T>?>(new VersionedDocument<T> {
					Document = DeepClone(state),
					Version = version
				});
			}
			catch (Exception ex) {
				throw new InvalidOperationException(
					$"Failed to clone state for document '{documentId}': {ex.Message}. State may have been corrupted.",
					ex);
			}
		}
	}

	public Task SaveStateAsync(string documentId, T state) {
		lock (_lock) {
			try {
				_states[documentId] = DeepClone(state);
				_versions[documentId] = _versions.GetValueOrDefault(documentId, 0) + 1;
				return Task.CompletedTask;
			}
			catch (Exception ex) {
				throw new InvalidOperationException(
					$"Failed to clone state for document '{documentId}': {ex.Message}. " +
					"Ensure state contains only serializable data (no functions, delegates, etc.)",
					ex);
			}
		}
	}

	public Task SaveVersionedStateAsync(string documentId, T state, int? expectedVersion) {
		lock (_lock) {
			try {
				if (expectedVersion.HasValue) {
					var currentVersion = _versions.GetValueOrDefault(documentId, 0);
					if (currentVersion != expectedVersion.Value) {
						throw new ConcurrencyException(documentId, expectedVersion.Value, currentVersion);
					}
				}

				_states[documentId] = DeepClone(state);
				_versions[documentId] = _versions.GetValueOrDefault(documentId, 0) + 1;
				return Task.CompletedTask;
			}
			catch (ConcurrencyException) {
				throw;
			}
			catch (Exception ex) {
				throw new InvalidOperationException(
					$"Failed to clone state for document '{documentId}': {ex.Message}. " +
					"Ensure state contains only serializable data (no functions, delegates, etc.)",
					ex);
			}
		}
	}

	public Task AppendChangesAsync(string documentId, List<ChangeRecord> changes, string groupId) {
		lock (_lock) {
			if (!_changes.ContainsKey(documentId))
				_changes[documentId] = [];

			_changes[documentId].AddRange(changes);
			return Task.CompletedTask;
		}
	}

	public Task<List<ChangeRecord>> GetChangesAsync(string documentId, QueryOptions? options = null) {
		lock (_lock) {
			if (!_changes.TryGetValue(documentId, out var records))
				records = [];

			// Apply filters
			IEnumerable<ChangeRecord> filtered = records;

			if (options?.Since.HasValue == true)
				filtered = filtered.Where(r => r.Timestamp >= options.Since.Value);

			if (options?.GroupId != null)
				filtered = filtered.Where(r => r.GroupId == options.GroupId);

			// Apply pagination (Skip/Take takes precedence over Limit)
			if (options?.Skip.HasValue == true)
				filtered = filtered.Skip(options.Skip.Value);

			var limit = options?.Take ?? options?.Limit;
			if (limit.HasValue)
				filtered = filtered.Take(limit.Value);

			return Task.FromResult(filtered.ToList());
		}
	}

	public async IAsyncEnumerable<ChangeRecord> StreamChangesAsync(
		string documentId,
		QueryOptions? options = null,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		List<ChangeRecord> records;
		lock (_lock) {
			if (!_changes.TryGetValue(documentId, out var allRecords))
				allRecords = [];

			// Apply filters
			IEnumerable<ChangeRecord> filtered = allRecords;

			if (options?.Since.HasValue == true)
				filtered = filtered.Where(r => r.Timestamp >= options.Since.Value);

			if (options?.GroupId != null)
				filtered = filtered.Where(r => r.GroupId == options.GroupId);

			// Apply pagination
			if (options?.Skip.HasValue == true)
				filtered = filtered.Skip(options.Skip.Value);

			var limit = options?.Take ?? options?.Limit;
			if (limit.HasValue)
				filtered = filtered.Take(limit.Value);

			records = filtered.ToList();
		}

		// Stream results outside the lock
		foreach (var record in records) {
			cancellationToken.ThrowIfCancellationRequested();
			yield return record;
			await Task.Yield(); // Allow other work to proceed
		}
	}

	public Task<string> CreateGroupAsync(string documentId, Dictionary<string, object>? metadata = null) {
		lock (_lock) {
			var counter = _groupCounter.GetValueOrDefault(documentId, 0);
			var nextCounter = counter + 1;
			_groupCounter[documentId] = nextCounter;

			var groupId = $"g{nextCounter}";
			var group = new ChangeGroup {
				Id = groupId,
				Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
				ChangeCount = 0,
				Metadata = metadata
			};

			if (!_groups.ContainsKey(documentId))
				_groups[documentId] = [];

			_groups[documentId].Add(group);

			return Task.FromResult(groupId);
		}
	}

	public Task<List<ChangeGroup>> GetGroupsAsync(string documentId) {
		lock (_lock) {
			if (!_groups.TryGetValue(documentId, out var groups))
				return Task.FromResult(new List<ChangeGroup>());

			try {
				// Deep clone the groups using our custom deserializer
				var cloned = DeepCloneGroups(groups);
				return Task.FromResult(cloned);
			}
			catch (Exception ex) {
				throw new InvalidOperationException(
					$"Failed to clone groups for document '{documentId}': {ex.Message}",
					ex);
			}
		}
	}

	public async IAsyncEnumerable<ChangeGroup> StreamGroupsAsync(
		string documentId,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		List<ChangeGroup> groups;
		lock (_lock) {
			if (!_groups.TryGetValue(documentId, out var allGroups))
				yield break;

			try {
				groups = DeepCloneGroups(allGroups);
			}
			catch (Exception ex) {
				throw new InvalidOperationException(
					$"Failed to clone groups for document '{documentId}': {ex.Message}",
					ex);
			}
		}

		// Stream results outside the lock
		foreach (var group in groups) {
			cancellationToken.ThrowIfCancellationRequested();
			yield return group;
			await Task.Yield(); // Allow other work to proceed
		}
	}

	public Task TrimHistoryAsync(string documentId, int maxGroups) {
		if (maxGroups < 0)
			throw new ArgumentException("maxGroups must be a non-negative integer", nameof(maxGroups));

		lock (_lock) {
			if (!_groups.TryGetValue(documentId, out var groups))
				return Task.CompletedTask;

			if (groups.Count <= maxGroups)
				return Task.CompletedTask;

			// Keep only the newest maxGroups
			var toKeep = groups.Skip(groups.Count - maxGroups).ToList();
			var groupIdsToKeep = toKeep.Select(g => g.Id).ToHashSet();

			// Remove groups
			_groups[documentId] = toKeep;

			// Remove changes not in kept groups
			if (_changes.TryGetValue(documentId, out var changes)) {
				var filteredChanges = changes
					.Where(c => c.GroupId == null || groupIdsToKeep.Contains(c.GroupId))
					.ToList();
				_changes[documentId] = filteredChanges;

				// Recalculate change counts for kept groups
				foreach (var group in toKeep) {
					var groupChangeCount = filteredChanges.Count(c => c.GroupId == group.Id);
					group.ChangeCount = groupChangeCount;
				}
			}

			return Task.CompletedTask;
		}
	}

	public Task ClearAsync(string documentId) {
		lock (_lock) {
			_states.Remove(documentId);
			_versions.Remove(documentId);
			_changes.Remove(documentId);
			_groups.Remove(documentId);
			_groupCounter.Remove(documentId);
			return Task.CompletedTask;
		}
	}

	public Task UpdateGroupChangeCountAsync(string documentId, string groupId, int count) {
		lock (_lock) {
			if (!_groups.TryGetValue(documentId, out var groups))
				return Task.CompletedTask;

			var group = groups.FirstOrDefault(g => g.Id == groupId);
			if (group != null)
				group.ChangeCount = count;

			return Task.CompletedTask;
		}
	}

	public Task CommitGroupAsync(string documentId, string groupId, List<ChangeRecord> changes, T? state) {
		lock (_lock) {
			try {
				// Atomically perform all operations
				if (changes.Count > 0) {
					// 1. Append changes
					if (!_changes.ContainsKey(documentId))
						_changes[documentId] = [];
					_changes[documentId].AddRange(changes);

					// 2. Update group change count
					if (_groups.TryGetValue(documentId, out var groups)) {
						var group = groups.FirstOrDefault(g => g.Id == groupId);
						if (group != null)
							group.ChangeCount = changes.Count;
					}

					// 3. Save state if provided
					if (state != null) {
						_states[documentId] = DeepClone(state);
						_versions[documentId] = _versions.GetValueOrDefault(documentId, 0) + 1;
					}
				}

				return Task.CompletedTask;
			}
			catch {
				// In MemoryStorage, the lock ensures atomicity
				// If an exception occurs, none of the changes are committed
				throw;
			}
		}
	}

	private T DeepClone(T obj) {
		var json = JsonSerializer.Serialize(obj);
		var doc = JsonSerializer.Deserialize<JsonDocument>(json);

		// Convert back using custom logic to preserve types
		if (typeof(T) == typeof(List<ChangeGroup>)) {
			var groups = new List<ChangeGroup>();
			foreach (var elem in doc!.RootElement.EnumerateArray()) {
				groups.Add(DeserializeChangeGroup(elem));
			}
			return (T)(object)groups;
		}

		return JsonSerializer.Deserialize<T>(json) ?? throw new InvalidOperationException("Failed to deserialize cloned object");
	}

	private static List<ChangeGroup> DeepCloneGroups(List<ChangeGroup> groups) {
		var json = JsonSerializer.Serialize(groups);
		var doc = JsonSerializer.Deserialize<JsonDocument>(json);

		var result = new List<ChangeGroup>();
		foreach (var elem in doc!.RootElement.EnumerateArray()) {
			result.Add(DeserializeChangeGroup(elem));
		}
		return result;
	}

	private static ChangeGroup DeserializeChangeGroup(JsonElement elem) {
		var metadata = elem.TryGetProperty("Metadata", out var metaProp) && metaProp.ValueKind != JsonValueKind.Null
			? JsonElementToDictionary(metaProp)
			: null;

		return new ChangeGroup {
			Id = elem.GetProperty("Id").GetString()!,
			Timestamp = elem.GetProperty("Timestamp").GetInt64(),
			ChangeCount = elem.GetProperty("ChangeCount").GetInt32(),
			Metadata = metadata
		};
	}

	private static Dictionary<string, object> JsonElementToDictionary(JsonElement element) {
		var dict = new Dictionary<string, object>();
		foreach (var prop in element.EnumerateObject()) {
			dict[prop.Name] = JsonElementToObject(prop.Value);
		}
		return dict;
	}

	private static object JsonElementToObject(JsonElement element) {
		return element.ValueKind switch {
			JsonValueKind.String => element.GetString()!,
			JsonValueKind.Number => element.TryGetInt32(out var i) ? i : element.GetDouble(),
			JsonValueKind.True => true,
			JsonValueKind.False => false,
			JsonValueKind.Null => null!,
			JsonValueKind.Array => element.EnumerateArray().Select(JsonElementToObject).ToList(),
			JsonValueKind.Object => JsonElementToDictionary(element),
			_ => element.ToString()!
		};
	}
}
