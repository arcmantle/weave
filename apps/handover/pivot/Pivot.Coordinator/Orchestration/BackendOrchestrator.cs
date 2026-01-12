using System.Diagnostics;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Pivot.Orchestration.Models;

namespace Pivot.Orchestration;


public class BackendOrchestrator : BackgroundService
{
	private static readonly ActivitySource ActivitySource = new("Pivot.Orchestration");

	private readonly ILogger<BackendOrchestrator> _logger;
	private readonly PivotCoordinatorOptions _options;
	private readonly BackendRegistry _registry;
	private readonly List<BackendInstance> _instances = new();
	private readonly SemaphoreSlim _deploymentLock = new(1, 1);
	private int _nextPort;
	private string? _coordinatorAddress;

	public BackendOrchestrator(
		ILogger<BackendOrchestrator> logger,
		PivotCoordinatorOptions options,
		BackendRegistry registry
	)
	{
		_logger = logger;
		_options = options;
		_registry = registry;
		_nextPort = options.InitialPort;
	}

	public void SetCoordinatorAddress(string address)
	{
		_coordinatorAddress = address;
	}

	protected override async Task ExecuteAsync(CancellationToken stoppingToken)
	{
		_logger.LogInformation("Starting initial backend instance on port {Port}", _nextPort);

		try
		{
			// Start initial backend
			var initial = await StartBackendAsync(_nextPort++, stoppingToken);

			// Wait for it to be healthy
			if (!await WaitForHealthyAsync(initial))
			{
				_logger.LogError("Initial backend failed health checks");
				throw new InvalidOperationException("Initial backend failed to start");
			}

			_instances.Add(initial);
			await _registry.UpdateAsync(_instances.Select(i => i.Info).ToList());

			_logger.LogInformation("Initial backend instance started successfully");
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Failed to start initial backend instance");
			throw;
		}
	}

	public async Task<bool> ReloadBackendsAsync()
	{
		using var activity = ActivitySource.StartActivity("ReloadBackends");
		var startTime = DateTime.UtcNow;

		// Prevent concurrent reloads
		if (!await _deploymentLock.WaitAsync(0))
		{
			_logger.LogWarning("Reload already in progress, skipping");
			activity?.SetTag("reload.skipped", true);
			return false;
		}

		try
		{
			_logger.LogInformation("Starting backend reload on port {Port}", _nextPort);
			activity?.SetTag("backend.port", _nextPort);

			// Start new backend
			var newBackend = await StartBackendAsync(_nextPort++, CancellationToken.None);

			// Wait for health check
			if (!await WaitForHealthyAsync(newBackend))
			{
				_logger.LogError("New backend failed health checks, aborting reload");
				await newBackend.ShutdownAsync(_logger);
				activity?.SetTag("reload.success", false);
				activity?.SetTag("reload.failure_reason", "health_check_failed");
				return false;
			}

			// Add to registry (proxies get notified via SSE)
			_instances.Add(newBackend);
			await _registry.UpdateAsync(_instances.Select(i => i.Info).ToList());

			_logger.LogInformation("New backend is healthy, draining old backend");

			// Drain old backend (allow existing requests to complete)
			if (_instances.Count > 1)
			{
				var oldBackend = _instances[0];
				await Task.Delay(_options.ShutdownDrainTimeMs);

				// Remove from registry
				_instances.Remove(oldBackend);
				await _registry.UpdateAsync(_instances.Select(i => i.Info).ToList());

				_logger.LogInformation("Shutting down old backend on port {Port}", oldBackend.Info.Port);

				// Shutdown old backend
				await oldBackend.ShutdownAsync(_logger);
			}

			var duration = (DateTime.UtcNow - startTime).TotalMilliseconds;
			_logger.LogInformation("Backend reload completed successfully in {Duration}ms", duration);

			activity?.SetTag("reload.success", true);
			activity?.SetTag("reload.duration_ms", duration);
			activity?.SetTag("backends.count", _instances.Count);

			return true;
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Failed to reload backends");
			activity?.SetTag("reload.success", false);
			activity?.SetTag("error.type", ex.GetType().Name);
			activity?.SetTag("error.message", ex.Message);
			return false;
		}
		finally
		{
			_deploymentLock.Release();
		}
	}

	private async Task<BackendInstance> StartBackendAsync(int port, CancellationToken cancellationToken)
	{
		using var activity = ActivitySource.StartActivity("StartBackend");
		activity?.SetTag("backend.port", port);

		string command, args, workingDir;

		// Auto-detect executable or project
		if (!string.IsNullOrEmpty(_options.ServerExecutablePath))
		{
			// Explicit executable path provided
			command = "dotnet";
			args = $"exec \"{_options.ServerExecutablePath}\" --urls=http://localhost:{port}";
			workingDir = Path.GetDirectoryName(_options.ServerExecutablePath)!;
			_logger.LogInformation("Starting backend from executable: {Path}", _options.ServerExecutablePath);
		}
		else if (!string.IsNullOrEmpty(_options.ServerProjectPath))
		{
			// Project path provided - auto-detect compiled DLL
			// Resolve relative path from current directory
			var projectPath = Path.GetFullPath(_options.ServerProjectPath);
			var projectDir = Path.GetDirectoryName(projectPath)!;
			var projectName = Path.GetFileNameWithoutExtension(projectPath);

			var binDebug = Path.Combine(projectDir, "bin", "Debug", "net9.0", $"{projectName}.dll");
			var binRelease = Path.Combine(projectDir, "bin", "Release", "net9.0", $"{projectName}.dll");

			if (File.Exists(binDebug))
			{
				command = "dotnet";
				args = $"exec \"{binDebug}\" --urls=http://localhost:{port}";
				workingDir = Path.GetDirectoryName(binDebug)!;
				_logger.LogInformation("Starting backend from Debug DLL: {Path}", binDebug);
			}
			else if (File.Exists(binRelease))
			{
				command = "dotnet";
				args = $"exec \"{binRelease}\" --urls=http://localhost:{port}";
				workingDir = Path.GetDirectoryName(binRelease)!;
				_logger.LogInformation("Starting backend from Release DLL: {Path}", binRelease);
			}
			else
			{
				// Fall back to dotnet run
				command = "dotnet";
				args = $"run --project \"{projectPath}\" --no-launch-profile --urls=http://localhost:{port}";
				workingDir = projectDir;
				_logger.LogInformation("Starting backend via dotnet run: {Path}", _options.ServerProjectPath);
			}
		}
		else
		{
			throw new InvalidOperationException(
				"Must configure ServerProjectPath or ServerExecutablePath in PivotCoordinatorOptions");
		}

		var startInfo = new ProcessStartInfo
		{
			FileName = command,
			Arguments = args,
			UseShellExecute = false,
			CreateNoWindow = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			WorkingDirectory = workingDir
		};

		// Set PIVOT_COORDINATOR_URL environment variable for file watcher
		if (!string.IsNullOrEmpty(_coordinatorAddress))
		{
			startInfo.Environment["PIVOT_COORDINATOR_URL"] = _coordinatorAddress;
		}

		var process = Process.Start(startInfo);
		if (process == null)
		{
			throw new InvalidOperationException($"Failed to start backend process on port {port}");
		}

		// Log output for debugging
		_ = Task.Run(async () =>
		{
			while (!process.HasExited)
			{
				var line = await process.StandardOutput.ReadLineAsync(cancellationToken);
				if (!string.IsNullOrEmpty(line))
				{
					_logger.LogInformation("[Backend:{Port}] {Output}", port, line);
				}
			}
		}, cancellationToken);

		// Log errors
		_ = Task.Run(async () =>
		{
			while (!process.HasExited)
			{
				var line = await process.StandardError.ReadLineAsync(cancellationToken);
				if (!string.IsNullOrEmpty(line))
				{
					_logger.LogError("[Backend:{Port}] ERROR: {Output}", port, line);
				}
			}
		}, cancellationToken);

		return new BackendInstance
		{
			Process = process,
			Info = new BackendInfo
			{
				Address = $"http://localhost:{port}",
				Port = port,
				StartedAt = DateTime.UtcNow,
				Status = "starting"
			}
		};
	}

	private async Task<bool> WaitForHealthyAsync(BackendInstance backend)
	{
		using var activity = ActivitySource.StartActivity("HealthCheck");
		activity?.SetTag("backend.port", backend.Info.Port);
		activity?.SetTag("backend.address", backend.Info.Address);

		using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
		int attempt = 0;

		while (attempt < _options.HealthCheckMaxAttempts)
		{
			try
			{
				var response = await httpClient.GetAsync($"{backend.Info.Address}/health");
				if (response.IsSuccessStatusCode)
				{
					_logger.LogInformation("Backend on port {Port} is healthy after {Attempts} attempts",
						backend.Info.Port, attempt + 1);
					// Update status to healthy
					backend.Info = backend.Info with { Status = "healthy" };

					activity?.SetTag("health.success", true);
					activity?.SetTag("health.attempts", attempt + 1);

					return true;
				}
			}
			catch
			{
				// Still starting up
			}

			await Task.Delay(_options.HealthCheckIntervalMs);
			attempt++;
		}

		_logger.LogError("Backend on port {Port} failed health checks after {Attempts} attempts",
			backend.Info.Port, attempt);

		activity?.SetTag("health.success", false);
		activity?.SetTag("health.attempts", attempt);

		return false;
	}

	public override async Task StopAsync(CancellationToken cancellationToken)
	{
		_logger.LogInformation("Shutting down all backend instances");

		foreach (var instance in _instances.ToList())
		{
			await instance.ShutdownAsync(_logger);
		}

		await base.StopAsync(cancellationToken);
	}
}
