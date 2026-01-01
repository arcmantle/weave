using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Changelog;

/// <summary>
/// Options for diff computation
/// </summary>
public class DiffOptions {
	/// <summary>
	/// Custom equality function
	/// </summary>
	public Func<object?, object?, string[], bool>? Compare { get; init; }
}

/// <summary>
/// Engine for computing and applying diffs between objects
/// </summary>
public static class DiffEngine {
	/// <summary>
	/// Compute the diff between two values
	/// Returns a list of DiffRecord describing all differences
	/// </summary>
	/// <param name="oldValue">The previous value</param>
	/// <param name="newValue">The new value</param>
	/// <param name="options">Optional diff options</param>
	/// <returns>List of diff records</returns>
	public static List<DiffRecord> Diff(object? oldValue, object? newValue, DiffOptions? options = null) {
		var result = new List<DiffRecord>();
		var seen = new Dictionary<object, object>(ReferenceEqualityComparer.Instance);
		DiffValues(oldValue, newValue, Array.Empty<string>(), result, options ?? new DiffOptions(), seen);
		return result;
	}

	/// <summary>
	/// Apply a diff to a value, producing a new value
	/// Note: This creates a deep clone and applies changes
	/// </summary>
	/// <param name="value">The value to apply the diff to</param>
	/// <param name="diffs">List of diff records to apply</param>
	/// <returns>New value with diffs applied</returns>
	public static object? ApplyDiff(object? value, List<DiffRecord> diffs) {
		// Deep clone the value
		var result = DeepClone(value);

		// Collect array removals for optimized processing
		var arrayRemovals = new Dictionary<IList, List<int>>(ReferenceEqualityComparer.Instance);

		foreach (var diff in diffs) {
			var path = diff.Path;
			var kind = diff.Kind;

			if (path.Length == 0) {
				// Root level change
				if (kind == DiffKind.Changed || kind == DiffKind.Added)
					return diff.NewValue;
				else if (kind == DiffKind.Removed)
					return null;

				continue;
			}

			// Navigate to the parent of the target path
			object? current = result;
			for (int i = 0; i < path.Length - 1; i++) {
				var key = path[i];
				var nextValue = GetValue(current, key);

				if (nextValue == null) {
					// Create intermediate objects/arrays as needed
					var nextKey = path[i + 1];
					var isArrayIndex = int.TryParse(nextKey, out _);
					nextValue = isArrayIndex ? new List<object?>() : new Dictionary<string, object?>();
					SetValue(current, key, nextValue);
				}

				current = nextValue;
			}

			var lastKey = path[^1];

			switch (kind) {
			case DiffKind.Added:
			case DiffKind.Changed:
				SetValue(current, lastKey, diff.NewValue);
				break;
			case DiffKind.Removed:
				if (current is IList list) {
					// Collect for batch removal
					if (!arrayRemovals.ContainsKey(list))
						arrayRemovals[list] = new List<int>();

					arrayRemovals[list].Add(int.Parse(lastKey));
				}
				else {
					RemoveValue(current, lastKey);
				}
				break;
			}
		}

		// Remove array elements in reverse order to maintain indices
		foreach (var (list, indices) in arrayRemovals) {
			var sorted = indices.OrderByDescending(x => x).ToList();
			foreach (var idx in sorted)
				list.RemoveAt(idx);
		}

		return result;
	}

	private static void DiffValues(
		object? a,
		object? b,
		string[] path,
		List<DiffRecord> output,
		DiffOptions options,
		Dictionary<object, object> seen) {
		var equal = options.Compare ?? DefaultEqual;

		// If values are equal, no diff needed
		if (equal(a, b, path))
			return;

		// Handle dictionaries/objects recursively
		if (IsObject(a) && IsObject(b)) {
			var aDict = ToDictionary(a);
			var bDict = ToDictionary(b);

			// Check for circular references
			if (a != null && b != null && seen.TryGetValue(a, out var seenValue) && ReferenceEquals(seenValue, b))
				return;

			if (a != null && b != null)
				seen[a] = b;

			var aKeys = new HashSet<string>(aDict.Keys);
			var bKeys = new HashSet<string>(bDict.Keys);

			// Find removed and changed keys
			foreach (var key in aKeys) {
				var nextPath = path.Append(key).ToArray();
				if (!bKeys.Contains(key)) {
					// Key was removed
					output.Add(new DiffRecord {
						Path = nextPath,
						Kind = DiffKind.Removed,
						OldValue = aDict[key]
					});
				}
				else {
					// Key exists in both, check for changes
					DiffValues(aDict[key], bDict[key], nextPath, output, options, seen);
				}
			}

			// Find added keys
			foreach (var key in bKeys) {
				if (!aKeys.Contains(key)) {
					output.Add(new DiffRecord {
						Path = path.Append(key).ToArray(),
						Kind = DiffKind.Added,
						NewValue = bDict[key]
					});
				}
			}

			return;
		}

		// Handle arrays/lists
		if (a is IList aList && b is IList bList) {
			// Check for circular references
			if (seen.TryGetValue(aList, out var seenValue) && ReferenceEquals(seenValue, bList))
				return;

			seen[aList] = bList;

			var maxLen = Math.Max(aList.Count, bList.Count);
			for (int i = 0; i < maxLen; i++) {
				var nextPath = path.Append(i.ToString()).ToArray();
				if (i >= aList.Count) {
					// Element was added
					output.Add(new DiffRecord {
						Path = nextPath,
						Kind = DiffKind.Added,
						NewValue = bList[i]
					});
				}
				else if (i >= bList.Count) {
					// Element was removed
					output.Add(new DiffRecord {
						Path = nextPath,
						Kind = DiffKind.Removed,
						OldValue = aList[i]
					});
				}
				else {
					// Check for changes
					DiffValues(aList[i], bList[i], nextPath, output, options, seen);
				}
			}

			return;
		}

		// Values are different primitives or incompatible types
		output.Add(new DiffRecord {
			Path = path.ToArray(),
			Kind = DiffKind.Changed,
			OldValue = a,
			NewValue = b
		});
	}

	private static bool DefaultEqual(object? a, object? b, string[] path) {
		return Equals(a, b);
	}

	private static bool IsObject(object? value) {
		if (value == null) return false;
		if (value is string) return false;
		if (value is IList) return false;
		if (value.GetType().IsPrimitive) return false;
		if (value is DateTime) return false;
		if (value is DateTimeOffset) return false;
		if (value is Guid) return false;
		return true;
	}

	private static Dictionary<string, object?> ToDictionary(object? obj) {
		if (obj == null)
			return new Dictionary<string, object?>();

		if (obj is Dictionary<string, object?> dict)
			return dict;

		if (obj is JsonObject jsonObj) {
			var result = new Dictionary<string, object?>();
			foreach (var kvp in jsonObj) {
				result[kvp.Key] = JsonNodeToObject(kvp.Value);
			}
			return result;
		}

		// Use reflection for other objects
		var result2 = new Dictionary<string, object?>();
		var properties = obj.GetType().GetProperties();
		foreach (var prop in properties) {
			// Skip indexed properties (like this[int index])
			if (prop.CanRead && prop.GetIndexParameters().Length == 0)
				result2[prop.Name] = prop.GetValue(obj);
		}
		return result2;
	}

	private static object? JsonNodeToObject(JsonNode? node) {
		if (node == null) return null;

		if (node is JsonValue value) {
			if (value.TryGetValue<string>(out var str)) return str;
			if (value.TryGetValue<long>(out var lng)) return lng;
			if (value.TryGetValue<int>(out var i)) return i;
			if (value.TryGetValue<double>(out var dbl)) return dbl;
			if (value.TryGetValue<bool>(out var b)) return b;
			return value.ToString();
		}

		if (node is JsonObject obj) {
			var dict = new Dictionary<string, object?>();
			foreach (var kvp in obj) {
				dict[kvp.Key] = JsonNodeToObject(kvp.Value);
			}
			return dict;
		}

		if (node is JsonArray arr) {
			var list = new List<object?>();
			foreach (var item in arr) {
				list.Add(JsonNodeToObject(item));
			}
			return list;
		}

		return null;
	}

	private static object? GetValue(object? obj, string key) {
		if (obj == null) return null;

		if (obj is Dictionary<string, object?> dict) {
			dict.TryGetValue(key, out var value);
			return value;
		}

		if (obj is IList list && int.TryParse(key, out var index) && index >= 0 && index < list.Count)
			return list[index];

		var prop = obj.GetType().GetProperty(key);
		return prop?.GetValue(obj);
	}

	private static void SetValue(object? obj, string key, object? value) {
		if (obj == null) return;

		if (obj is Dictionary<string, object?> dict) {
			dict[key] = value;
			return;
		}

		if (obj is IList list && int.TryParse(key, out var index)) {
			while (list.Count <= index)
				list.Add(null);
			list[index] = value;
			return;
		}

		var prop = obj.GetType().GetProperty(key);
		if (prop != null && prop.CanWrite)
			prop.SetValue(obj, value);
	}

	private static void RemoveValue(object? obj, string key) {
		if (obj == null) return;

		if (obj is Dictionary<string, object?> dict) {
			dict.Remove(key);
			return;
		}

		if (obj is IList list && int.TryParse(key, out var index) && index >= 0 && index < list.Count) {
			list.RemoveAt(index);
			return;
		}
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

	private static object? DeepClone(object? value) {
		if (value == null) return null;

		// Use JSON serialization for deep cloning
		var json = JsonSerializer.Serialize(value);

		// If it's a generic list or dictionary, deserialize to the appropriate type
		if (value is IList) {
			var doc = JsonSerializer.Deserialize<JsonDocument>(json);
			return doc!.RootElement.EnumerateArray().Select(JsonElementToObject).ToList();
		}

		if (value is IDictionary) {
			var doc = JsonSerializer.Deserialize<JsonDocument>(json);
			return JsonElementToDictionary(doc!.RootElement);
		}

		return JsonSerializer.Deserialize(json, value.GetType());
	}

	private class ReferenceEqualityComparer : IEqualityComparer<object> {
		public static readonly ReferenceEqualityComparer Instance = new();

		public new bool Equals(object? x, object? y) => ReferenceEquals(x, y);
		public int GetHashCode(object obj) => RuntimeHelpers.GetHashCode(obj);
	}
}
