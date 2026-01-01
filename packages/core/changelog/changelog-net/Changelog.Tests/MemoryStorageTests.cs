using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using Changelog;
using Changelog.Storage;

namespace Changelog.Tests;

public class MemoryStorageTests {
	private MemoryStorage<TestDocument> _storage = null!;

	public MemoryStorageTests() {
		_storage = new MemoryStorage<TestDocument>();
	}

	[Fact]
	public async Task LoadState_ReturnsNull_ForNonExistentDocument() {
		// Act
		var state = await _storage.LoadStateAsync("doc-1");

		// Assert
		state.Should().BeNull();
	}

	[Fact]
	public async Task SaveState_StoresAndRetrievesState() {
		// Arrange
		var document = new TestDocument { Name = "Alice" };

		// Act
		await _storage.SaveStateAsync("doc-1", document);
		var state = await _storage.LoadStateAsync("doc-1");

		// Assert
		state.Should().NotBeNull();
		state!.Name.Should().Be("Alice");
	}

	[Fact]
	public async Task SaveState_StoresStateForMultipleDocuments() {
		// Act
		await _storage.SaveStateAsync("doc-1", new TestDocument { Name = "Alice" });
		await _storage.SaveStateAsync("doc-2", new TestDocument { Name = "Bob" });

		// Assert
		var state1 = await _storage.LoadStateAsync("doc-1");
		var state2 = await _storage.LoadStateAsync("doc-2");

		state1!.Name.Should().Be("Alice");
		state2!.Name.Should().Be("Bob");
	}

	[Fact]
	public async Task SaveState_CreatesDeepClone_OfState() {
		// Arrange
		var original = new TestDocument {
			Nested = new NestedData { Value = 42 }
		};

		// Act
		await _storage.SaveStateAsync("doc-1", original);
		original.Nested.Value = 100;

		// Assert
		var state = await _storage.LoadStateAsync("doc-1");
		state!.Nested!.Value.Should().Be(42);
	}

	[Fact]
	public async Task CreateGroup_CreatesGroupWithAutoIncrementingId() {
		// Act
		var id1 = await _storage.CreateGroupAsync("doc-1");
		var id2 = await _storage.CreateGroupAsync("doc-1");

		// Assert
		id1.Should().Be("g1");
		id2.Should().Be("g2");
	}

	[Fact]
	public async Task CreateGroup_CreatesGroupWithMetadata() {
		// Arrange
		var metadata = new Dictionary<string, object> {
			["author"] = "Alice",
			["message"] = "Update"
		};

		// Act
		await _storage.CreateGroupAsync("doc-1", metadata);

		// Assert
		var groups = await _storage.GetGroupsAsync("doc-1");
		groups[0].Metadata.Should().ContainKey("author").WhoseValue.Should().Be("Alice");
		groups[0].Metadata.Should().ContainKey("message").WhoseValue.Should().Be("Update");
	}

	[Fact]
	public async Task CreateGroup_SeparateCounters_ForDifferentDocuments() {
		// Act
		var id1 = await _storage.CreateGroupAsync("doc-1");
		var id2 = await _storage.CreateGroupAsync("doc-2");

		// Assert
		id1.Should().Be("g1");
		id2.Should().Be("g1"); // Counter resets for different document
	}

	[Fact]
	public async Task GetChanges_ReturnsEmptyArray_ForNoChanges() {
		// Act
		var changes = await _storage.GetChangesAsync("doc-1");

		// Assert
		changes.Should().BeEmpty();
	}

	[Fact]
	public async Task AppendChanges_StoresAndRetrievesChanges() {
		// Arrange
		var change = new ChangeRecord {
			Path = new[] { "name" },
			Type = ChangeType.Set,
			OldValue = "Alice",
			NewValue = "Bob",
			Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
			GroupId = "g1"
		};

		// Act
		await _storage.AppendChangesAsync("doc-1", new List<ChangeRecord> { change }, "g1");

		// Assert
		var changes = await _storage.GetChangesAsync("doc-1");
		changes.Should().HaveCount(1);
		changes[0].Should().BeEquivalentTo(change);
	}

	[Fact]
	public async Task AppendChanges_AppendsMultipleChanges() {
		// Arrange
		var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
		var changes = new List<ChangeRecord>
		{
			new() { Path = new[] { "a" }, Type = ChangeType.Set, OldValue = 1, NewValue = 10, Timestamp = timestamp },
			new() { Path = new[] { "b" }, Type = ChangeType.Set, OldValue = 2, NewValue = 20, Timestamp = timestamp }
		};

		// Act
		await _storage.AppendChangesAsync("doc-1", changes, "g1");

		// Assert
		var retrieved = await _storage.GetChangesAsync("doc-1");
		retrieved.Should().HaveCount(2);
	}

	[Fact]
	public async Task GetChanges_FiltersBySinceTimestamp() {
		// Arrange
		var timestamp1 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
		await _storage.AppendChangesAsync("doc-1", new List<ChangeRecord>
		{
			new() { Path = new[] { "a" }, Type = ChangeType.Set, OldValue = 1, NewValue = 10, Timestamp = timestamp1 }
		}, "g1");

		var timestamp2 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 100;
		await _storage.AppendChangesAsync("doc-1", new List<ChangeRecord>
		{
			new() { Path = new[] { "b" }, Type = ChangeType.Set, OldValue = 2, NewValue = 20, Timestamp = timestamp2 }
		}, "g2");

		// Act
		var changes = await _storage.GetChangesAsync("doc-1", new QueryOptions { Since = timestamp2 });

		// Assert
		changes.Should().HaveCount(1);
		changes[0].Path[0].Should().Be("b");
	}

	[Fact]
	public async Task GetChanges_FiltersByGroupId() {
		// Arrange
		await _storage.AppendChangesAsync("doc-1", new List<ChangeRecord>
		{
			new() { Path = new[] { "a" }, Type = ChangeType.Set, OldValue = 1, NewValue = 10, Timestamp = 1000, GroupId = "g1" }
		}, "g1");

		await _storage.AppendChangesAsync("doc-1", new List<ChangeRecord>
		{
			new() { Path = new[] { "b" }, Type = ChangeType.Set, OldValue = 2, NewValue = 20, Timestamp = 2000, GroupId = "g2" }
		}, "g2");

		// Act
		var changes = await _storage.GetChangesAsync("doc-1", new QueryOptions { GroupId = "g1" });

		// Assert
		changes.Should().HaveCount(1);
		changes[0].GroupId.Should().Be("g1");
	}

	[Fact]
	public async Task GetChanges_LimitsResults() {
		// Arrange
		var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
		await _storage.AppendChangesAsync("doc-1", new List<ChangeRecord>
		{
			new() { Path = new[] { "a" }, Type = ChangeType.Set, OldValue = 1, NewValue = 10, Timestamp = timestamp },
			new() { Path = new[] { "b" }, Type = ChangeType.Set, OldValue = 2, NewValue = 20, Timestamp = timestamp },
			new() { Path = new[] { "c" }, Type = ChangeType.Set, OldValue = 3, NewValue = 30, Timestamp = timestamp }
		}, "g1");

		// Act
		var changes = await _storage.GetChangesAsync("doc-1", new QueryOptions { Limit = 2 });

		// Assert
		changes.Should().HaveCount(2);
	}

	[Fact]
	public async Task GetGroups_ReturnsEmptyArray_ForNoGroups() {
		// Act
		var groups = await _storage.GetGroupsAsync("doc-1");

		// Assert
		groups.Should().BeEmpty();
	}

	[Fact]
	public async Task GetGroups_ReturnsAllGroups() {
		// Act
		await _storage.CreateGroupAsync("doc-1", new Dictionary<string, object> { ["message"] = "First" });
		await _storage.CreateGroupAsync("doc-1", new Dictionary<string, object> { ["message"] = "Second" });

		// Assert
		var groups = await _storage.GetGroupsAsync("doc-1");
		groups.Should().HaveCount(2);
	}

	[Fact]
	public async Task TrimHistory_RemovesOldestGroups() {
		// Arrange
		await _storage.CreateGroupAsync("doc-1", new Dictionary<string, object> { ["order"] = 1 });
		await _storage.CreateGroupAsync("doc-1", new Dictionary<string, object> { ["order"] = 2 });
		await _storage.CreateGroupAsync("doc-1", new Dictionary<string, object> { ["order"] = 3 });

		// Act
		await _storage.TrimHistoryAsync("doc-1", 2);

		// Assert
		var groups = await _storage.GetGroupsAsync("doc-1");
		groups.Should().HaveCount(2);
		groups[0].Metadata!["order"].Should().Be(2);
		groups[1].Metadata!["order"].Should().Be(3);
	}

	[Fact]
	public async Task TrimHistory_RemovesChanges_AssociatedWithRemovedGroups() {
		// Arrange
		var g1 = await _storage.CreateGroupAsync("doc-1");
		await _storage.AppendChangesAsync("doc-1", new List<ChangeRecord>
		{
			new() { Path = new[] { "a" }, Type = ChangeType.Set, OldValue = 1, NewValue = 10, Timestamp = 1000, GroupId = g1 }
		}, g1);

		var g2 = await _storage.CreateGroupAsync("doc-1");
		await _storage.AppendChangesAsync("doc-1", new List<ChangeRecord>
		{
			new() { Path = new[] { "b" }, Type = ChangeType.Set, OldValue = 2, NewValue = 20, Timestamp = 2000, GroupId = g2 }
		}, g2);

		// Act
		await _storage.TrimHistoryAsync("doc-1", 1);

		// Assert
		var changes = await _storage.GetChangesAsync("doc-1");
		changes.Should().HaveCount(1);
		changes[0].GroupId.Should().Be(g2);
	}

	[Fact]
	public async Task Clear_RemovesAllDocumentData() {
		// Arrange
		await _storage.SaveStateAsync("doc-1", new TestDocument { Name = "Alice" });
		await _storage.CreateGroupAsync("doc-1");
		await _storage.AppendChangesAsync("doc-1", new List<ChangeRecord>
		{
			new() { Path = new[] { "name" }, Type = ChangeType.Set, OldValue = null, NewValue = "Alice", Timestamp = 1000 }
		}, "g1");

		// Act
		await _storage.ClearAsync("doc-1");

		// Assert
		var state = await _storage.LoadStateAsync("doc-1");
		var changes = await _storage.GetChangesAsync("doc-1");
		var groups = await _storage.GetGroupsAsync("doc-1");

		state.Should().BeNull();
		changes.Should().BeEmpty();
		groups.Should().BeEmpty();
	}

	[Fact]
	public async Task UpdateGroupChangeCount_UpdatesCount() {
		// Arrange
		var groupId = await _storage.CreateGroupAsync("doc-1");

		// Act
		await _storage.UpdateGroupChangeCountAsync("doc-1", groupId, 5);

		// Assert
		var groups = await _storage.GetGroupsAsync("doc-1");
		groups[0].ChangeCount.Should().Be(5);
	}

	[Fact]
	public async Task GetChangesAsync_SupportsPagination_WithSkipAndTake() {
		// Arrange
		var groupId = await _storage.CreateGroupAsync("doc-1");
		var changes = new List<ChangeRecord>();
		for (int i = 0; i < 10; i++) {
			changes.Add(new ChangeRecord {
				Path = ["item", i.ToString()],
				Type = ChangeType.Set,
				OldValue = null,
				NewValue = i,
				Timestamp = i
			});
		}
		await _storage.AppendChangesAsync("doc-1", changes, groupId);

		// Act - Get items 3-5 (skip 3, take 3)
		var page = await _storage.GetChangesAsync("doc-1", new QueryOptions { Skip = 3, Take = 3 });

		// Assert
		page.Should().HaveCount(3);
		page[0].NewValue.Should().Be(System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>("3").GetInt32());
		page[1].NewValue.Should().Be(System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>("4").GetInt32());
		page[2].NewValue.Should().Be(System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>("5").GetInt32());
	}

	[Fact]
	public async Task GetChangesAsync_Pagination_SkipBeyondEndReturnsEmpty() {
		// Arrange
		var groupId = await _storage.CreateGroupAsync("doc-1");
		var changes = new List<ChangeRecord> {
			new() { Path = ["a"], Type = ChangeType.Set, NewValue = 1, Timestamp = 1 }
		};
		await _storage.AppendChangesAsync("doc-1", changes, groupId);

		// Act
		var page = await _storage.GetChangesAsync("doc-1", new QueryOptions { Skip = 100 });

		// Assert
		page.Should().BeEmpty();
	}

	[Fact]
	public async Task GetChangesAsync_Pagination_TakeTakesPrecedenceOverLimit() {
		// Arrange
		var groupId = await _storage.CreateGroupAsync("doc-1");
		var changes = new List<ChangeRecord>();
		for (int i = 0; i < 10; i++) {
			changes.Add(new ChangeRecord {
				Path = ["item"],
				Type = ChangeType.Set,
				NewValue = i,
				Timestamp = i
			});
		}
		await _storage.AppendChangesAsync("doc-1", changes, groupId);

		// Act - Take should take precedence over Limit
		var page = await _storage.GetChangesAsync("doc-1", new QueryOptions { Limit = 5, Take = 3 });

		// Assert
		page.Should().HaveCount(3);
	}

	[Fact]
	public async Task LoadVersionedStateAsync_ReturnsDocumentWithVersion() {
		// Arrange
		var document = new TestDocument { Name = "Alice" };
		await _storage.SaveStateAsync("doc-1", document);

		// Act
		var versioned = await _storage.LoadVersionedStateAsync("doc-1");

		// Assert
		versioned.Should().NotBeNull();
		versioned!.Document.Name.Should().Be("Alice");
		versioned.Version.Should().Be(1);
	}

	[Fact]
	public async Task SaveVersionedStateAsync_IncrementsVersion() {
		// Arrange
		var document = new TestDocument { Name = "Alice" };
		await _storage.SaveVersionedStateAsync("doc-1", document, null);

		// Act
		await _storage.SaveVersionedStateAsync("doc-1", new TestDocument { Name = "Bob" }, null);
		var versioned = await _storage.LoadVersionedStateAsync("doc-1");

		// Assert
		versioned!.Version.Should().Be(2);
	}

	[Fact]
	public async Task SaveVersionedStateAsync_ThrowsOnVersionMismatch() {
		// Arrange
		var document = new TestDocument { Name = "Alice" };
		await _storage.SaveVersionedStateAsync("doc-1", document, null);

		// Act & Assert
		var exception = await Assert.ThrowsAsync<ConcurrencyException>(async () => {
			await _storage.SaveVersionedStateAsync("doc-1", new TestDocument { Name = "Bob" }, 5);
		});

		exception.DocumentId.Should().Be("doc-1");
		exception.ExpectedVersion.Should().Be(5);
		exception.ActualVersion.Should().Be(1);
	}

	[Fact]
	public async Task SaveVersionedStateAsync_SucceedsWithCorrectVersion() {
		// Arrange
		var document = new TestDocument { Name = "Alice" };
		await _storage.SaveVersionedStateAsync("doc-1", document, null);
		var versioned = await _storage.LoadVersionedStateAsync("doc-1");

		// Act - Save with correct version should succeed
		await _storage.SaveVersionedStateAsync("doc-1", new TestDocument { Name = "Bob" }, versioned!.Version);
		var updated = await _storage.LoadVersionedStateAsync("doc-1");

		// Assert
		updated!.Document.Name.Should().Be("Bob");
		updated.Version.Should().Be(2);
	}

	// Test document classes
	public class TestDocument {
		public string? Name { get; set; }
		public NestedData? Nested { get; set; }
	}

	public class NestedData {
		public int Value { get; set; }
	}
}
