using System.Diagnostics;

namespace Changelog;

/// <summary>
/// Provides OpenTelemetry instrumentation for the Changelog library.
/// Activities are only created when a listener is registered.
/// </summary>
public static class ChangelogTelemetry {
	/// <summary>
	/// ActivitySource for all Changelog library operations.
	/// Subscribe to this source in your OpenTelemetry configuration.
	/// </summary>
	public static readonly ActivitySource ActivitySource = new(
		"Changelog.Library",
		"1.0.0"
	);

	// Standard tag keys for consistency
	public const string OperationKey = "changelog.operation";
	public const string DocumentIdKey = "changelog.document_id";
	public const string StorageTypeKey = "changelog.storage.type";
	public const string ChangeCountKey = "changelog.change.count";
	public const string GroupIdKey = "changelog.group.id";
	public const string QuerySkipKey = "changelog.query.skip";
	public const string QueryLimitKey = "changelog.query.limit";
	public const string CacheHitKey = "cache.hit";
	public const string DiffTypeKey = "diff.type";
	public const string DiffCountKey = "diff.count";
	public const string DbSystemKey = "db.system";
	public const string DbOperationKey = "db.operation";
}
