using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Pivot.Orchestration;
using System.Diagnostics;

namespace Pivot.Development;

/// <summary>
/// Development-only service that watches plugin source files and rebuilds changed plugins.
/// </summary>
public class PluginSourceWatcher : BackgroundService
{
	private readonly ILogger<PluginSourceWatcher> _logger;
	private readonly PivotCoordinatorOptions _options;
	private readonly IHostEnvironment _environment;
	private readonly BackendOrchestrator _orchestrator;
	private FileSystemWatcher? _watcher;
	private Timer? _debounceTimer;
	private string? _changedPluginPath;

	public PluginSourceWatcher(
		ILogger<PluginSourceWatcher> logger,
		PivotCoordinatorOptions options,
		IHostEnvironment environment,
		BackendOrchestrator orchestrator
	)
	{
		_logger = logger;
		_options = options;
		_environment = environment;
		_orchestrator = orchestrator;
	}

	protected override Task ExecuteAsync(CancellationToken stoppingToken)
	{
		// Only run in development
		if (!_environment.IsDevelopment())
		{
			_logger.LogInformation("PluginSourceWatcher disabled in non-development environment");
			return Task.CompletedTask;
		}

		if (string.IsNullOrEmpty(_options.ServerProjectPath))
		{
			_logger.LogWarning("ServerProjectPath not configured, plugin source watching disabled");
			return Task.CompletedTask;
		}

		// Determine plugins directory
		var serverProjectDir = Path.GetDirectoryName(Path.GetFullPath(_options.ServerProjectPath));
		if (serverProjectDir == null)
		{
			_logger.LogWarning("Could not determine server project directory");
			return Task.CompletedTask;
		}

		var pluginsDir = Path.Combine(serverProjectDir, "..", "Plugins");
		if (!Directory.Exists(pluginsDir))
		{
			_logger.LogInformation("No Plugins directory found at {Dir}, source watching disabled", pluginsDir);
			return Task.CompletedTask;
		}

		pluginsDir = Path.GetFullPath(pluginsDir);
		_logger.LogInformation("Watching plugin source files in: {Dir}", pluginsDir);

		_watcher = new FileSystemWatcher(pluginsDir)
		{
			NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName,
			Filter = "*.cs",
			IncludeSubdirectories = true,
			EnableRaisingEvents = true
		};

		_watcher.Changed += OnSourceChanged;
		_watcher.Created += OnSourceChanged;
		_watcher.Deleted += OnSourceChanged;

		return Task.CompletedTask;
	}

	private void OnSourceChanged(object sender, FileSystemEventArgs e)
	{
		// Ignore bin/obj directories
		if (e.FullPath.Contains("\\bin\\") || e.FullPath.Contains("\\obj\\"))
		{
			return;
		}

		_logger.LogInformation("Plugin source change detected: {File}", e.Name);

		// Determine which plugin project this file belongs to
		var filePath = e.FullPath;
		var pluginDir = Path.GetDirectoryName(filePath);
		while (pluginDir != null && !File.Exists(Path.Combine(pluginDir, "*.csproj")))
		{
			// Walk up until we find a directory with a .csproj file
			var csprojFiles = Directory.GetFiles(pluginDir, "*.csproj");
			if (csprojFiles.Length > 0)
			{
				_changedPluginPath = csprojFiles[0];
				break;
			}
			pluginDir = Path.GetDirectoryName(pluginDir);
		}

		// Debounce changes (1 second to allow for multiple file saves)
		_debounceTimer?.Dispose();
		_debounceTimer = new Timer(_ => BuildPluginAndReload(), null, 1000, Timeout.Infinite);
	}

	private async void BuildPluginAndReload()
	{
		if (_changedPluginPath == null)
		{
			_logger.LogWarning("Could not determine which plugin changed");
			return;
		}

		var pluginName = Path.GetFileNameWithoutExtension(_changedPluginPath);
		_logger.LogInformation("Building plugin: {Plugin}", pluginName);

		var startInfo = new ProcessStartInfo
		{
			FileName = "dotnet",
			Arguments = $"build \"{_changedPluginPath}\"",
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
				_logger.LogError("Failed to start build process for plugin: {Plugin}", pluginName);
				return;
			}

			var output = await process.StandardOutput.ReadToEndAsync();
			var error = await process.StandardError.ReadToEndAsync();

			await process.WaitForExitAsync();

			if (process.ExitCode != 0)
			{
				_logger.LogError("Plugin build failed: {Plugin}\n{Output}\n{Error}", pluginName, output, error);
				return;
			}

			_logger.LogInformation("Plugin built successfully: {Plugin}", pluginName);
			_logger.LogInformation("Triggering backend reload");
			await _orchestrator.ReloadBackendsAsync();
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error building plugin: {Plugin}", pluginName);
		}
	}

	public override void Dispose()
	{
		_watcher?.Dispose();
		_debounceTimer?.Dispose();
		base.Dispose();
	}
}
