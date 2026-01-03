using System;
using System.Collections.Generic;

namespace Changelog;

/// <summary>
/// Health status of a storage backend
/// </summary>
public enum HealthStatus {
	/// <summary>Storage is fully operational</summary>
	Healthy,

	/// <summary>Storage is operational but degraded (e.g., high latency)</summary>
	Degraded,

	/// <summary>Storage is not operational</summary>
	Unhealthy
}

/// <summary>
/// Result of a health check operation
/// </summary>
public class HealthCheckResult {
	/// <summary>
	/// Overall health status
	/// </summary>
	public required HealthStatus Status { get; init; }

	/// <summary>
	/// Human-readable description of the health status
	/// </summary>
	public string? Description { get; init; }

	/// <summary>
	/// Optional exception if health check failed
	/// </summary>
	public Exception? Exception { get; init; }

	/// <summary>
	/// Additional diagnostic data
	/// </summary>
	public Dictionary<string, object>? Data { get; init; }

	/// <summary>
	/// Time taken to perform health check
	/// </summary>
	public TimeSpan Duration { get; init; }
}
