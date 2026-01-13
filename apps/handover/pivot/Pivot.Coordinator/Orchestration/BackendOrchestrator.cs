using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Pivot.Orchestration.Models;

namespace Pivot.Orchestration;


public class BackendOrchestrator : BackgroundService
{
	private static readonly ActivitySource ActivitySource = new("Pivot.Orchestration");

	// Job object APIs
	[DllImport("kernel32.dll", SetLastError = true)]
	private static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string? lpName);

	[DllImport("kernel32.dll", SetLastError = true)]
	private static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

	[DllImport("kernel32.dll", SetLastError = true)]
	private static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

	// Hard link API
	[DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
	private static extern bool CreateHardLink(string lpFileName, string lpExistingFileName, IntPtr lpSecurityAttributes);

	[StructLayout(LayoutKind.Sequential)]
	private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
	{
		public long PerProcessUserTimeLimit;
		public long PerJobUserTimeLimit;
		public uint LimitFlags;
		public UIntPtr MinimumWorkingSetSize;
		public UIntPtr MaximumWorkingSetSize;
		public uint ActiveProcessLimit;
		public UIntPtr Affinity;
		public uint PriorityClass;
		public uint SchedulingClass;
	}

	[StructLayout(LayoutKind.Sequential)]
	private struct IO_COUNTERS
	{
		public ulong ReadOperationCount;
		public ulong WriteOperationCount;
		public ulong OtherOperationCount;
		public ulong ReadTransferCount;
		public ulong WriteTransferCount;
		public ulong OtherTransferCount;
	}

	[StructLayout(LayoutKind.Sequential)]
	private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
	{
		public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
		public IO_COUNTERS IoInfo;
		public UIntPtr ProcessMemoryLimit;
		public UIntPtr JobMemoryLimit;
		public UIntPtr PeakProcessMemoryUsed;
		public UIntPtr PeakJobMemoryUsed;
	}

	private const int JobObjectExtendedLimitInformation = 9;
	private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;

	private readonly IntPtr _jobHandle;
	private readonly ILogger<BackendOrchestrator> _logger;
	private readonly PivotCoordinatorOptions _options;
	private readonly BackendRegistry _registry;
	private readonly List<BackendInstance> _instances = new();
	private readonly SemaphoreSlim _deploymentLock = new(1, 1);
	private int _nextPort;
	private string? _coordinatorAddress;
	private string? _stableServerBuildPath; // Stable location for Server.dll
	private DateTime _lastServerBuildTime = DateTime.MinValue;

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

		// Create job object to ensure all child processes die when coordinator dies
		if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
		{
			_jobHandle = CreateJobObject(IntPtr.Zero, null);
			var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION
			{
				BasicLimitInformation = new JOBOBJECT_BASIC_LIMIT_INFORMATION
				{
					LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
				}
			};

			int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
			IntPtr extendedInfoPtr = Marshal.AllocHGlobal(length);
			Marshal.StructureToPtr(info, extendedInfoPtr, false);

			if (!SetInformationJobObject(_jobHandle, JobObjectExtendedLimitInformation, extendedInfoPtr, (uint)length))
			{
				_logger.LogWarning("Failed to set job object information");
			}

			Marshal.FreeHGlobal(extendedInfoPtr);
		}
	}

	public void SetCoordinatorAddress(string address)
	{
		_coordinatorAddress = address;
	}

	protected override async Task ExecuteAsync(CancellationToken stoppingToken)
	{
		_logger.LogInformation("Building initial backend");

		// Build the Server project first
		var buildOutputDir = await BuildServerAsync();
		if (buildOutputDir == null)
		{
			_logger.LogError("Initial build failed");
			throw new InvalidOperationException("Initial build failed");
		}

		_logger.LogInformation("Starting initial backend instance on port {Port}", _nextPort);

		try
		{
			// Start initial backend
			var initial = await StartBackendAsync(_nextPort++, buildOutputDir, stoppingToken);

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
			// Build the Server project to a timestamped directory to avoid file locking
			var buildOutputDir = await BuildServerAsync();
			if (buildOutputDir == null)
			{
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
			if (!await WaitForHealthyAsync(newBackend))
			{
				_logger.LogError("New backend failed health checks, aborting reload");
				await newBackend.ShutdownAsync(_logger);
				activity?.SetTag("reload.success", false);
				activity?.SetTag("reload.failure_reason", "health_check_failed");
				return false;
			}

			_logger.LogInformation("New backend is healthy, switching traffic");

			// Switch traffic to new backend immediately
			if (_instances.Count > 0)
			{
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
			else
			{
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

	private async Task<BackendInstance> StartBackendAsync(int port, string outputDir, CancellationToken cancellationToken)
	{
		using var activity = ActivitySource.StartActivity("StartBackend");
		activity?.SetTag("backend.port", port);

		// Use the provided output directory
		var projectName = Path.GetFileName(_options.ServerProjectPath ?? "Server");
		if (projectName.EndsWith(".csproj"))
		{
			projectName = Path.GetFileNameWithoutExtension(projectName);
		}

		var binPath = Path.Combine(outputDir, $"{projectName}.dll");
		if (!File.Exists(binPath))
		{
			throw new InvalidOperationException($"Server DLL not found at {binPath}");
		}

		var command = "dotnet";
		var args = $"exec \"{binPath}\" --urls=http://localhost:{port}";
		var workingDir = outputDir;
		_logger.LogInformation("Starting backend from: {Path}", binPath);

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

		// Assign process to job object so it dies when coordinator dies (Windows only)
		if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows) && _jobHandle != IntPtr.Zero)
		{
			if (!AssignProcessToJobObject(_jobHandle, process.Handle))
			{
				_logger.LogWarning("Failed to assign process {Port} to job object", port);
			}
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
			DeploymentPath = outputDir,
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

	private async Task<string?> BuildServerAsync()
	{
		if (string.IsNullOrEmpty(_options.ServerProjectPath))
		{
			// Using pre-built executable, return standard output dir
			var exePath = _options.ServerExecutablePath!;
			return Path.GetDirectoryName(exePath);
		}

		var projectPath = Path.GetFullPath(_options.ServerProjectPath);
		var projectDir = Path.GetDirectoryName(projectPath)!;
		var projectName = Path.GetFileNameWithoutExtension(projectPath);

		// Check if we need to rebuild the Server project
		var needsRebuild = await CheckIfServerNeedsRebuild(projectDir);

		if (needsRebuild)
		{
			_logger.LogInformation("Server code changed, rebuilding Server project");

			// Build to stable location
			var stableBuildDir = Path.Combine(projectDir, "bin", "ServerBuild");
			Directory.CreateDirectory(stableBuildDir);

			var startInfo = new ProcessStartInfo
			{
				FileName = "dotnet",
				Arguments = $"build \"{projectPath}\" --output \"{stableBuildDir}\"",
				RedirectStandardOutput = true,
				RedirectStandardError = true,
				UseShellExecute = false,
				CreateNoWindow = true
			};

			try
			{
				using var process = Process.Start(startInfo);
				if (process == null)
				{
					_logger.LogError("Failed to start build process");
					return null;
				}

				var output = await process.StandardOutput.ReadToEndAsync();
				var error = await process.StandardError.ReadToEndAsync();

				await process.WaitForExitAsync();

				if (process.ExitCode != 0)
				{
					_logger.LogError("Server build failed with exit code {Code}\n{Output}\n{Error}",
						process.ExitCode, output, error);
					return null;
				}

				_logger.LogInformation("Server build succeeded");
				_stableServerBuildPath = stableBuildDir;
				_lastServerBuildTime = DateTime.UtcNow;
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Error building Server project");
				return null;
			}
		}
		else
		{
			_logger.LogInformation("Server code unchanged, reusing existing build");
		}

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

	private async Task<bool> CheckIfServerNeedsRebuild(string projectDir)
	{
		// First build always needed
		if (_stableServerBuildPath == null || !Directory.Exists(_stableServerBuildPath))
		{
			return true;
		}

		// Check if any .cs files in Server project have been modified since last build
		var serverSourceDir = projectDir;
		var csFiles = Directory.GetFiles(serverSourceDir, "*.cs", SearchOption.AllDirectories)
			.Where(f => !f.Contains("\\bin\\") && !f.Contains("\\obj\\"));

		foreach (var file in csFiles)
		{
			var lastWrite = File.GetLastWriteTimeUtc(file);
			if (lastWrite > _lastServerBuildTime)
			{
				_logger.LogInformation("Server file changed: {File}", Path.GetFileName(file));
				return true;
			}
		}

		// Also check .csproj file
		var csprojPath = Path.Combine(projectDir, $"{Path.GetFileName(projectDir)}.csproj");
		if (File.Exists(csprojPath))
		{
			var lastWrite = File.GetLastWriteTimeUtc(csprojPath);
			if (lastWrite > _lastServerBuildTime)
			{
				_logger.LogInformation("Server .csproj changed");
				return true;
			}
		}

		return false;
	}

	private void CopyServerFiles(string sourceDir, string targetDir, string projectName)
	{
		_logger.LogInformation("Hard linking Server files from {Source} to {Target}", sourceDir, targetDir);

		// Hard link all files recursively (Server.dll, dependencies, config files, etc.)
		HardLinkDirectory(sourceDir, targetDir, recursive: true);

		_logger.LogInformation("Server files hard linked successfully");
	}

	private void HardLinkDirectory(string sourceDir, string targetDir, bool recursive)
	{
		var dir = new DirectoryInfo(sourceDir);

		if (!dir.Exists)
		{
			throw new DirectoryNotFoundException($"Source directory not found: {dir.FullName}");
		}

		// Create target directory
		Directory.CreateDirectory(targetDir);

		// Hard link files
		foreach (FileInfo file in dir.GetFiles())
		{
			string targetFilePath = Path.Combine(targetDir, file.Name);
			CreateHardLinkSafe(targetFilePath, file.FullName);
		}

		// Process subdirectories recursively
		if (recursive)
		{
			foreach (DirectoryInfo subDir in dir.GetDirectories())
			{
				// Skip plugins directory if it exists - we'll create fresh one
				if (subDir.Name.Equals("plugins", StringComparison.OrdinalIgnoreCase))
				{
					continue;
				}

				string newTargetDir = Path.Combine(targetDir, subDir.Name);
				HardLinkDirectory(subDir.FullName, newTargetDir, recursive: true);
			}
		}
	}

	private void CreateHardLinkSafe(string linkPath, string targetPath)
	{
		if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
		{
			if (!CreateHardLink(linkPath, targetPath, IntPtr.Zero))
			{
				var error = Marshal.GetLastWin32Error();
				_logger.LogWarning("Failed to create hard link {Link} -> {Target}, falling back to copy (error: {Error})",
					linkPath, targetPath, error);
				File.Copy(targetPath, linkPath, overwrite: true);
			}
		}
		else
		{
			// Linux/Mac: use File API or fall back to ln command
			try
			{
				// Try using File.CreateSymbolicLink (requires elevated permissions for symlinks, but hard links don't)
				// For now, fall back to ln command which is more reliable
				var process = Process.Start(new ProcessStartInfo
				{
					FileName = "ln",
					Arguments = $"\"{targetPath}\" \"{linkPath}\"",
					UseShellExecute = false,
					RedirectStandardError = true,
					CreateNoWindow = true
				});

				if (process != null)
				{
					process.WaitForExit();
					if (process.ExitCode != 0)
					{
						_logger.LogWarning("Failed to create hard link, falling back to copy");
						File.Copy(targetPath, linkPath, overwrite: true);
					}
				}
			}
			catch
			{
				_logger.LogWarning("Failed to create hard link, falling back to copy");
				File.Copy(targetPath, linkPath, overwrite: true);
			}
		}
	}

	private void CopyPluginDlls(string projectDir, string outputDir)
	{
		// Hard link plugin DLLs from their build output to the timestamped deployment directory
		var pluginsDir = Path.Combine(projectDir, "..", "Plugins");
		if (!Directory.Exists(pluginsDir))
		{
			_logger.LogWarning("Plugins directory not found: {Dir}", pluginsDir);
			return;
		}

		// Create plugins subdirectory in deployment output
		var targetPluginsDir = Path.Combine(outputDir, "plugins");
		Directory.CreateDirectory(targetPluginsDir);

		var pluginProjects = Directory.GetDirectories(pluginsDir);
		foreach (var pluginProject in pluginProjects)
		{
			var pluginName = Path.GetFileName(pluginProject);
			var pluginOutputDir = Path.Combine(pluginProject, "bin", "Debug", "net9.0");

			if (!Directory.Exists(pluginOutputDir))
			{
				_logger.LogWarning("Plugin output directory not found: {Path}", pluginOutputDir);
				continue;
			}

			// Hard link all plugin output files (dll, pdb, deps.json, etc.)
			var pluginFiles = Directory.GetFiles(pluginOutputDir, $"{pluginName}.*");
			if (pluginFiles.Length == 0)
			{
				_logger.LogWarning("No plugin files found for: {Plugin}", pluginName);
				continue;
			}

			foreach (var pluginFile in pluginFiles)
			{
				var fileName = Path.GetFileName(pluginFile);
				var targetPath = Path.Combine(targetPluginsDir, fileName);
				CreateHardLinkSafe(targetPath, pluginFile);
			}

			_logger.LogInformation("Hard linked {Count} files for plugin: {Plugin}", pluginFiles.Length, pluginName);
		}
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

	public override void Dispose()
	{
		// Ensure cleanup happens even if StopAsync wasn't called
		_logger.LogInformation("Disposing BackendOrchestrator, cleaning up {Count} backend instances", _instances.Count);

		foreach (var instance in _instances.ToList())
		{
			try
			{
				if (!instance.Process.HasExited)
				{
					_logger.LogInformation("Force killing backend on port {Port}", instance.Info.Port);
					instance.Process.Kill(entireProcessTree: true);
				}
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Error killing backend process on port {Port}", instance.Info.Port);
			}
		}

		_instances.Clear();
		_deploymentLock.Dispose();
		base.Dispose();
	}
}
