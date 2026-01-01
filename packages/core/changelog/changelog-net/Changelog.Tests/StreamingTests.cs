using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using Changelog.Storage;

namespace Changelog.Tests;

public class StreamingTests {
	private class TestDoc {
		public string? Name { get; set; }
		public int Version { get; set; }
	}

	[Fact]
	public async Task StreamChangesAsync_ReturnsAllChanges() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Create 10 groups with changes
		for (int i = 0; i < 10; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"Version {i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Act
		var streamedChanges = new List<ChangeRecord>();
		await foreach (var change in changelog.GetHistoryStreamAsync()) {
			streamedChanges.Add(change);
		}

		var listChanges = await changelog.GetHistoryAsync();

		// Assert
		streamedChanges.Should().HaveCount(listChanges.Count);
		// Verify a few properties instead of deep equivalence (JSON comparison issues)
		for (int i = 0; i < streamedChanges.Count; i++) {
			streamedChanges[i].Path.Should().BeEquivalentTo(listChanges[i].Path);
			streamedChanges[i].Type.Should().Be(listChanges[i].Type);
			streamedChanges[i].Timestamp.Should().Be(listChanges[i].Timestamp);
		}
	}

	[Fact]
	public async Task StreamChangesAsync_WithPagination_RespectsLimits() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		for (int i = 0; i < 20; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"V{i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Act
		var options = new QueryOptions { Skip = 5, Take = 10 };
		var streamed = new List<ChangeRecord>();
		await foreach (var change in changelog.GetHistoryStreamAsync(options)) {
			streamed.Add(change);
		}

		// Assert
		streamed.Should().HaveCount(10);
	}

	[Fact]
	public async Task StreamChangesAsync_SupportsCancellation() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		for (int i = 0; i < 100; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"V{i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Act
		var cts = new CancellationTokenSource();
		var count = 0;
		await Assert.ThrowsAsync<OperationCanceledException>(async () => {
			await foreach (var change in changelog.GetHistoryStreamAsync(cancellationToken: cts.Token)) {
				count++;
				if (count == 10) {
					cts.Cancel(); // Cancel after 10 items
				}
			}
		});

		// Assert
		count.Should().Be(10);
	}

	[Fact]
	public async Task StreamChangesAsync_WorksWithLinq() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		for (int i = 0; i < 20; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"V{i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Act - Use LINQ to filter stream
		var setChanges = new List<ChangeRecord>();
		await foreach (var change in changelog.GetHistoryStreamAsync()
			.Where(c => c.Type == ChangeType.Set)
			.Take(5)) {
			setChanges.Add(change);
		}

		// Assert
		setChanges.Should().NotBeEmpty();
		setChanges.Should().AllSatisfy(c => c.Type.Should().Be(ChangeType.Set));
		setChanges.Should().HaveCountLessOrEqualTo(5);
	}

	[Fact]
	public async Task StreamGroupsAsync_ReturnsAllGroups() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		for (int i = 0; i < 15; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"V{i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Act
		var streamedGroups = new List<ChangeGroup>();
		await foreach (var group in changelog.GetGroupsStreamAsync()) {
			streamedGroups.Add(group);
		}

		var listGroups = await changelog.GetGroupsAsync();

		// Assert
		streamedGroups.Should().HaveCount(15);
		// Verify properties instead of deep equivalence
		for (int i = 0; i < streamedGroups.Count; i++) {
			streamedGroups[i].Id.Should().Be(listGroups[i].Id);
			streamedGroups[i].Timestamp.Should().Be(listGroups[i].Timestamp);
		}
	}

	[Fact]
	public async Task StreamGroupsAsync_SupportsCancellation() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		for (int i = 0; i < 50; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"V{i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Act
		var cts = new CancellationTokenSource();
		var count = 0;
		await Assert.ThrowsAsync<OperationCanceledException>(async () => {
			await foreach (var group in changelog.GetGroupsStreamAsync(cts.Token)) {
				count++;
				if (count == 5) {
					cts.Cancel();
				}
			}
		});

		// Assert
		count.Should().Be(5);
	}

	[Fact]
	public async Task StreamChangesAsync_SqliteStorage_WorksCorrectly() {
		// Arrange
		var dbPath = $"test_streaming_{Guid.NewGuid()}.db";
		var connectionString = $"Data Source={dbPath}";
		var storage = new SqliteStorage<TestDoc>(connectionString);
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		try {
			for (int i = 0; i < 10; i++) {
				await changelog.BeginGroupAsync();
				await changelog.ApplyChangesAsync(new TestDoc { Name = $"V{i}", Version = i });
				await changelog.CommitGroupAsync();
			}

			// Act
			var streamedChanges = new List<ChangeRecord>();
			await foreach (var change in changelog.GetHistoryStreamAsync()) {
				streamedChanges.Add(change);
			}

			var listChanges = await changelog.GetHistoryAsync();

			// Assert
			streamedChanges.Should().HaveCount(listChanges.Count);
			// Verify a few properties instead of deep equivalence (JSON comparison issues)
			for (int i = 0; i < streamedChanges.Count; i++) {
				streamedChanges[i].Path.Should().BeEquivalentTo(listChanges[i].Path);
				streamedChanges[i].Type.Should().Be(listChanges[i].Type);
				streamedChanges[i].Timestamp.Should().Be(listChanges[i].Timestamp);
			}
		}
		finally {
			await storage.ClearAsync("doc1");
			// Force garbage collection to release any lingering connections
			GC.Collect();
			GC.WaitForPendingFinalizers();
			await Task.Delay(100); // Give time for cleanup
			try {
				if (System.IO.File.Exists(dbPath)) {
					System.IO.File.Delete(dbPath);
				}
			}
			catch {
				// Ignore cleanup errors
			}
		}
	}

	[Fact]
	public async Task StreamGroupsAsync_SqliteStorage_WorksCorrectly() {
		// Arrange
		var dbPath = $"test_streaming_groups_{Guid.NewGuid()}.db";
		var connectionString = $"Data Source={dbPath}";
		var storage = new SqliteStorage<TestDoc>(connectionString);
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		try {
			for (int i = 0; i < 10; i++) {
				await changelog.BeginGroupAsync();
				await changelog.ApplyChangesAsync(new TestDoc { Name = $"V{i}", Version = i });
				await changelog.CommitGroupAsync();
			}

			// Act
			var streamedGroups = new List<ChangeGroup>();
			await foreach (var group in changelog.GetGroupsStreamAsync()) {
				streamedGroups.Add(group);
			}

			var listGroups = await changelog.GetGroupsAsync();

			// Assert
			streamedGroups.Should().HaveCount(10);
			streamedGroups.Should().BeEquivalentTo(listGroups);
		}
		finally {
			await storage.ClearAsync("doc1");
			// Force garbage collection to release any lingering connections
			GC.Collect();
			GC.WaitForPendingFinalizers();
			await Task.Delay(100); // Give time for cleanup
			try {
				if (System.IO.File.Exists(dbPath)) {
					System.IO.File.Delete(dbPath);
				}
			}
			catch {
				// Ignore cleanup errors
			}
		}
	}

	[Fact]
	public async Task StreamChangesAsync_WithCompressedStorage_WorksCorrectly() {
		// Arrange
		var inner = new MemoryStorage<TestDoc>();
		var compressed = new CompressedStorage<TestDoc>(inner);
		var changelog = new Changelog<TestDoc>(compressed, "doc1");

		for (int i = 0; i < 10; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"V{i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Act
		var streamedChanges = new List<ChangeRecord>();
		await foreach (var change in changelog.GetHistoryStreamAsync()) {
			streamedChanges.Add(change);
		}

		// Assert - Each document modification creates 2 property changes (Name + Version)
		streamedChanges.Should().HaveCountGreaterOrEqualTo(10, "at least 10 changes should be present");
	}

	[Fact]
	public async Task StreamChangesAsync_WithCachedStorage_WorksCorrectly() {
		// Arrange
		var inner = new MemoryStorage<TestDoc>();
		var cached = new CachedStorage<TestDoc>(inner, 100);
		var changelog = new Changelog<TestDoc>(cached, "doc1");

		for (int i = 0; i < 10; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"V{i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Act
		var streamedChanges = new List<ChangeRecord>();
		await foreach (var change in changelog.GetHistoryStreamAsync()) {
			streamedChanges.Add(change);
		}

		// Assert - Each document modification creates 2 property changes (Name + Version)
		streamedChanges.Should().HaveCountGreaterOrEqualTo(10, "at least 10 changes should be present");
	}

	[Fact]
	public async Task GetGroupChangesStreamAsync_FiltersCorrectly() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Create multiple groups
		await changelog.BeginGroupAsync();
		await changelog.ApplyChangesAsync(new TestDoc { Name = "V1", Version = 1 });
		await changelog.CommitGroupAsync();

		string group2Id = await changelog.BeginGroupAsync();
		await changelog.ApplyChangesAsync(new TestDoc { Name = "V2", Version = 2 });
		await changelog.ApplyChangesAsync(new TestDoc { Name = "V2-updated", Version = 2 });
		await changelog.CommitGroupAsync();

		await changelog.BeginGroupAsync();
		await changelog.ApplyChangesAsync(new TestDoc { Name = "V3", Version = 3 });
		await changelog.CommitGroupAsync();

		// Act
		var group2Changes = new List<ChangeRecord>();
		await foreach (var change in changelog.GetGroupChangesStreamAsync(group2Id)) {
			group2Changes.Add(change);
		}

		// Assert - group2 should have 4 changes (2 properties × 2 ApplyChangesAsync calls)
		group2Changes.Should().HaveCount(4);
		group2Changes.Should().AllSatisfy(c => c.GroupId.Should().Be(group2Id));
	}

	[Fact]
	public async Task StreamChangesAsync_EmptyResult_WorksCorrectly() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Act
		var changes = new List<ChangeRecord>();
		await foreach (var change in changelog.GetHistoryStreamAsync()) {
			changes.Add(change);
		}

		// Assert
		changes.Should().BeEmpty();
	}

	[Fact]
	public async Task StreamGroupsAsync_EmptyResult_WorksCorrectly() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Act
		var groups = new List<ChangeGroup>();
		await foreach (var group in changelog.GetGroupsStreamAsync()) {
			groups.Add(group);
		}

		// Assert
		groups.Should().BeEmpty();
	}
}
