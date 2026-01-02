using System.Diagnostics;

namespace Changelog;

/// <summary>
/// Provides OpenTelemetry instrumentation for the Changelog library.
/// Activities are only created when a listener is registered.
/// </summary>
internal static class ChangelogTelemetry {
	/// <summary>
	/// ActivitySource for all Changelog library operations.
	/// Subscribe to this source in your OpenTelemetry configuration.
	/// </summary>
	internal static readonly ActivitySource ActivitySource = new(
		"Changelog.Library",
		"1.0.0"
	);

	// Standard tag keys for consistency
	internal const string OperationKey = "changelog.operation";
	internal const string DocumentIdKey = "changelog.document_id";
	internal const string StorageTypeKey = "changelog.storage.type";
	internal const string ChangeCountKey = "changelog.change.count";
	internal const string GroupIdKey = "changelog.group.id";
	internal const string QuerySkipKey = "changelog.query.skip";
	internal const string QueryLimitKey = "changelog.query.limit";
	internal const string CacheHitKey = "cache.hit";
	internal const string DiffTypeKey = "diff.type";
	internal const string DiffCountKey = "diff.count";
	internal const string DbSystemKey = "db.system";
	internal const string DbOperationKey = "db.operation";
}
