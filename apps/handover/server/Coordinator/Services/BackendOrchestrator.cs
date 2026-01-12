using System.Diagnostics;
using Coordinator.Models;

namespace Coordinator.Services;


public class BackendOrchestrator : BackgroundService {
	private readonly ILogger<BackendOrchestrator> _logger;
	private readonly IConfiguration _config;
	private readonly BackendRegistry _registry;
	private readonly List<BackendInstance> _instances = new();
	private readonly SemaphoreSlim _deploymentLock = new(1, 1);
	private int _nextPort;
	private readonly int _healthCheckMaxAttempts;
	private readonly int _healthCheckIntervalMs;
	private readonly int _shutdownDrainTimeMs;
	private readonly string _serverProjectPath;

	public BackendOrchestrator(
		ILogger<BackendOrchestrator> logger,
		IConfiguration config,
		BackendRegistry registry
	) {
		_logger = logger;
		_config = config;
		_registry = registry;

		_nextPort = _config.GetValue<int>("BackendConfig:InitialPort", 5001);
		_healthCheckMaxAttempts = _config.GetValue<int>("BackendConfig:HealthCheckMaxAttempts", 30);
		_healthCheckIntervalMs = _config.GetValue<int>("BackendConfig:HealthCheckIntervalMs", 500);
		_shutdownDrainTimeMs = _config.GetValue<int>("BackendConfig:ShutdownDrainTimeMs", 10000);
		_serverProjectPath = _config.GetValue<string>("BackendConfig:ServerProjectPath")
			?? "../Server/Server.csproj";
	}

	protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
		_logger.LogInformation("Starting initial backend instance on port {Port}", _nextPort);

		try {
			// Start initial backend
			var initial = await StartBackendAsync(_nextPort++, stoppingToken);

			// Wait for it to be healthy
			if (!await WaitForHealthyAsync(initial)) {
				_logger.LogError("Initial backend failed health checks");
				throw new InvalidOperationException("Initial backend failed to start");
			}

			_instances.Add(initial);
			await _registry.UpdateAsync(_instances.Select(i => i.Info).ToList());

			_logger.LogInformation("Initial backend instance started successfully");
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Failed to start initial backend instance");
			throw;
		}
	}

	public async Task<bool> ReloadBackendsAsync() {
		// Prevent concurrent reloads
		if (!await _deploymentLock.WaitAsync(0)) {
			_logger.LogWarning("Reload already in progress, skipping");
			return false;
		}

		try {
			_logger.LogInformation("Starting backend reload on port {Port}", _nextPort);

			// Start new backend
			var newBackend = await StartBackendAsync(_nextPort++, CancellationToken.None);

			// Wait for health check
			if (!await WaitForHealthyAsync(newBackend)) {
				_logger.LogError("New backend failed health checks, aborting reload");
				await newBackend.ShutdownAsync(_logger);
				return false;
			}

			// Add to registry (proxies get notified via SSE)
			_instances.Add(newBackend);
			await _registry.UpdateAsync(_instances.Select(i => i.Info).ToList());

			_logger.LogInformation("New backend is healthy, draining old backend");

			// Drain old backend (allow existing requests to complete)
			if (_instances.Count > 1) {
				var oldBackend = _instances[0];
				await Task.Delay(_shutdownDrainTimeMs);

				// Remove from registry
				_instances.Remove(oldBackend);
				await _registry.UpdateAsync(_instances.Select(i => i.Info).ToList());

				_logger.LogInformation("Shutting down old backend on port {Port}", oldBackend.Info.Port);

				// Shutdown old backend
				await oldBackend.ShutdownAsync(_logger);
			}

			_logger.LogInformation("Backend reload completed successfully");
			return true;
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Failed to reload backends");
			return false;
		}
		finally {
			_deploymentLock.Release();
		}
	}

	private async Task<BackendInstance> StartBackendAsync(int port, CancellationToken cancellationToken) {
		_logger.LogInformation("Starting backend process on port {Port} with project path: {Path}", port, _serverProjectPath);

		// Get the directory containing the project file
		var projectDirectory = Path.GetDirectoryName(_serverProjectPath)
			?? throw new InvalidOperationException($"Could not determine directory for {_serverProjectPath}");

		var startInfo = new ProcessStartInfo {
			FileName = "dotnet",
			Arguments = $"run --project \"{_serverProjectPath}\" --no-launch-profile --urls=http://localhost:{port}",
			UseShellExecute = false,
			CreateNoWindow = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			WorkingDirectory = projectDirectory
		};

		var process = Process.Start(startInfo);
		if (process == null) {
			throw new InvalidOperationException($"Failed to start backend process on port {port}");
		}

		// Log output for debugging
		_ = Task.Run(async () => {
			while (!process.HasExited) {
				var line = await process.StandardOutput.ReadLineAsync(cancellationToken);
				if (!string.IsNullOrEmpty(line)) {
					_logger.LogInformation("[Backend:{Port}] {Output}", port, line);
				}
			}
		}, cancellationToken);

		// Log errors
		_ = Task.Run(async () => {
			while (!process.HasExited) {
				var line = await process.StandardError.ReadLineAsync(cancellationToken);
				if (!string.IsNullOrEmpty(line)) {
					_logger.LogError("[Backend:{Port}] ERROR: {Output}", port, line);
				}
			}
		}, cancellationToken);

		return new BackendInstance {
			Process = process,
			Info = new BackendInfo {
				Address = $"http://localhost:{port}",
				Port = port,
				StartedAt = DateTime.UtcNow,
				Status = "starting"
			}
		};
	}

	private async Task<bool> WaitForHealthyAsync(BackendInstance backend) {
		using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
		int attempt = 0;

		while (attempt < _healthCheckMaxAttempts) {
			try {
				var response = await httpClient.GetAsync($"{backend.Info.Address}/health");
				if (response.IsSuccessStatusCode) {
					_logger.LogInformation("Backend on port {Port} is healthy after {Attempts} attempts",
						backend.Info.Port, attempt + 1);
					// Update status to healthy
					backend.Info = backend.Info with { Status = "healthy" };
					return true;
				}
			}
			catch {
				// Still starting up
			}

			await Task.Delay(_healthCheckIntervalMs);
			attempt++;
		}

		_logger.LogError("Backend on port {Port} failed health checks after {Attempts} attempts",
			backend.Info.Port, attempt);
		return false;
	}

	public override async Task StopAsync(CancellationToken cancellationToken) {
		_logger.LogInformation("Shutting down all backend instances");

		foreach (var instance in _instances.ToList()) {
			await instance.ShutdownAsync(_logger);
		}

		await base.StopAsync(cancellationToken);
	}
}
