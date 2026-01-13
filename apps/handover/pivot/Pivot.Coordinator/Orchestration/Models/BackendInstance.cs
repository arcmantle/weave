using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace Pivot.Orchestration.Models;


public class BackendInstance
{
	public Process Process { get; init; } = null!;
	public BackendInfo Info { get; set; } = null!;
	public string DeploymentPath { get; init; } = null!;

	public async Task ShutdownAsync(ILogger logger)
	{
		try
		{
			using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
			await client.PostAsync($"{Info.Address}/shutdown", null);

			// Give it time to shutdown gracefully
			await Task.Delay(3000);

			if (!Process.HasExited)
			{
				logger.LogWarning("Process {Port} did not exit gracefully, forcing kill", Info.Port);
				Process.Kill(entireProcessTree: true);
			}

			// Clean up deployment directory
			CleanupDeployment(logger);
		}
		catch (Exception ex)
		{
			logger.LogError(ex, "Error shutting down backend on port {Port}", Info.Port);
			if (!Process.HasExited)
				Process.Kill(entireProcessTree: true);

			// Still try to clean up
			CleanupDeployment(logger);
		}
	}

	private void CleanupDeployment(ILogger logger)
	{
		if (string.IsNullOrEmpty(DeploymentPath) || !Directory.Exists(DeploymentPath))
		{
			return;
		}

		try
		{
			logger.LogInformation("Cleaning up deployment directory: {Path}", DeploymentPath);
			Directory.Delete(DeploymentPath, recursive: true);
			logger.LogInformation("Deployment directory cleaned up successfully");
		}
		catch (Exception ex)
		{
			logger.LogWarning(ex, "Failed to clean up deployment directory: {Path}", DeploymentPath);
		}
	}
}
