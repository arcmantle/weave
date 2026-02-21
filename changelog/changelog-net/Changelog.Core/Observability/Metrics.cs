using System.Diagnostics.Metrics;

namespace Changelog;

internal static class ChangelogMetrics {
	private static readonly Meter Meter = new("Changelog.Library", "1.0.0");

	// Counters - monotonically increasing values
	public static readonly Counter<long> OperationCount =
		Meter.CreateCounter<long>("changelog.operation.count", "operations",
			"Total number of changelog operations");

	public static readonly Counter<long> ChangeCount =
		Meter.CreateCounter<long>("changelog.change.count", "changes",
			"Total number of changes recorded");

	public static readonly Counter<long> ErrorCount =
		Meter.CreateCounter<long>("changelog.error.count", "errors",
			"Total number of errors encountered");

	public static readonly Counter<long> GroupCount =
		Meter.CreateCounter<long>("changelog.group.count", "groups",
			"Total number of change groups created");

	// Histograms - for latency percentiles and distributions
	public static readonly Histogram<double> OperationDuration =
		Meter.CreateHistogram<double>("changelog.operation.duration", "ms",
			"Duration of changelog operations in milliseconds");

	public static readonly Histogram<long> HistorySize =
		Meter.CreateHistogram<long>("changelog.history.size", "changes",
			"Number of changes returned in history queries");

	public static readonly Histogram<long> DiffComplexity =
		Meter.CreateHistogram<long>("changelog.diff.complexity", "diffs",
			"Number of differences computed per operation");

	// Tag keys for consistent labeling
	public const string OperationKey = "operation";
	public const string DocumentIdKey = "document_id";
	public const string ErrorTypeKey = "error.type";
	public const string GroupIdKey = "group_id";
}
