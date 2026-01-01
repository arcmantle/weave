using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Changelog.Storage;

/// <summary>
/// Decorator that adds transparent gzip compression to any IChangelogStorage implementation.
/// Compresses OldValue and NewValue fields in change records to reduce storage size.
/// </summary>
public class CompressedStorage<T> : IChangelogStorage<T> where T : class {
	private readonly IChangelogStorage<T> _innerStorage;

	public CompressedStorage(IChangelogStorage<T> innerStorage) {
		_innerStorage = innerStorage ?? throw new ArgumentNullException(nameof(innerStorage));
	}

	public async Task<T?> LoadStateAsync(string documentId) {
		return await _innerStorage.LoadStateAsync(documentId);
	}

	public async Task SaveStateAsync(string documentId, T state) {
		await _innerStorage.SaveStateAsync(documentId, state);
	}

	public async Task SaveVersionedStateAsync(string documentId, T state, int? expectedVersion) {
		await _innerStorage.SaveVersionedStateAsync(documentId, state, expectedVersion);
	}

	public async Task<VersionedDocument<T>?> LoadVersionedStateAsync(string documentId) {
		return await _innerStorage.LoadVersionedStateAsync(documentId);
	}

	public async Task AppendChangesAsync(string documentId, List<ChangeRecord> changes, string groupId) {
		// Compress change values before storing
		var compressedChanges = changes.Select(CompressChange).ToList();
		await _innerStorage.AppendChangesAsync(documentId, compressedChanges, groupId);
	}

	public async Task<List<ChangeRecord>> GetChangesAsync(string documentId, QueryOptions? options = null) {
		var changes = await _innerStorage.GetChangesAsync(documentId, options);

		// Decompress change values after retrieval
		return changes.Select(DecompressChange).ToList();
	}

	public async IAsyncEnumerable<ChangeRecord> StreamChangesAsync(
		string documentId,
		QueryOptions? options = null,
		[EnumeratorCancellation] CancellationToken cancellationToken = default
	) {
		await foreach (var change in _innerStorage.StreamChangesAsync(documentId, options, cancellationToken)) {
			yield return DecompressChange(change);
		}
	}

	public async Task<string> CreateGroupAsync(string documentId, Dictionary<string, object>? metadata = null) {
		return await _innerStorage.CreateGroupAsync(documentId, metadata);
	}

	public async Task<List<ChangeGroup>> GetGroupsAsync(string documentId) {
		return await _innerStorage.GetGroupsAsync(documentId);
	}

	public IAsyncEnumerable<ChangeGroup> StreamGroupsAsync(
		string documentId,
		CancellationToken cancellationToken = default
	) {
		return _innerStorage.StreamGroupsAsync(documentId, cancellationToken);
	}

	public async Task TrimHistoryAsync(string documentId, int maxGroups) {
		await _innerStorage.TrimHistoryAsync(documentId, maxGroups);
	}

	public async Task ClearAsync(string documentId) {
		await _innerStorage.ClearAsync(documentId);
	}

	public async Task UpdateGroupChangeCountAsync(string documentId, string groupId, int count) {
		await _innerStorage.UpdateGroupChangeCountAsync(documentId, groupId, count);
	}

	public async Task CommitGroupAsync(string documentId, string groupId, List<ChangeRecord> changes, T? state) {
		// Compress changes before committing
		var compressedChanges = changes.Select(CompressChange).ToList();
		await _innerStorage.CommitGroupAsync(documentId, groupId, compressedChanges, state);
	}

	/// <summary>
	/// Compress a change record's values.
	/// </summary>
	private ChangeRecord CompressChange(ChangeRecord change) {
		return new ChangeRecord {
			Path = change.Path,
			Type = change.Type,
			OldValue = CompressObjectValue(change.OldValue),
			NewValue = CompressObjectValue(change.NewValue),
			Timestamp = change.Timestamp,
			GroupId = change.GroupId
		};
	}

	/// <summary>
	/// Decompress a change record's values.
	/// </summary>
	private ChangeRecord DecompressChange(ChangeRecord change) {
		return new ChangeRecord {
			Path = change.Path,
			Type = change.Type,
			OldValue = DecompressObjectValue(change.OldValue),
			NewValue = DecompressObjectValue(change.NewValue),
			Timestamp = change.Timestamp,
			GroupId = change.GroupId
		};
	}

	/// <summary>
	/// Compress an object value (converts to string if needed, then compresses).
	/// </summary>
	private object? CompressObjectValue(object? value) {
		if (value == null) {
			return null;
		}

		// If it's already a string, compress it
		if (value is string strValue) {
			return CompressValue(strValue);
		}

		// Otherwise return as-is (non-string objects aren't compressed)
		return value;
	}

	/// <summary>
	/// Decompress an object value.
	/// </summary>
	private object? DecompressObjectValue(object? value) {
		if (value == null) {
			return null;
		}

		// If it's a string, check if it needs decompression
		if (value is string strValue) {
			return DecompressValue(strValue);
		}

		// Otherwise return as-is
		return value;
	}

	/// <summary>
	/// Compress a value if it's larger than a threshold.
	/// </summary>
	private string? CompressValue(string? value) {
		if (string.IsNullOrEmpty(value)) {
			return value;
		}

		// Only compress if value is large enough to benefit (>100 bytes)
		if (value.Length < 100) {
			return value;
		}

		try {
			var compressed = CompressionHelper.Compress(value);
			var base64 = Convert.ToBase64String(compressed);

			// Only use compressed version if it's actually smaller
			// (small values may not compress well)
			if (base64.Length < value.Length) {
				// Prefix with marker to identify compressed values
				return "GZIP:" + base64;
			}
			return value;
		}
		catch {
			// If compression fails, return original
			return value;
		}
	}

	/// <summary>
	/// Decompress a value if it was compressed.
	/// </summary>
	private string? DecompressValue(string? value) {
		if (string.IsNullOrEmpty(value)) {
			return value;
		}

		// Check if value is compressed (has marker prefix)
		if (value.StartsWith("GZIP:")) {
			try {
				var base64 = value.Substring(5); // Remove "GZIP:" prefix
				var compressed = Convert.FromBase64String(base64);
				return CompressionHelper.Decompress(compressed);
			}
			catch {
				// If decompression fails, return original
				// (defensive - shouldn't happen with valid data)
				return value;
			}
		}

		// Not compressed, return as-is
		return value;
	}
}

