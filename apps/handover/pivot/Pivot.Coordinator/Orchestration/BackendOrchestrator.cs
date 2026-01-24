using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Pivot.Coordinator;
using Pivot.Coordinator.Services;
using Pivot.Orchestration.Models;

namespace Pivot.Orchestration;


public partial class BackendOrchestrator : BackgroundService {
	private static readonly ActivitySource ActivitySource = new("Pivot.Orchestration");

	// Cross-platform hard link APIs
	[LibraryImport("kernel32.dll", StringMarshalling = StringMarshalling.Utf16, SetLastError = true)]
	[return: MarshalAs(UnmanagedType.Bool)]
	private static partial bool CreateHardLink(string lpFileName, string lpExistingFileName, IntPtr lpSecurityAttributes);

	[LibraryImport("libc", StringMarshalling = StringMarshalling.Utf8, SetLastError = true)]
	private static partial int Link(string oldpath, string newpath);

	private readonly ILogger<BackendOrchestrator> _logger;
	private readonly PivotCoordinatorOptions _options;
	private readonly BackendRegistry _registry;
	private readonly IServiceProvider _serviceProvider;
	private readonly List<BackendInstance> _instances = new();
	private readonly SemaphoreSlim _deploymentLock = new(1, 1);
	private int _nextPort;
	private string? _coordinatorAddress;
	private string? _stableServerBuildPath; // Stable location for Server.dll
	private DateTime _lastServerBuildTime = DateTime.MinValue;

	public BackendOrchestrator(
		ILogger<BackendOrchestrator> logger,
		PivotCoordinatorOptions options,
		BackendRegistry registry,
		IServiceProvider serviceProvider
	) {
		_logger = logger;
		_options = options;
		_registry = registry;
		_serviceProvider = serviceProvider;
		_nextPort = options.InitialPort;
	}

	public void SetCoordinatorAddress(string address) {
		_coordinatorAddress = address;
	}

	protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
		_logger.LogInformation("Building initial backend");

		// Build the Server project first
		var buildOutputDir = await BuildServerAsync();
		if (buildOutputDir == null) {
			_logger.LogError("Initial build failed");
			throw new InvalidOperationException("Initial build failed");
		}

		_logger.LogInformation("Starting initial backend instance on port {Port}", _nextPort);

		try {
			// Start initial backend
			var initial = await StartBackendAsync(_nextPort++, buildOutputDir, stoppingToken);

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
		using var activity = ActivitySource.StartActivity("ReloadBackends");
		var startTime = DateTime.UtcNow;

		// Prevent concurrent reloads
		if (!await _deploymentLock.WaitAsync(0)) {
			_logger.LogWarning("Reload already in progress, skipping");
			activity?.SetTag("reload.skipped", true);
			return false;
		}

		try {
			// Build the Server project to a timestamped directory to avoid file locking
			var buildOutputDir = await BuildServerAsync();
			if (buildOutputDir == null) {
				_logger.LogError("Server build failed, aborting reload");
				activity?.SetTag("reload.success", false);
				activity?.SetTag("reload.failure_reason", "build_failed");
				return false;
			}

			_logger.LogInformation("Starting backend reload on port {Port}", _nextPort);
			activity?.SetTag("backend.port", _nextPort);

			// Start new backend using DLL from the timestamped build directory
			var newBackend = await StartBackendAsync(_nextPort++, buildOutputDir, CancellationToken.None);

			// Wait for health check
			if (!await WaitForHealthyAsync(newBackend)) {
				_logger.LogError("New backend failed health checks, aborting reload");
				await newBackend.ShutdownAsync(_logger);
				activity?.SetTag("reload.success", false);
				activity?.SetTag("reload.failure_reason", "health_check_failed");

				// Attempt auto-recovery if plugin management is enabled
				await AttemptAutoRecoveryAsync();

				return false;
			}

			_logger.LogInformation("New backend is healthy, switching traffic");

			// Switch traffic to new backend immediately
			if (_instances.Count > 0) {
				var oldBackend = _instances[0];
				_logger.LogInformation("Removing old backend on port {Port} from routing", oldBackend.Info.Port);

				// Remove old backend from registry BEFORE adding new one
				_instances.Remove(oldBackend);
				_instances.Add(newBackend);
				await _registry.UpdateAsync(_instances.Select(i => i.Info).ToList());

				_logger.LogInformation("Traffic switched to new backend on port {Port}, draining old backend", newBackend.Info.Port);

				// Wait for in-flight requests to old backend to complete
				await Task.Delay(_options.ShutdownDrainTimeMs);

				_logger.LogInformation("Shutting down old backend on port {Port}", oldBackend.Info.Port);
				await oldBackend.ShutdownAsync(_logger);
			}
			else {
				// First backend - just add it
				_instances.Add(newBackend);
				await _registry.UpdateAsync(_instances.Select(i => i.Info).ToList());
			}

			var duration = (DateTime.UtcNow - startTime).TotalMilliseconds;
			_logger.LogInformation("Backend reload completed successfully in {Duration}ms", duration);

			activity?.SetTag("reload.success", true);
			activity?.SetTag("reload.duration_ms", duration);
			activity?.SetTag("backends.count", _instances.Count);

			return true;
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Failed to reload backends");
			activity?.SetTag("reload.success", false);
			activity?.SetTag("error.type", ex.GetType().Name);
			activity?.SetTag("error.message", ex.Message);
			return false;
		}
		finally {
			_deploymentLock.Release();
		}
	}

	private async Task<BackendInstance> StartBackendAsync(int port, string outputDir, CancellationToken cancellationToken) {
		using var activity = ActivitySource.StartActivity("StartBackend");
		activity?.SetTag("backend.port", port);

		// Use the provided output directory
		var projectName = Path.GetFileName(_options.ServerProjectPath ?? "Server");
		if (projectName.EndsWith(".csproj")) {
			projectName = Path.GetFileNameWithoutExtension(projectName);
		}

		var binPath = Path.Combine(outputDir, $"{projectName}.dll");
		if (!File.Exists(binPath)) {
			throw new InvalidOperationException($"Server DLL not found at {binPath}");
		}

		var command = "dotnet";
		var args = $"exec \"{binPath}\" --urls=http://localhost:{port}";
		var workingDir = outputDir;
		_logger.LogInformation("Starting backend from: {Path}", binPath);

		var startInfo = new ProcessStartInfo {
			FileName = command,
			Arguments = args,
			UseShellExecute = false,
			CreateNoWindow = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			WorkingDirectory = workingDir
		};

		// Set PIVOT_COORDINATOR_URL environment variable for file watcher
		if (!string.IsNullOrEmpty(_coordinatorAddress)) {
			startInfo.Environment["PIVOT_COORDINATOR_URL"] = _coordinatorAddress;
		}

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
			DeploymentPath = outputDir,
			Info = new BackendInfo {
				Address = $"http://localhost:{port}",
				Port = port,
				StartedAt = DateTime.UtcNow,
				Status = "starting"
			}
		};
	}

	private async Task<bool> WaitForHealthyAsync(BackendInstance backend) {
		using var activity = ActivitySource.StartActivity("HealthCheck");
		activity?.SetTag("backend.port", backend.Info.Port);
		activity?.SetTag("backend.address", backend.Info.Address);

		using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
		int attempt = 0;

		while (attempt < _options.HealthCheckMaxAttempts) {
			try {
				var response = await httpClient.GetAsync($"{backend.Info.Address}/health");
				if (response.IsSuccessStatusCode) {
					_logger.LogInformation("Backend on port {Port} is healthy after {Attempts} attempts",
						backend.Info.Port, attempt + 1);
					// Update status to healthy
					backend.Info = backend.Info with { Status = "healthy" };

					activity?.SetTag("health.success", true);
					activity?.SetTag("health.attempts", attempt + 1);

					return true;
				}
			}
			catch {
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

	private async Task<string?> BuildServerAsync() {
		if (string.IsNullOrEmpty(_options.ServerProjectPath)) {
			// Using pre-built executable, return standard output dir
			var exePath = _options.ServerExecutablePath!;
			return Path.GetDirectoryName(exePath);
		}

		var projectPath = Path.GetFullPath(_options.ServerProjectPath);
		var projectDir = Path.GetDirectoryName(projectPath)!;
		var projectName = Path.GetFileNameWithoutExtension(projectPath);

		// Check if we need to rebuild the Server project
		var needsRebuild = await CheckIfServerNeedsRebuild(projectDir);

		if (needsRebuild) {
			_logger.LogInformation("Server code changed, rebuilding Server project");

			// Build to stable location
			var stableBuildDir = Path.Combine(projectDir, "bin", "ServerBuild");
			Directory.CreateDirectory(stableBuildDir);

			var startInfo = new ProcessStartInfo {
				FileName = "dotnet",
				Arguments = $"build \"{projectPath}\" --output \"{stableBuildDir}\"",
				RedirectStandardOutput = true,
				RedirectStandardError = true,
				UseShellExecute = false,
				CreateNoWindow = true
			};

			try {
				using var process = Process.Start(startInfo);
				if (process == null) {
					_logger.LogError("Failed to start build process");
					return null;
				}

				var output = await process.StandardOutput.ReadToEndAsync();
				var error = await process.StandardError.ReadToEndAsync();

				await process.WaitForExitAsync();

				if (process.ExitCode != 0) {
					_logger.LogError("Server build failed with exit code {Code}\n{Output}\n{Error}",
						process.ExitCode, output, error);
					return null;
				}

				_logger.LogInformation("Server build succeeded");
				_stableServerBuildPath = stableBuildDir;
				_lastServerBuildTime = DateTime.UtcNow;
			}
			catch (Exception ex) {
				_logger.LogError(ex, "Error building Server project");
				return null;
			}
		}
		else {
			_logger.LogInformation("Server code unchanged, reusing existing build");
		}

		// Deploy enabled plugins if plugin management is enabled
		await DeployEnabledPluginsAsync();

		// Create timestamped deployment directory
		var timestamp = DateTime.Now.ToString("yyyyMMdd-HHmmss-fff");
		var deploymentDir = Path.Combine(projectDir, "bin", "Deployments", timestamp);
		Directory.CreateDirectory(deploymentDir);

		// Copy Server.dll and dependencies from stable build
		CopyServerFiles(_stableServerBuildPath!, deploymentDir, projectName);

		// Copy plugin DLLs to plugins/ subdirectory
		CopyPluginDlls(projectDir, deploymentDir);

		_logger.LogInformation("Deployment prepared at: {Dir}", deploymentDir);
		return deploymentDir;
	}

	/// <summary>
	/// Deploy enabled plugins from repository to active directory if plugin management is enabled
	/// </summary>
	private async Task DeployEnabledPluginsAsync() {
		var pluginStateService = _serviceProvider.GetService<PluginStateService>();
		if (pluginStateService == null) {
			// Plugin management not enabled
			return;
		}

		try {
			await pluginStateService.DeployEnabledPluginsAsync();
			_logger.LogInformation("Enabled plugins deployed successfully");
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Failed to deploy enabled plugins");
			// Continue anyway - might be using development mode
		}
	}

	/// <summary>
	/// Attempt to recover from backend failure by disabling recently modified plugins
	/// </summary>
	private async Task AttemptAutoRecoveryAsync() {
		var pluginStateService = _serviceProvider.GetService<PluginStateService>();
		var pluginOptions = _serviceProvider.GetService<PluginManagementOptions>();

		if (pluginStateService == null || pluginOptions == null || !pluginOptions.AutoDisableOnFailure) {
			_logger.LogWarning("Auto-recovery not configured. Manual intervention required.");
			return;
		}

		try {
			// Get recently modified plugins
			var recentPlugins = await pluginStateService.GetRecentlyModifiedPluginsAsync();

			if (!recentPlugins.Any()) {
				_logger.LogWarning("No recently modified plugins found. Backend failure may not be plugin-related.");
				return;
			}

			_logger.LogWarning("Attempting auto-recovery by disabling {Count} recently modified plugins: {Plugins}",
				recentPlugins.Count(), string.Join(", ", recentPlugins));

			// Disable the recently modified plugins
			await pluginStateService.DisablePluginsAsync(recentPlugins);

			_logger.LogInformation("Auto-recovery completed. Disabled plugins: {Plugins}. " +
				"Trigger a manual reload to deploy the updated configuration.",
				string.Join(", ", recentPlugins));
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Auto-recovery attempt failed");
		}
	}

	private async Task<bool> CheckIfServerNeedsRebuild(string projectDir) {
		// First build always needed
		if (_stableServerBuildPath == null || !Directory.Exists(_stableServerBuildPath)) {
			return true;
		}

		// Check if any .cs files in Server project have been modified since last build
		var serverSourceDir = projectDir;
		var csFiles = Directory.GetFiles(serverSourceDir, "*.cs", SearchOption.AllDirectories)
			.Where(f => !f.Contains("\\bin\\") && !f.Contains("\\obj\\"));

		foreach (var file in csFiles) {
			var lastWrite = File.GetLastWriteTimeUtc(file);
			if (lastWrite > _lastServerBuildTime) {
				_logger.LogInformation("Server file changed: {File}", Path.GetFileName(file));
				return true;
			}
		}

		// Also check .csproj file
		var csprojPath = Path.Combine(projectDir, $"{Path.GetFileName(projectDir)}.csproj");
		if (File.Exists(csprojPath)) {
			var lastWrite = File.GetLastWriteTimeUtc(csprojPath);
			if (lastWrite > _lastServerBuildTime) {
				_logger.LogInformation("Server .csproj changed");
				return true;
			}
		}

		return false;
	}

	private void CopyServerFiles(string sourceDir, string targetDir, string projectName) {
		_logger.LogInformation("Hard linking Server files from {Source} to {Target}", sourceDir, targetDir);

		// Hard link all files recursively (Server.dll, dependencies, config files, etc.)
		HardLinkDirectory(sourceDir, targetDir, recursive: true);

		_logger.LogInformation("Server files hard linked successfully");
	}

	private void HardLinkDirectory(string sourceDir, string targetDir, bool recursive) {
		var dir = new DirectoryInfo(sourceDir);

		if (!dir.Exists) {
			throw new DirectoryNotFoundException($"Source directory not found: {dir.FullName}");
		}

		// Create target directory
		Directory.CreateDirectory(targetDir);

		// Hard link files
		foreach (FileInfo file in dir.GetFiles()) {
			string targetFilePath = Path.Combine(targetDir, file.Name);
			CreateHardLinkSafe(targetFilePath, file.FullName);
		}

		// Process subdirectories recursively
		if (recursive) {
			foreach (DirectoryInfo subDir in dir.GetDirectories()) {
				// Skip plugins directory if it exists - we'll create fresh one
				if (subDir.Name.Equals("plugins", StringComparison.OrdinalIgnoreCase)) {
					continue;
				}

				string newTargetDir = Path.Combine(targetDir, subDir.Name);
				HardLinkDirectory(subDir.FullName, newTargetDir, recursive: true);
			}
		}
	}

	private void CreateHardLinkSafe(string linkPath, string targetPath) {
		try {
			if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) {
				// Windows: use kernel32.dll CreateHardLink
				if (!CreateHardLink(linkPath, targetPath, IntPtr.Zero)) {
					var error = Marshal.GetLastWin32Error();
					throw new IOException($"CreateHardLink failed with error code {error}");
				}
			}
			else {
				// Linux/macOS: use libc link()
				if (Link(targetPath, linkPath) != 0) {
					var error = Marshal.GetLastWin32Error();
					throw new IOException($"link() failed with error code {error}");
				}
			}
		}
		catch (Exception ex) {
			// Fall back to copy if hard link fails (e.g., filesystem doesn't support it, or cross-volume)
			_logger.LogWarning(ex, "Failed to create hard link {Link} -> {Target}, falling back to copy", linkPath, targetPath);
			File.Copy(targetPath, linkPath, overwrite: true);
		}
	}

	private void CopyPluginDlls(string projectDir, string outputDir) {
		// Hard link plugin DLLs from their build output to the timestamped deployment directory
		var pluginsDir = Path.Combine(projectDir, "..", "Plugins");
		if (!Directory.Exists(pluginsDir)) {
			_logger.LogWarning("Plugins directory not found: {Dir}", pluginsDir);
			return;
		}

		// Create plugins subdirectory in deployment output
		var targetPluginsDir = Path.Combine(outputDir, "plugins");
		Directory.CreateDirectory(targetPluginsDir);

		var pluginProjects = Directory.GetDirectories(pluginsDir);
		foreach (var pluginProject in pluginProjects) {
			var pluginName = Path.GetFileName(pluginProject);
			var pluginOutputDir = Path.Combine(pluginProject, "bin", "Debug", "net9.0");

			if (!Directory.Exists(pluginOutputDir)) {
				_logger.LogWarning("Plugin output directory not found: {Path}", pluginOutputDir);
				continue;
			}

			// Hard link all plugin output files (dll, pdb, deps.json, etc.)
			var pluginFiles = Directory.GetFiles(pluginOutputDir, $"{pluginName}.*");
			if (pluginFiles.Length == 0) {
				_logger.LogWarning("No plugin files found for: {Plugin}", pluginName);
				continue;
			}

			foreach (var pluginFile in pluginFiles) {
				var fileName = Path.GetFileName(pluginFile);
				var targetPath = Path.Combine(targetPluginsDir, fileName);
				CreateHardLinkSafe(targetPath, pluginFile);
			}

			_logger.LogInformation("Hard linked {Count} files for plugin: {Plugin}", pluginFiles.Length, pluginName);
		}
	}

	public override async Task StopAsync(CancellationToken cancellationToken) {
		_logger.LogInformation("Shutting down all backend instances");

		foreach (var instance in _instances.ToList()) {
			await instance.ShutdownAsync(_logger);
		}

		await base.StopAsync(cancellationToken);
	}

	public override void Dispose() {
		// Ensure cleanup happens even if StopAsync wasn't called
		_logger.LogInformation("Disposing BackendOrchestrator, cleaning up {Count} backend instances", _instances.Count);

		foreach (var instance in _instances.ToList()) {
			try {
				if (!instance.Process.HasExited) {
					_logger.LogInformation("Force killing backend on port {Port}", instance.Info.Port);
					instance.Process.Kill(entireProcessTree: true);
				}
			}
			catch (Exception ex) {
				_logger.LogError(ex, "Error killing backend process on port {Port}", instance.Info.Port);
			}
		}

		_instances.Clear();
		_deploymentLock.Dispose();
		base.Dispose();
	}
}
