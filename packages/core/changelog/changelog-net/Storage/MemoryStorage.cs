using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace Changelog.Storage;

/// <summary>
/// In-memory implementation of IChangelogStorage
/// Stores all data in dictionaries - suitable for testing and simple use cases
/// </summary>
public class MemoryStorage<T> : IChangelogStorage<T> where T : class {
	private readonly Dictionary<string, T> _states = [];
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

	public Task SaveStateAsync(string documentId, T state) {
		lock (_lock) {
			try {
				_states[documentId] = DeepClone(state);
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

			if (options?.Limit.HasValue == true)
				filtered = filtered.Take(options.Limit.Value);

			return Task.FromResult(filtered.ToList());
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
