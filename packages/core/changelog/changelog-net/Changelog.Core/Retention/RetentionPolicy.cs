using System;

namespace Changelog;

/// <summary>
/// Defines retention policy for managing changelog history growth.
/// </summary>
public class RetentionPolicy {
	/// <summary>
	/// Maximum number of change groups to retain.
	/// Older groups beyond this limit will be deleted.
	/// </summary>
	public int? MaxGroups { get; set; }

	/// <summary>
	/// Maximum age of change groups to retain.
	/// Groups older than this will be deleted.
	/// </summary>
	public TimeSpan? MaxAge { get; set; }

	/// <summary>
	/// Minimum number of groups to always keep, regardless of age.
	/// This ensures recent history is never deleted even if it exceeds MaxAge.
	/// Default: 1 (always keep at least one group)
	/// </summary>
	public int MinGroups { get; set; } = 1;

	/// <summary>
	/// Create a retention policy that keeps only the last N groups.
	/// </summary>
	public static RetentionPolicy KeepLast(int maxGroups) {
		return new RetentionPolicy { MaxGroups = maxGroups };
	}

	/// <summary>
	/// Create a retention policy that keeps groups newer than the specified age.
	/// </summary>
	public static RetentionPolicy KeepNewerThan(TimeSpan maxAge) {
		return new RetentionPolicy { MaxAge = maxAge };
	}

	/// <summary>
	/// Create a retention policy with both group count and age limits.
	/// Keeps whichever is more restrictive.
	/// </summary>
	public static RetentionPolicy KeepLastOrNewerThan(int maxGroups, TimeSpan maxAge) {
		return new RetentionPolicy {
			MaxGroups = maxGroups,
			MaxAge = maxAge
		};
	}

	/// <summary>
	/// Common policy: Keep last 30 days or 100 groups, whichever is more.
	/// </summary>
	public static RetentionPolicy Default => new() {
		MaxGroups = 100,
		MaxAge = TimeSpan.FromDays(30),
		MinGroups = 10
	};

	/// <summary>
	/// Policy for short-term projects: Keep last 7 days.
	/// </summary>
	public static RetentionPolicy ShortTerm => new() {
		MaxAge = TimeSpan.FromDays(7),
		MinGroups = 5
	};

	/// <summary>
	/// Policy for long-term archival: Keep everything for 1 year.
	/// </summary>
	public static RetentionPolicy LongTerm => new() {
		MaxAge = TimeSpan.FromDays(365),
		MaxGroups = 10000,
		MinGroups = 50
	};
}
