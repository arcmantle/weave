using System.Diagnostics;

namespace Coordinator.Models;


public class BackendInstance {
	public Process Process { get; init; } = null!;
	public BackendInfo Info { get; set; } = null!;

	public async Task ShutdownAsync(ILogger logger) {
		try {
			using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
			await client.PostAsync($"{Info.Address}/shutdown", null);

			// Give it time to shutdown gracefully
			await Task.Delay(3000);

			if (!Process.HasExited) {
				logger.LogWarning("Process {Port} did not exit gracefully, forcing kill", Info.Port);
				Process.Kill(entireProcessTree: true);
			}
		}
		catch (Exception ex) {
			logger.LogError(ex, "Error shutting down backend on port {Port}", Info.Port);
			if (!Process.HasExited)
				Process.Kill(entireProcessTree: true);
		}
	}
}
