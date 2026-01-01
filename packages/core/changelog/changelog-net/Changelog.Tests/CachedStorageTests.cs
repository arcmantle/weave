using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using Changelog;
using Changelog.Storage;

namespace Changelog.Tests;

public class CachedStorageTests {
	private class TestDocument {
		public string? Name { get; set; }
		public int Counter { get; set; }
	}

	[Fact]
	public void DocumentCache_GetMiss_ReturnsNull() {
		// Arrange
		var cache = new DocumentCache<TestDocument>();

		// Act
		var result = cache.Get("doc-1");

		// Assert
		result.Should().BeNull();
	}

	[Fact]
	public void DocumentCache_SetAndGet_ReturnsDocument() {
		// Arrange
		var cache = new DocumentCache<TestDocument>();
		var doc = new TestDocument { Name = "Alice", Counter = 1 };

		// Act
		cache.Set("doc-1", doc);
		var result = cache.Get("doc-1");

		// Assert
		result.Should().NotBeNull();
		result!.Name.Should().Be("Alice");
		result.Counter.Should().Be(1);
	}

	[Fact]
	public void DocumentCache_Get_ReturnsDeepClone() {
		// Arrange
		var cache = new DocumentCache<TestDocument>();
		var doc = new TestDocument { Name = "Alice", Counter = 1 };
		cache.Set("doc-1", doc);

		// Act
		var result1 = cache.Get("doc-1");
		result1!.Counter = 999;
		var result2 = cache.Get("doc-1");

		// Assert - mutation of result1 should not affect cached value
		result2!.Counter.Should().Be(1);
	}

	[Fact]
	public void DocumentCache_Set_StoresDeepClone() {
		// Arrange
		var cache = new DocumentCache<TestDocument>();
		var doc = new TestDocument { Name = "Alice", Counter = 1 };

		// Act
		cache.Set("doc-1", doc);
		doc.Counter = 999;
		var result = cache.Get("doc-1");

		// Assert - mutation of original should not affect cached value
		result!.Counter.Should().Be(1);
	}

	[Fact]
	public void DocumentCache_LruEviction_EvictsLeastRecentlyUsed() {
		// Arrange
		var cache = new DocumentCache<TestDocument>(capacity: 3);

		// Act
		cache.Set("doc-1", new TestDocument { Name = "Doc1" });
		cache.Set("doc-2", new TestDocument { Name = "Doc2" });
		cache.Set("doc-3", new TestDocument { Name = "Doc3" });

		// Access doc-1 to make it recently used
		cache.Get("doc-1");

		// Add doc-4, should evict doc-2 (least recently used)
		cache.Set("doc-4", new TestDocument { Name = "Doc4" });

		// Assert
		cache.Get("doc-1").Should().NotBeNull(); // Still in cache
		cache.Get("doc-2").Should().BeNull();    // Evicted
		cache.Get("doc-3").Should().NotBeNull(); // Still in cache
		cache.Get("doc-4").Should().NotBeNull(); // Newly added
	}

	[Fact]
	public void DocumentCache_Invalidate_RemovesDocument() {
		// Arrange
		var cache = new DocumentCache<TestDocument>();
		cache.Set("doc-1", new TestDocument { Name = "Alice" });

		// Act
		cache.Invalidate("doc-1");
		var result = cache.Get("doc-1");

		// Assert
		result.Should().BeNull();
	}

	[Fact]
	public void DocumentCache_Clear_RemovesAllDocuments() {
		// Arrange
		var cache = new DocumentCache<TestDocument>();
		cache.Set("doc-1", new TestDocument { Name = "Alice" });
		cache.Set("doc-2", new TestDocument { Name = "Bob" });

		// Act
		cache.Clear();

		// Assert
		cache.Get("doc-1").Should().BeNull();
		cache.Get("doc-2").Should().BeNull();
	}

	[Fact]
	public void DocumentCache_GetStats_ReturnsCorrectStats() {
		// Arrange
		var cache = new DocumentCache<TestDocument>(capacity: 10);
		cache.Set("doc-1", new TestDocument { Name = "Alice" });
		cache.Set("doc-2", new TestDocument { Name = "Bob" });

		// Act
		var stats = cache.GetStats();

		// Assert
		stats.Count.Should().Be(2);
		stats.Capacity.Should().Be(10);
		stats.UtilizationPercent.Should().Be(20.0);
	}

	[Fact]
	public async Task CachedStorage_LoadStateAsync_UsesCache() {
		// Arrange
		var innerStorage = new MemoryStorage<TestDocument>();
		var doc = new TestDocument { Name = "Alice", Counter = 1 };
		await innerStorage.SaveStateAsync("doc-1", doc);

		var cachedStorage = new CachedStorage<TestDocument>(innerStorage);

		// Act - First load should hit storage
		var result1 = await cachedStorage.LoadStateAsync("doc-1");

		// Modify inner storage
		await innerStorage.SaveStateAsync("doc-1", new TestDocument { Name = "Changed", Counter = 999 });

		// Second load should hit cache (not see the change)
		var result2 = await cachedStorage.LoadStateAsync("doc-1");

		// Assert
		result1!.Name.Should().Be("Alice");
		result2!.Name.Should().Be("Alice"); // Cached value, not "Changed"
	}

	[Fact]
	public async Task CachedStorage_SaveStateAsync_InvalidatesCache() {
		// Arrange
		var innerStorage = new MemoryStorage<TestDocument>();
		var cachedStorage = new CachedStorage<TestDocument>(innerStorage);

		await cachedStorage.SaveStateAsync("doc-1", new TestDocument { Name = "Alice" });
		await cachedStorage.LoadStateAsync("doc-1"); // Populate cache

		// Act - Save should invalidate cache
		await cachedStorage.SaveStateAsync("doc-1", new TestDocument { Name = "Bob" });
		var result = await cachedStorage.LoadStateAsync("doc-1");

		// Assert - Should get fresh value from storage
		result!.Name.Should().Be("Bob");
	}

	[Fact]
	public async Task CachedStorage_ClearAsync_InvalidatesCache() {
		// Arrange
		var innerStorage = new MemoryStorage<TestDocument>();
		var cachedStorage = new CachedStorage<TestDocument>(innerStorage);

		await cachedStorage.SaveStateAsync("doc-1", new TestDocument { Name = "Alice" });
		await cachedStorage.LoadStateAsync("doc-1"); // Populate cache

		// Act
		await cachedStorage.ClearAsync("doc-1");
		var result = await cachedStorage.LoadStateAsync("doc-1");

		// Assert
		result.Should().BeNull();
	}

	[Fact]
	public async Task CachedStorage_CommitGroupAsync_InvalidatesCache() {
		// Arrange
		var innerStorage = new MemoryStorage<TestDocument>();
		var cachedStorage = new CachedStorage<TestDocument>(innerStorage);

		await cachedStorage.SaveStateAsync("doc-1", new TestDocument { Name = "Alice" });
		await cachedStorage.LoadStateAsync("doc-1"); // Populate cache

		var groupId = await cachedStorage.CreateGroupAsync("doc-1");
		var changes = new List<ChangeRecord> {
			new() { Path = ["name"], Type = ChangeType.Set, NewValue = "Bob", Timestamp = 1 }
		};

		// Act
		await cachedStorage.CommitGroupAsync("doc-1", groupId, changes, new TestDocument { Name = "Bob" });
		var result = await cachedStorage.LoadStateAsync("doc-1");

		// Assert - Should get fresh value from storage
		result!.Name.Should().Be("Bob");
	}

	[Fact]
	public void CachedStorage_GetCacheStats_ReturnsStats() {
		// Arrange
		var innerStorage = new MemoryStorage<TestDocument>();
		var cachedStorage = new CachedStorage<TestDocument>(innerStorage, cacheCapacity: 50);

		// Act
		var stats = cachedStorage.GetCacheStats();

		// Assert
		stats.Capacity.Should().Be(50);
		stats.Count.Should().Be(0);
	}
}
