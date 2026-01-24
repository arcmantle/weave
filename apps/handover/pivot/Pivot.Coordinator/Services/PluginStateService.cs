using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Pivot.Coordinator.Data;
using Pivot.Plugin;

namespace Pivot.Coordinator.Services;


/// <summary>
/// Manages plugin states, deployment, and real-time updates
/// </summary>
public class PluginStateService : IPluginStateProvider, IDisposable {
	private readonly IServiceProvider _serviceProvider;
	private readonly PluginManagementOptions _options;
	private readonly ILogger<PluginStateService> _logger;
	private readonly Channel<PluginInfo[]> _updateChannel;
	private readonly PluginDeploymentManager _deploymentManager;

	public PluginStateService(
		IServiceProvider serviceProvider,
		PluginManagementOptions options,
		ILogger<PluginStateService> logger,
		ILoggerFactory loggerFactory) {
		_serviceProvider = serviceProvider;
		_options = options;
		_logger = logger;
		_updateChannel = Channel.CreateUnbounded<PluginInfo[]>();
		_deploymentManager = new PluginDeploymentManager(
			loggerFactory.CreateLogger<PluginDeploymentManager>());
	}

	/// <summary>
	/// Initialize plugin states from discovered plugins
	/// </summary>
	public async Task InitializeAsync(IEnumerable<string> discoveredPlugins) {
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		foreach (var pluginName in discoveredPlugins) {
			var existing = await db.Plugins.FirstOrDefaultAsync(p => p.Name == pluginName);
			if (existing == null) {
				db.Plugins.Add(new PluginState {
					Name = pluginName,
					IsEnabled = true,
					LastModified = DateTime.UtcNow
				});
				_logger.LogInformation("Registered new plugin: {PluginName}", pluginName);
			}
		}

		await db.SaveChangesAsync();
		await BroadcastStateAsync();
	}

	public async Task<IEnumerable<PluginInfo>> GetAllPluginsAsync() {
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var states = await db.Plugins.OrderBy(p => p.Name).ToListAsync();

		return states.Select(s => new PluginInfo {
			Name = s.Name,
			IsEnabled = s.IsEnabled,
			LastModified = s.LastModified
		}).ToList();
	}

	public async Task<bool> TogglePluginAsync(string name) {
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var plugin = await db.Plugins.FirstOrDefaultAsync(p => p.Name == name);
		if (plugin == null) {
			_logger.LogWarning("Attempted to toggle non-existent plugin: {PluginName}", name);
			return false;
		}

		plugin.IsEnabled = !plugin.IsEnabled;
		plugin.LastModified = DateTime.UtcNow;
		await db.SaveChangesAsync();

		_logger.LogInformation("Toggled plugin {PluginName} to {State}", name, plugin.IsEnabled ? "enabled" : "disabled");

		await BroadcastStateAsync();

		return true;
	}

	public async Task<bool> SetPluginStateAsync(string name, bool enabled) {
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var plugin = await db.Plugins.FirstOrDefaultAsync(p => p.Name == name);
		if (plugin == null) {
			_logger.LogWarning("Attempted to set state for non-existent plugin: {PluginName}", name);
			return false;
		}

		if (plugin.IsEnabled == enabled)
			return true; // Already in desired state

		plugin.IsEnabled = enabled;
		plugin.LastModified = DateTime.UtcNow;
		await db.SaveChangesAsync();

		_logger.LogInformation("Set plugin {PluginName} to {State}", name, enabled ? "enabled" : "disabled");

		await BroadcastStateAsync();

		return true;
	}

	/// <summary>
	/// Deploy enabled plugins from repository to active directory
	/// </summary>
	public async Task DeployEnabledPluginsAsync() {
		if (string.IsNullOrEmpty(_options.PluginRepositoryDirectory) ||
			string.IsNullOrEmpty(_options.ActivePluginsDirectory)) {
			_logger.LogWarning("Plugin repository or active directory not configured");
			return;
		}

		_logger.LogInformation("Deploying enabled plugins from {Repository} to {Active}",
			_options.PluginRepositoryDirectory, _options.ActivePluginsDirectory);

		await _deploymentManager.DeployEnabledPluginsAsync(
			_options.PluginRepositoryDirectory,
			_options.ActivePluginsDirectory,
			this
		);

		_logger.LogInformation("Plugin deployment completed");
	}

	/// <summary>
	/// Get plugins that were recently modified (for auto-disable on failure)
	/// </summary>
	public async Task<IEnumerable<string>> GetRecentlyModifiedPluginsAsync() {
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var threshold = DateTime.UtcNow.AddMinutes(-_options.RecentlyModifiedWindowMinutes);

		var recentPlugins = await db.Plugins
			.Where(p => p.LastModified > threshold && p.IsEnabled)
			.Select(p => p.Name)
			.ToListAsync();

		return recentPlugins;
	}

	/// <summary>
	/// Disable multiple plugins (used for auto-recovery)
	/// </summary>
	public async Task DisablePluginsAsync(IEnumerable<string> pluginNames) {
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var plugins = await db.Plugins
			.Where(p => pluginNames.Contains(p.Name))
			.ToListAsync();

		foreach (var plugin in plugins) {
			plugin.IsEnabled = false;
			plugin.LastModified = DateTime.UtcNow;
		}

		await db.SaveChangesAsync();

		_logger.LogWarning("Auto-disabled {Count} plugins: {Plugins}",
			plugins.Count, string.Join(", ", plugins.Select(p => p.Name)));

		await BroadcastStateAsync();
	}

	/// <summary>
	/// Stream plugin state updates via SSE
	/// </summary>
	public async Task StreamPluginEventsAsync(Stream outputStream, CancellationToken cancellationToken) {
		var writer = new StreamWriter(outputStream, Encoding.UTF8, leaveOpen: true) {
			AutoFlush = true
		};

		try {
			// Send initial state
			var plugins = await GetAllPluginsAsync();
			await SendEventAsync(writer, plugins);

			// Stream updates
			await foreach (var update in _updateChannel.Reader.ReadAllAsync(cancellationToken)) {
				await SendEventAsync(writer, update);
			}
		}
		catch (OperationCanceledException) {
			// Client disconnected
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Error streaming plugin events");
		}
	}

	private async Task SendEventAsync(StreamWriter writer, IEnumerable<PluginInfo> plugins) {
		var json = JsonSerializer.Serialize(plugins);
		await writer.WriteLineAsync($"data: {json}");
		await writer.WriteLineAsync();
	}

	private async Task BroadcastStateAsync() {
		var plugins = await GetAllPluginsAsync();
		await _updateChannel.Writer.WriteAsync(plugins.ToArray());
	}

	// IPluginStateProvider implementation
	public async Task<bool> IsPluginEnabledAsync(string pluginName) {
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var plugin = await db.Plugins.FirstOrDefaultAsync(p => p.Name == pluginName);
		return plugin?.IsEnabled ?? false;
	}

	public async Task<IReadOnlyCollection<string>> GetEnabledPluginsAsync() {
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var enabledPlugins = await db.Plugins
			.Where(p => p.IsEnabled)
			.Select(p => p.Name)
			.ToListAsync();

		return enabledPlugins;
	}

	public void Dispose() {
		_updateChannel.Writer.Complete();
	}
}
