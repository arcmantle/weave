using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using Changelog.Storage;

namespace Changelog.Tests;

public class ChangelogTests {
	private MemoryStorage<TestDocument> _storage = null!;
	private Changelog<TestDocument> _changelog = null!;

	public ChangelogTests() {
		_storage = new MemoryStorage<TestDocument>();
		_changelog = new Changelog<TestDocument>(_storage, "doc-1");
	}

	[Fact]
	public async Task GetDocument_ReturnsNull_ForNonExistentDocument() {
		// Act
		var doc = await _changelog.GetDocumentAsync();

		// Assert
		doc.Should().BeNull();
	}

	[Fact]
	public async Task SetDocument_StoresAndRetrievesDocument() {
		// Arrange
		var state = new TestDocument { Name = "Alice", Age = 30 };

		// Act
		await _changelog.SetDocumentAsync(state);
		var retrieved = await _changelog.GetDocumentAsync();

		// Assert
		retrieved.Should().NotBeNull();
		retrieved!.Name.Should().Be("Alice");
		retrieved.Age.Should().Be(30);
	}

	[Fact]
	public async Task SetDocument_OverwritesExistingDocument() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Name = "Alice" });

		// Act
		await _changelog.SetDocumentAsync(new TestDocument { Name = "Bob" });
		var retrieved = await _changelog.GetDocumentAsync();

		// Assert
		retrieved!.Name.Should().Be("Bob");
	}

	[Fact]
	public async Task ApplyChanges_CreatesAutoGroup_WhenNotInBatch() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Count = 0 });

		// Act
		await _changelog.ApplyChangesAsync(new TestDocument { Count = 1 });

		// Assert
		var history = await _changelog.GetHistoryAsync();
		history.Should().NotBeEmpty();
		history[0].Path.Should().ContainSingle().Which.Should().Be("Count");
	}

	[Fact]
	public async Task ApplyChanges_TracksChangesToDocument() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Name = "Alice", Age = 30 });

		// Act
		await _changelog.ApplyChangesAsync(new TestDocument { Name = "Alice", Age = 31 });

		// Assert
		var history = await _changelog.GetHistoryAsync();
		history.Should().HaveCount(1);

		var change = history[0];
		change.Path.Should().ContainSingle().Which.Should().Be("Age");
		change.Type.Should().Be(ChangeType.Set);
		change.OldValue.Should().Be(30);
		change.NewValue.Should().Be(31);
	}

	[Fact]
	public async Task ApplyChanges_DoesNotCreateChanges_ForIdenticalStates() {
		// Arrange
		var state = new TestDocument { Name = "Alice" };
		await _changelog.SetDocumentAsync(state);

		// Act
		await _changelog.ApplyChangesAsync(new TestDocument { Name = "Alice" });

		// Assert
		var history = await _changelog.GetHistoryAsync();
		history.Should().BeEmpty();
	}

	[Fact]
	public async Task ApplyChanges_TracksMultiplePropertyChanges() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { A = 1, B = 2 });

		// Act
		await _changelog.ApplyChangesAsync(new TestDocument { A = 10, B = 20 });

		// Assert
		var history = await _changelog.GetHistoryAsync();
		history.Should().HaveCount(2);
		history.Should().Contain(h => h.Path[0] == "A");
		history.Should().Contain(h => h.Path[0] == "B");
	}

	[Fact]
	public async Task ApplyChanges_TracksDeepNestedChanges() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument {
			User = new UserProfile { Profile = new Profile { Name = "Alice", Age = 30 } }
		});

		// Act
		await _changelog.ApplyChangesAsync(new TestDocument {
			User = new UserProfile { Profile = new Profile { Name = "Alice", Age = 31 } }
		});

		// Assert
		var history = await _changelog.GetHistoryAsync();
		history[0].Path.Should().Equal("User", "Profile", "Age");
	}

	[Fact]
	public async Task BeginGroup_CreatesNewGroup() {
		// Act
		var groupId = await _changelog.BeginGroupAsync();

		// Assert
		groupId.Should().NotBeNullOrEmpty();
		groupId.Should().MatchRegex(@"^g\d+$");
	}

	[Fact]
	public async Task BeginGroup_AcceptsMetadata() {
		// Act
		await _changelog.BeginGroupAsync(new Dictionary<string, object> {
			["author"] = "Alice",
			["message"] = "Update user"
		});

		// Assert
		var groups = await _changelog.GetGroupsAsync();
		groups[0].Metadata.Should().ContainKey("author").WhoseValue.Should().Be("Alice");
		groups[0].Metadata.Should().ContainKey("message").WhoseValue.Should().Be("Update user");
	}

	[Fact]
	public async Task CommitGroup_SavesChanges() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Count = 0 });

		// Act
		await _changelog.BeginGroupAsync();
		await _changelog.ApplyChangesAsync(new TestDocument { Count = 1 });
		await _changelog.CommitGroupAsync();

		// Assert
		var history = await _changelog.GetHistoryAsync();
		history.Should().NotBeEmpty();
	}

	[Fact]
	public async Task RollbackGroup_DiscardsChanges() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Count = 0 });

		// Act
		await _changelog.BeginGroupAsync();
		await _changelog.ApplyChangesAsync(new TestDocument { Count = 1 });
		await _changelog.RollbackGroupAsync();

		// Assert
		var doc = await _changelog.GetDocumentAsync();
		doc!.Count.Should().Be(0); // State restored

		var history = await _changelog.GetHistoryAsync();
		history.Should().BeEmpty(); // No changes saved
	}

	[Fact]
	public async Task GroupsMultipleChangesTogether() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { A = 1, B = 2, C = 3 });

		// Act
		var groupId = await _changelog.BeginGroupAsync(new Dictionary<string, object> {
			["message"] = "Batch update"
		});
		await _changelog.ApplyChangesAsync(new TestDocument { A = 10, B = 2, C = 3 });
		await _changelog.ApplyChangesAsync(new TestDocument { A = 10, B = 20, C = 3 });
		await _changelog.CommitGroupAsync();

		// Assert
		var history = await _changelog.GetHistoryAsync();
		var groupChanges = history.Where(h => h.GroupId == groupId).ToList();
		groupChanges.Should().NotBeEmpty();
	}

	[Fact]
	public async Task CommitGroup_ThrowsError_WhenNoActiveGroup() {
		// Act & Assert
		var act = async () => await _changelog.CommitGroupAsync();
		await act.Should().ThrowAsync<InvalidOperationException>()
			.WithMessage("No active group to commit");
	}

	[Fact]
	public async Task RollbackGroup_ThrowsError_WhenNoActiveGroup() {
		// Act & Assert
		var act = async () => await _changelog.RollbackGroupAsync();
		await act.Should().ThrowAsync<InvalidOperationException>()
			.WithMessage("No active group to rollback");
	}

	[Fact]
	public async Task GetHistory_ReturnsEmptyArray_ForNoChanges() {
		// Act
		var history = await _changelog.GetHistoryAsync();

		// Assert
		history.Should().BeEmpty();
	}

	[Fact]
	public async Task GetHistory_ReturnsAllChangesByDefault() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { A = 1, B = 2 });
		await _changelog.ApplyChangesAsync(new TestDocument { A = 10, B = 2 });
		await _changelog.ApplyChangesAsync(new TestDocument { A = 10, B = 20 });

		// Act
		var history = await _changelog.GetHistoryAsync();

		// Assert
		history.Count.Should().BeGreaterThanOrEqualTo(2);
	}

	[Fact]
	public async Task GetHistory_FiltersBySinceTimestamp() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Count = 0 });
		await _changelog.ApplyChangesAsync(new TestDocument { Count = 1 });

		var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
		await Task.Delay(10);

		await _changelog.ApplyChangesAsync(new TestDocument { Count = 2 });

		// Act
		var history = await _changelog.GetHistoryAsync(new QueryOptions { Since = timestamp });

		// Assert
		history.Should().NotBeEmpty();
		history.Should().OnlyContain(h => h.Timestamp >= timestamp);
	}

	[Fact]
	public async Task GetHistory_LimitsResultsWithLimitOption() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { A = 1, B = 2, C = 3 });
		await _changelog.ApplyChangesAsync(new TestDocument { A = 10, B = 20, C = 30 });

		// Act
		var history = await _changelog.GetHistoryAsync(new QueryOptions { Limit = 2 });

		// Assert
		history.Count.Should().BeLessThanOrEqualTo(2);
	}

	[Fact]
	public async Task GetGroups_ReturnsEmptyArray_WhenNoGroupsExist() {
		// Act
		var groups = await _changelog.GetGroupsAsync();

		// Assert
		groups.Should().BeEmpty();
	}

	[Fact]
	public async Task GetGroups_ReturnsAllGroups() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Count = 0 });

		await _changelog.BeginGroupAsync(new Dictionary<string, object> { ["message"] = "First" });
		await _changelog.ApplyChangesAsync(new TestDocument { Count = 1 });
		await _changelog.CommitGroupAsync();

		await _changelog.BeginGroupAsync(new Dictionary<string, object> { ["message"] = "Second" });
		await _changelog.ApplyChangesAsync(new TestDocument { Count = 2 });
		await _changelog.CommitGroupAsync();

		// Act
		var groups = await _changelog.GetGroupsAsync();

		// Assert
		groups.Should().HaveCount(2);
	}

	[Fact]
	public async Task TrimHistory_RemovesOldestGroups_WhenExceedingMaxGroups() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Count = 0 });

		// Create 3 groups
		for (int i = 1; i <= 3; i++) {
			await _changelog.BeginGroupAsync(new Dictionary<string, object> { ["message"] = $"Group {i}" });
			await _changelog.ApplyChangesAsync(new TestDocument { Count = i });
			await _changelog.CommitGroupAsync();
		}

		// Act - Trim to keep only 2 newest groups
		await _changelog.TrimHistoryAsync(2);

		// Assert
		var groups = await _changelog.GetGroupsAsync();
		groups.Should().HaveCount(2);
		groups[0].Metadata!["message"].Should().Be("Group 2");
		groups[1].Metadata!["message"].Should().Be("Group 3");
	}

	[Fact]
	public async Task TrimHistory_DoesNothing_WhenGroupsAreWithinLimit() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Count = 0 });

		await _changelog.BeginGroupAsync();
		await _changelog.ApplyChangesAsync(new TestDocument { Count = 1 });
		await _changelog.CommitGroupAsync();

		// Act
		await _changelog.TrimHistoryAsync(10);

		// Assert
		var groups = await _changelog.GetGroupsAsync();
		groups.Should().HaveCount(1);
	}

	[Fact]
	public async Task Clear_RemovesAllDocumentData() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Name = "Alice" });
		await _changelog.ApplyChangesAsync(new TestDocument { Name = "Bob" });

		// Act
		await _changelog.ClearAsync();

		// Assert
		var doc = await _changelog.GetDocumentAsync();
		var history = await _changelog.GetHistoryAsync();
		var groups = await _changelog.GetGroupsAsync();

		doc.Should().BeNull();
		history.Should().BeEmpty();
		groups.Should().BeEmpty();
	}

	[Fact]
	public async Task Clear_ClearsActiveBatchStack() {
		// Arrange
		await _changelog.SetDocumentAsync(new TestDocument { Count = 0 });
		await _changelog.BeginGroupAsync();

		// Act
		await _changelog.ClearAsync();

		// Assert - Should throw since stack was cleared
		var act = async () => await _changelog.CommitGroupAsync();
		await act.Should().ThrowAsync<InvalidOperationException>();
	}

	// Test document classes
	public class TestDocument {
		public string? Name { get; set; }
		public int Age { get; set; }
		public int Count { get; set; }
		public int A { get; set; }
		public int B { get; set; }
		public int C { get; set; }
		public UserProfile? User { get; set; }
	}

	public class UserProfile {
		public Profile? Profile { get; set; }
	}

	public class Profile {
		public string? Name { get; set; }
		public int Age { get; set; }
	}
}
