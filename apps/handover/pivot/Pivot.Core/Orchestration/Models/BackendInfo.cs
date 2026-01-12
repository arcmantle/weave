namespace Pivot.Orchestration.Models;


public record BackendInfo {
	public string Address { get; init; } = "";
	public int Port { get; init; }
	public DateTime StartedAt { get; init; }
	public string Status { get; init; } = "healthy";
}
