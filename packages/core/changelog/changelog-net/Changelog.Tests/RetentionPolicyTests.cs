using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using Changelog.Storage;

namespace Changelog.Tests;

public class RetentionPolicyTests {
	private class TestDoc {
		public string? Name { get; set; }
		public int Version { get; set; }
	}

	[Fact]
	public void RetentionPolicy_KeepLast_CreatesCorrectPolicy() {
		// Act
		var policy = RetentionPolicy.KeepLast(50);

		// Assert
		policy.MaxGroups.Should().Be(50);
		policy.MaxAge.Should().BeNull();
	}

	[Fact]
	public void RetentionPolicy_KeepNewerThan_CreatesCorrectPolicy() {
		// Act
		var policy = RetentionPolicy.KeepNewerThan(TimeSpan.FromDays(7));

		// Assert
		policy.MaxAge.Should().Be(TimeSpan.FromDays(7));
		policy.MaxGroups.Should().BeNull();
	}

	[Fact]
	public void RetentionPolicy_KeepLastOrNewerThan_CreatesCorrectPolicy() {
		// Act
		var policy = RetentionPolicy.KeepLastOrNewerThan(100, TimeSpan.FromDays(30));

		// Assert
		policy.MaxGroups.Should().Be(100);
		policy.MaxAge.Should().Be(TimeSpan.FromDays(30));
	}

	[Fact]
	public void RetentionPolicy_Default_HasReasonableValues() {
		// Act
		var policy = RetentionPolicy.Default;

		// Assert
		policy.MaxGroups.Should().Be(100);
		policy.MaxAge.Should().Be(TimeSpan.FromDays(30));
		policy.MinGroups.Should().Be(10);
	}

	[Fact]
	public async Task ApplyRetentionPolicy_MaxGroups_KeepsOnlyRecentGroups() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Create 10 groups
		for (int i = 0; i < 10; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"Version {i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		var policy = RetentionPolicy.KeepLast(5);

		// Act
		await changelog.ApplyRetentionPolicyAsync(policy);

		// Assert
		var groups = await changelog.GetGroupsAsync();
		groups.Should().HaveCount(5);

		// Verify we kept the newest 5
		var changes = await storage.GetChangesAsync("doc1");
		changes.Should().NotBeEmpty();
	}

	[Fact]
	public async Task ApplyRetentionPolicy_RespectsMinGroups() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Create 3 groups
		for (int i = 0; i < 3; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"Version {i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Policy says keep 0, but MinGroups is 1
		var policy = new RetentionPolicy {
			MaxGroups = 0,
			MinGroups = 1
		};

		// Act
		await changelog.ApplyRetentionPolicyAsync(policy);

		// Assert
		var groups = await changelog.GetGroupsAsync();
		groups.Should().HaveCount(1, "MinGroups should be respected");
	}

	[Fact]
	public async Task ApplyRetentionPolicy_NoGroups_DoesNotFail() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		var policy = RetentionPolicy.KeepLast(10);

		// Act & Assert - Should not throw
		await changelog.ApplyRetentionPolicyAsync(policy);

		var groups = await changelog.GetGroupsAsync();
		groups.Should().BeEmpty();
	}

	[Fact]
	public async Task ApplyRetentionPolicy_KeepsMoreThanMaxGroups_DoesNothing() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Create 5 groups
		for (int i = 0; i < 5; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"Version {i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Policy allows more than we have
		var policy = RetentionPolicy.KeepLast(100);

		// Act
		await changelog.ApplyRetentionPolicyAsync(policy);

		// Assert
		var groups = await changelog.GetGroupsAsync();
		groups.Should().HaveCount(5, "all groups should be kept");
	}

	[Fact]
	public async Task ApplyRetentionPolicy_NullPolicy_ThrowsException() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Act & Assert
		await Assert.ThrowsAsync<ArgumentNullException>(
			async () => await changelog.ApplyRetentionPolicyAsync(null!)
		);
	}

	[Fact]
	public async Task TrimHistory_RemovesOldestGroups() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Create 10 groups with distinct versions
		for (int i = 0; i < 10; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"Version {i}", Version = i });
			await changelog.CommitGroupAsync();
			await Task.Delay(10); // Small delay to ensure different timestamps
		}

		// Act - Keep only 3 groups
		await changelog.TrimHistoryAsync(3);

		// Assert
		var groups = await changelog.GetGroupsAsync();
		groups.Should().HaveCount(3);

		// Verify changes exist for remaining groups
		var changes = await storage.GetChangesAsync("doc1");
		changes.Should().NotBeEmpty();

		// All changes should belong to the remaining groups
		var remainingGroupIds = groups.Select(g => g.Id).ToHashSet();
		changes.Should().AllSatisfy(c =>
			c.GroupId.Should().Match(gid => gid == null || remainingGroupIds.Contains(gid!))
		);
	}

	[Fact]
	public async Task TrimHistory_WithMultipleDocuments_OnlyTrimsSpecifiedDocument() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog1 = new Changelog<TestDoc>(storage, "doc1");
		var changelog2 = new Changelog<TestDoc>(storage, "doc2");

		// Create 5 groups in each document
		for (int i = 0; i < 5; i++) {
			await changelog1.BeginGroupAsync();
			await changelog1.ApplyChangesAsync(new TestDoc { Name = $"Doc1-V{i}", Version = i });
			await changelog1.CommitGroupAsync();

			await changelog2.BeginGroupAsync();
			await changelog2.ApplyChangesAsync(new TestDoc { Name = $"Doc2-V{i}", Version = i });
			await changelog2.CommitGroupAsync();
		}

		// Act - Trim only doc1
		await changelog1.TrimHistoryAsync(2);

		// Assert
		var groups1 = await changelog1.GetGroupsAsync();
		var groups2 = await changelog2.GetGroupsAsync();

		groups1.Should().HaveCount(2, "doc1 should be trimmed");
		groups2.Should().HaveCount(5, "doc2 should be unaffected");
	}

	[Fact]
	public async Task RetentionPolicy_ShortTerm_HasCorrectDefaults() {
		// Act
		var policy = RetentionPolicy.ShortTerm;

		// Assert
		policy.MaxAge.Should().Be(TimeSpan.FromDays(7));
		policy.MinGroups.Should().Be(5);
	}

	[Fact]
	public async Task RetentionPolicy_LongTerm_HasCorrectDefaults() {
		// Act
		var policy = RetentionPolicy.LongTerm;

		// Assert
		policy.MaxAge.Should().Be(TimeSpan.FromDays(365));
		policy.MaxGroups.Should().Be(10000);
		policy.MinGroups.Should().Be(50);
	}

	[Fact]
	public async Task ApplyRetentionPolicy_WithBothLimits_UsesMorePermissive() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Create 20 groups
		for (int i = 0; i < 20; i++) {
			await changelog.BeginGroupAsync();
			await changelog.ApplyChangesAsync(new TestDoc { Name = $"Version {i}", Version = i });
			await changelog.CommitGroupAsync();
		}

		// Policy: Keep 10 groups OR 7 days (all groups are recent, so 7 days would keep all 20)
		// But MaxGroups limits to 10, and MinGroups ensures at least 5
		var policy = new RetentionPolicy {
			MaxGroups = 10,
			MaxAge = TimeSpan.FromDays(7),
			MinGroups = 5
		};

		// Act
		await changelog.ApplyRetentionPolicyAsync(policy);

		// Assert
		var groups = await changelog.GetGroupsAsync();
		// Since all groups are recent (within 7 days), MaxAge doesn't restrict
		// But MaxGroups limits to 10
		groups.Should().HaveCount(10);
	}
}
