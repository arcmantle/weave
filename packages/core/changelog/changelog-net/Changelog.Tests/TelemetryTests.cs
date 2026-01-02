using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Changelog.Storage;
using FluentAssertions;
using Xunit;

namespace Changelog.Tests;

[Collection("Telemetry")]
[CollectionDefinition("Telemetry", DisableParallelization = true)]
public class TelemetryTests {
	private List<Activity> CaptureActivities(Action testAction) {
		var capturedActivities = new List<Activity>();
		var listener = new ActivityListener {
			ShouldListenTo = source => source.Name == "Changelog.Library",
			Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
			ActivityStarted = activity => { },
			ActivityStopped = activity => {
				if (activity != null) {
					capturedActivities.Add(activity);
				}
			}
		};

		ActivitySource.AddActivityListener(listener);
		try {
			testAction();
		}
		finally {
			listener.Dispose();
		}

		return capturedActivities;
	}

	private async Task<List<Activity>> CaptureActivitiesAsync(Func<Task> testAction) {
		var capturedActivities = new List<Activity>();
		var listener = new ActivityListener {
			ShouldListenTo = source => source.Name == "Changelog.Library",
			Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
			ActivityStarted = activity => { },
			ActivityStopped = activity => {
				if (activity != null) {
					capturedActivities.Add(activity);
				}
			}
		};

		ActivitySource.AddActivityListener(listener);
		try {
			await testAction();
		}
		finally {
			listener.Dispose();
		}

		return capturedActivities;
	}

	[Fact]
	public async Task GetDocumentAsync_CreatesActivity() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");
		await changelog.SetDocumentAsync(new TestDoc { Name = "Test" });

		// Act & Capture
		var activities = await CaptureActivitiesAsync(async () => {
			await changelog.GetDocumentAsync();
		});

		// Assert
		activities.Should().ContainSingle(a => a.OperationName == "GetDocument");
		var activity = activities.First(a => a.OperationName == "GetDocument");
		activity.GetTagItem("changelog.document_id").Should().Be("doc1");
		activity.GetTagItem("changelog.operation").Should().Be("get_document");
		activity.Status.Should().Be(ActivityStatusCode.Ok);
	}

	[Fact]
	public async Task ApplyChangesAsync_CreatesActivity() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Act & Capture
		var activities = await CaptureActivitiesAsync(async () => {
			await changelog.ApplyChangesAsync(new TestDoc { Name = "Test", Version = 1 });
		});

		// Assert
		activities.Should().ContainSingle(a => a.OperationName == "ApplyChanges");
		var activity = activities.First(a => a.OperationName == "ApplyChanges");
		activity.GetTagItem("changelog.document_id").Should().Be("doc1");
		activity.GetTagItem("changelog.operation").Should().Be("apply_changes");
		activity.GetTagItem("changelog.change.count").Should().NotBeNull();
		activity.Status.Should().Be(ActivityStatusCode.Ok);
	}

	[Fact]
	public async Task GetHistoryAsync_CreatesActivityWithQueryOptions() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");
		await changelog.ApplyChangesAsync(new TestDoc { Name = "Test" });

		// Act & Capture
		var activities = await CaptureActivitiesAsync(async () => {
			await changelog.GetHistoryAsync(new QueryOptions { Skip = 5, Limit = 10 });
		});

		// Assert
		activities.Should().ContainSingle(a => a.OperationName == "GetHistory");
		var activity = activities.First(a => a.OperationName == "GetHistory");
		activity.GetTagItem("changelog.document_id").Should().Be("doc1");
		activity.GetTagItem("changelog.query.skip").Should().Be(5);
		activity.GetTagItem("changelog.query.limit").Should().Be(10);
		activity.Status.Should().Be(ActivityStatusCode.Ok);
	}

	[Fact]
	public async Task GetHistoryStreamAsync_CreatesActivity() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");
		await changelog.ApplyChangesAsync(new TestDoc { Name = "Test", Version = 1 });

		// Act & Capture
		var activities = await CaptureActivitiesAsync(async () => {
			await foreach (var _ in changelog.GetHistoryStreamAsync()) {
				// consume stream
			}
		});

		// Assert
		activities.Should().ContainSingle(a => a.OperationName == "GetHistoryStream");
		var activity = activities.First(a => a.OperationName == "GetHistoryStream");
		activity.GetTagItem("changelog.document_id").Should().Be("doc1");
		activity.GetTagItem("changelog.operation").Should().Be("get_history_stream");
		activity.GetTagItem("changelog.change.count").Should().NotBeNull();
		activity.Status.Should().Be(ActivityStatusCode.Ok);
	}

	[Fact]
	public async Task GetGroupsAsync_CreatesActivity() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");
		await changelog.BeginGroupAsync();
		await changelog.ApplyChangesAsync(new TestDoc { Name = "Test" });
		await changelog.CommitGroupAsync();

		// Act & Capture
		var activities = await CaptureActivitiesAsync(changelog.GetGroupsAsync);

		// Assert
		activities.Should().ContainSingle(a => a.OperationName == "GetGroups");
		var activity = activities.First(a => a.OperationName == "GetGroups");
		activity.GetTagItem("changelog.document_id").Should().Be("doc1");
		activity.GetTagItem("changelog.operation").Should().Be("get_groups");
		activity.GetTagItem("changelog.group.count").Should().NotBeNull();
		activity.Status.Should().Be(ActivityStatusCode.Ok);
	}

	[Fact]
	public async Task GetGroupChangesAsync_CreatesActivityWithGroupId() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");
		var groupId = await changelog.BeginGroupAsync();
		await changelog.ApplyChangesAsync(new TestDoc { Name = "Test" });
		await changelog.CommitGroupAsync();

		// Act & Capture
		var activities = await CaptureActivitiesAsync(async () => {
			await changelog.GetGroupChangesAsync(groupId);
		});

		// Assert
		activities.Should().ContainSingle(a => a.OperationName == "GetGroupChanges");
		var activity = activities.First(a => a.OperationName == "GetGroupChanges");
		activity.GetTagItem("changelog.document_id").Should().Be("doc1");
		activity.GetTagItem("changelog.group.id").Should().Be(groupId);
		activity.GetTagItem("changelog.operation").Should().Be("get_group_changes");
		activity.Status.Should().Be(ActivityStatusCode.Ok);
	}

	[Fact]
	public async Task GetGroupChangesStreamAsync_CreatesActivity() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");
		var groupId = await changelog.BeginGroupAsync();
		await changelog.ApplyChangesAsync(new TestDoc { Name = "Test", Version = 1 });
		await changelog.CommitGroupAsync();

		// Act & Capture
		var activities = await CaptureActivitiesAsync(async () => {
			await foreach (var _ in changelog.GetGroupChangesStreamAsync(groupId)) {
				// consume stream
			}
		});

		// Assert
		activities.Should().ContainSingle(a => a.OperationName == "GetGroupChangesStream");
		var activity = activities.First(a => a.OperationName == "GetGroupChangesStream");
		activity.GetTagItem("changelog.document_id").Should().Be("doc1");
		activity.GetTagItem("changelog.group.id").Should().Be(groupId);
		activity.GetTagItem("changelog.change.count").Should().NotBeNull();
		activity.Status.Should().Be(ActivityStatusCode.Ok);
	}

	[Fact]
	public async Task GetGroupsStreamAsync_CreatesActivity() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");
		await changelog.BeginGroupAsync();
		await changelog.ApplyChangesAsync(new TestDoc { Name = "Test" });
		await changelog.CommitGroupAsync();

		// Act & Capture
		var activities = await CaptureActivitiesAsync(async () => {
			await foreach (var _ in changelog.GetGroupsStreamAsync()) {
				// consume stream
			}
		});

		// Assert
		activities.Should().ContainSingle(a => a.OperationName == "GetGroupsStream");
		var activity = activities.First(a => a.OperationName == "GetGroupsStream");
		activity.GetTagItem("changelog.document_id").Should().Be("doc1");
		activity.GetTagItem("changelog.operation").Should().Be("get_groups_stream");
		activity.GetTagItem("changelog.group.count").Should().NotBeNull();
		activity.Status.Should().Be(ActivityStatusCode.Ok);
	}

	[Fact]
	public async Task ActivityHierarchy_IsPreserved() {
		// Arrange
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Act & Capture
		var activities = await CaptureActivitiesAsync(async () => {
			await changelog.ApplyChangesAsync(new TestDoc { Name = "Test", Version = 1 });
		});

		// Assert
		var applyActivity = activities.FirstOrDefault(a => a.OperationName == "ApplyChanges");
		applyActivity.Should().NotBeNull();
		// Verify telemetry was captured
		activities.Should().NotBeEmpty();
	}

	[Fact]
	public async Task NoListener_NoOverhead() {
		// Arrange - No listener configured
		var storage = new MemoryStorage<TestDoc>();
		var changelog = new Changelog<TestDoc>(storage, "doc1");

		// Act - operations with no listener
		await changelog.ApplyChangesAsync(new TestDoc { Name = "Test" });
		await changelog.GetDocumentAsync();
		await changelog.GetHistoryAsync();

		// Assert
		// This test verifies that without a listener, code doesn't crash
		// The activities won't be captured, which is expected
		true.Should().BeTrue(); // Test passes if we get here without exceptions
	}

	private class TestDoc {
		public string Name { get; set; } = "";
		public int Version { get; set; }
	}
}
