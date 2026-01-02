using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;

namespace Changelog.Storage;

/// <summary>
/// Caching wrapper for IChangelogStorage to reduce deserialization overhead
/// Implements cache-aside pattern with automatic invalidation on writes
/// </summary>
public class CachedStorage<T> : IChangelogStorage<T> where T : class {
	private readonly IChangelogStorage<T> _inner;
	private readonly DocumentCache<T> _cache;

	public CachedStorage(IChangelogStorage<T> inner, int cacheCapacity = 100) {
		_inner = inner ?? throw new ArgumentNullException(nameof(inner));
		_cache = new DocumentCache<T>(cacheCapacity);
	}

	public async Task<T?> LoadStateAsync(string documentId) {
		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"CachedStorage.LoadState",
			ActivityKind.Internal
		);

		activity?.SetTag("storage.type", "cached");
		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, documentId);

		// Try cache first
		var cached = _cache.Get(documentId);
		if (cached != null) {
			activity?.SetTag("cache.hit", true);
			activity?.SetStatus(ActivityStatusCode.Ok);
			return cached;
		}

		// Cache miss - load from storage
		activity?.SetTag("cache.hit", false);
		var state = await _inner.LoadStateAsync(documentId);
		if (state != null) {
			_cache.Set(documentId, state);
		}

		activity?.SetStatus(ActivityStatusCode.Ok);
		return state;
	}

	public async Task<VersionedDocument<T>?> LoadVersionedStateAsync(string documentId) {
		// Note: We could cache versioned documents separately, but for simplicity
		// we'll just delegate to inner storage for versioned reads
		return await _inner.LoadVersionedStateAsync(documentId);
	}

	public async Task SaveStateAsync(string documentId, T state) {
		using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
			"CachedStorage.SaveState",
			ActivityKind.Internal
		);

		activity?.SetTag("storage.type", "cached");
		activity?.SetTag(ChangelogTelemetry.DocumentIdKey, documentId);

		await _inner.SaveStateAsync(documentId, state);
		// Invalidate cache on write
		_cache.Invalidate(documentId);

		activity?.SetStatus(ActivityStatusCode.Ok);
	}

	public async Task SaveVersionedStateAsync(string documentId, T state, int? expectedVersion) {
		await _inner.SaveVersionedStateAsync(documentId, state, expectedVersion);
		// Invalidate cache on write
		_cache.Invalidate(documentId);
	}

	public Task AppendChangesAsync(string documentId, List<ChangeRecord> changes, string groupId) {
		return _inner.AppendChangesAsync(documentId, changes, groupId);
	}

	public Task<List<ChangeRecord>> GetChangesAsync(string documentId, QueryOptions? options = null) {
		return _inner.GetChangesAsync(documentId, options);
	}

	public IAsyncEnumerable<ChangeRecord> StreamChangesAsync(
		string documentId,
		QueryOptions? options = null,
		CancellationToken cancellationToken = default
	) {
		return _inner.StreamChangesAsync(documentId, options, cancellationToken);
	}

	public Task<string> CreateGroupAsync(string documentId, Dictionary<string, object>? metadata = null) {
		return _inner.CreateGroupAsync(documentId, metadata);
	}

	public Task<List<ChangeGroup>> GetGroupsAsync(string documentId) {
		return _inner.GetGroupsAsync(documentId);
	}

	public IAsyncEnumerable<ChangeGroup> StreamGroupsAsync(
		string documentId,
		CancellationToken cancellationToken = default
	) {
		return _inner.StreamGroupsAsync(documentId, cancellationToken);
	}

	public Task TrimHistoryAsync(string documentId, int maxGroups) {
		return _inner.TrimHistoryAsync(documentId, maxGroups);
	}

	public async Task ClearAsync(string documentId) {
		await _inner.ClearAsync(documentId);
		// Invalidate cache on clear
		_cache.Invalidate(documentId);
	}

	public Task UpdateGroupChangeCountAsync(string documentId, string groupId, int count) {
		return _inner.UpdateGroupChangeCountAsync(documentId, groupId, count);
	}

	public async Task CommitGroupAsync(string documentId, string groupId, List<ChangeRecord> changes, T? state) {
		await _inner.CommitGroupAsync(documentId, groupId, changes, state);
		// Invalidate cache on commit
		_cache.Invalidate(documentId);
	}

	/// <summary>
	/// Get cache statistics for monitoring
	/// </summary>
	public CacheStats GetCacheStats() {
		return _cache.GetStats();
	}

	/// <summary>
	/// Clear the entire cache
	/// </summary>
	public void ClearCache() {
		_cache.Clear();
	}
}
