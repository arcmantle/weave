using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace Changelog.Storage;

/// <summary>
/// LRU cache for documents to reduce serialization overhead
/// Thread-safe implementation with configurable capacity
/// </summary>
public class DocumentCache<T> where T : class {
	private readonly int _capacity;
	private readonly Dictionary<string, LinkedListNode<CacheEntry>> _cache;
	private readonly LinkedList<CacheEntry> _lruList;
	private readonly object _lock = new();

	public DocumentCache(int capacity = 100) {
		if (capacity <= 0)
			throw new ArgumentException("Capacity must be greater than 0", nameof(capacity));

		_capacity = capacity;
		_cache = new Dictionary<string, LinkedListNode<CacheEntry>>(capacity);
		_lruList = new LinkedList<CacheEntry>();
	}

	/// <summary>
	/// Get a cached document by ID
	/// Returns a deep clone to prevent mutations affecting the cache
	/// </summary>
	public T? Get(string documentId) {
		lock (_lock) {
			if (!_cache.TryGetValue(documentId, out var node))
				return null;

			// Move to front (most recently used)
			_lruList.Remove(node);
			_lruList.AddFirst(node);

			// Return deep clone to prevent cache pollution
			return DeepClone(node.Value.Document);
		}
	}

	/// <summary>
	/// Add or update a document in the cache
	/// Stores a deep clone to prevent external mutations
	/// </summary>
	public void Set(string documentId, T document) {
		lock (_lock) {
			// Store clone to prevent cache pollution
			var clone = DeepClone(document);

			if (_cache.TryGetValue(documentId, out var existingNode)) {
				// Update existing entry
				existingNode.Value.Document = clone;
				_lruList.Remove(existingNode);
				_lruList.AddFirst(existingNode);
			}
			else {
				// Add new entry
				if (_cache.Count >= _capacity) {
					// Evict least recently used
					var lruNode = _lruList.Last;
					if (lruNode != null) {
						_cache.Remove(lruNode.Value.DocumentId);
						_lruList.RemoveLast();
					}
				}

				var entry = new CacheEntry { DocumentId = documentId, Document = clone };
				var node = _lruList.AddFirst(entry);
				_cache[documentId] = node;
			}
		}
	}

	/// <summary>
	/// Invalidate (remove) a document from the cache
	/// Call this when a document is modified
	/// </summary>
	public void Invalidate(string documentId) {
		lock (_lock) {
			if (_cache.TryGetValue(documentId, out var node)) {
				_cache.Remove(documentId);
				_lruList.Remove(node);
			}
		}
	}

	/// <summary>
	/// Clear all cached documents
	/// </summary>
	public void Clear() {
		lock (_lock) {
			_cache.Clear();
			_lruList.Clear();
		}
	}

	/// <summary>
	/// Get current cache statistics
	/// </summary>
	public CacheStats GetStats() {
		lock (_lock) {
			return new CacheStats {
				Count = _cache.Count,
				Capacity = _capacity
			};
		}
	}

	private static T DeepClone(T obj) {
		var json = JsonSerializer.Serialize(obj);
		return JsonSerializer.Deserialize<T>(json)
			?? throw new InvalidOperationException("Failed to deserialize cloned object");
	}

	private class CacheEntry {
		public required string DocumentId { get; init; }
		public required T Document { get; set; }
	}
}

/// <summary>
/// Statistics about cache usage
/// </summary>
public class CacheStats {
	/// <summary>Current number of cached documents</summary>
	public int Count { get; init; }

	/// <summary>Maximum cache capacity</summary>
	public int Capacity { get; init; }

	/// <summary>Cache utilization as percentage</summary>
	public double UtilizationPercent => Capacity > 0 ? (Count * 100.0 / Capacity) : 0;
}
