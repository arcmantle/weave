using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Pivot.Backend.Services;


public class PluginFileWatcher : BackgroundService
{
	private readonly ILogger<PluginFileWatcher> _logger;
	private readonly PivotBackendOptions _options;
	private readonly string? _coordinatorUrl;
	private FileSystemWatcher? _watcher;
	private Timer? _debounceTimer;

	public PluginFileWatcher(
		ILogger<PluginFileWatcher> logger,
		PivotBackendOptions options
	)
	{
		_logger = logger;
		_options = options;
		_coordinatorUrl = Environment.GetEnvironmentVariable("PIVOT_COORDINATOR_URL");
	}

	protected override Task ExecuteAsync(CancellationToken stoppingToken)
	{
		if (!_options.EnableAutoReload)
		{
			_logger.LogInformation("Plugin auto-reload is disabled");
			return Task.CompletedTask;
		}

		if (string.IsNullOrEmpty(_options.PluginDirectory))
		{
			_logger.LogWarning("PluginDirectory not configured, auto-reload disabled");
			return Task.CompletedTask;
		}

		if (string.IsNullOrEmpty(_coordinatorUrl))
		{
			_logger.LogWarning("PIVOT_COORDINATOR_URL not set, auto-reload disabled");
			return Task.CompletedTask;
		}

		if (!Directory.Exists(_options.PluginDirectory))
		{
			_logger.LogWarning("Plugin directory does not exist: {Dir}", _options.PluginDirectory);
			return Task.CompletedTask;
		}

		_logger.LogInformation("Watching plugin directory: {Dir}", _options.PluginDirectory);

		_watcher = new FileSystemWatcher(_options.PluginDirectory, "*.dll")
		{
			NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName,
			EnableRaisingEvents = true
		};

		_watcher.Changed += OnPluginChanged;
		_watcher.Created += OnPluginChanged;
		_watcher.Deleted += OnPluginChanged;
		_watcher.Renamed += OnPluginChanged;

		return Task.CompletedTask;
	}

	private void OnPluginChanged(object sender, FileSystemEventArgs e)
	{
		_logger.LogInformation("Plugin change detected: {File}", e.Name);

		// Debounce changes using configured delay
		_debounceTimer?.Dispose();
		_debounceTimer = new Timer(_ => TriggerReload(), null, _options.WatchDebounceMs, Timeout.Infinite);
	}

	private async void TriggerReload()
	{
		try
		{
			_logger.LogInformation("Triggering reload via coordinator: {Url}", _coordinatorUrl);

			using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
			var response = await client.PostAsync($"{_coordinatorUrl}/reload", null);

			if (response.IsSuccessStatusCode)
			{
				_logger.LogInformation("Reload triggered successfully");
			}
			else
			{
				_logger.LogWarning("Failed to trigger reload: {Status}", response.StatusCode);
			}
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error triggering reload");
		}
	}

	public override void Dispose()
	{
		_watcher?.Dispose();
		_debounceTimer?.Dispose();
		base.Dispose();
	}
}
