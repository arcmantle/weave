using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using Pivot.Plugin;

namespace Pivot.Coordinator.Services;


/// <summary>
/// Manages plugin states, deployment, and real-time updates
/// File-system based - no database needed
/// </summary>
public class PluginStateService : IPluginStateProvider, IDisposable {
	private readonly PluginManagementOptions _options;
	private readonly ILogger<PluginStateService> _logger;
	private readonly Channel<PluginInfo[]> _updateChannel;
	private readonly PluginDeploymentManager _deploymentManager;

	public PluginStateService(
		PluginManagementOptions options,
		ILogger<PluginStateService> logger,
		ILoggerFactory loggerFactory) {
		_options = options;
		_logger = logger;
		_updateChannel = Channel.CreateUnbounded<PluginInfo[]>();
		_deploymentManager = new PluginDeploymentManager(
			loggerFactory.CreateLogger<PluginDeploymentManager>());
	}

	/// <summary>
	/// Get all plugins from file system
	/// </summary>
	public Task<IEnumerable<PluginInfo>> GetAllPluginsAsync() {
		var plugins = new List<PluginInfo>();

		if (string.IsNullOrEmpty(_options.PluginRepositoryDirectory) ||
			!Directory.Exists(_options.PluginRepositoryDirectory)) {
			return Task.FromResult<IEnumerable<PluginInfo>>(plugins);
		}

		var pluginDirs = Directory.GetDirectories(_options.PluginRepositoryDirectory);

		foreach (var pluginDir in pluginDirs) {
			var pluginName = Path.GetFileName(pluginDir);
			var manifestPath = Path.Combine(pluginDir, "manifest.json");

			if (!File.Exists(manifestPath)) {
				continue;
			}

			try {
				var manifestJson = File.ReadAllText(manifestPath);
				var manifest = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(manifestJson);

				var version = manifest != null && manifest.TryGetValue("version", out var v)
					? v.GetString()
					: null;

				// Check if plugin is enabled (exists in active-plugins directory)
				var isEnabled = false;
				if (!string.IsNullOrEmpty(_options.ActivePluginsDirectory)) {
					var activePluginDir = Path.Combine(_options.ActivePluginsDirectory, pluginName);
					isEnabled = Directory.Exists(activePluginDir);
				}

				// Get last modified from manifest file
				var lastModified = File.GetLastWriteTimeUtc(manifestPath);

				plugins.Add(new PluginInfo {
					Name = pluginName,
					IsEnabled = isEnabled,
					LastModified = lastModified,
					InstalledVersion = version,
					RegistryUrl = null // Could be read from manifest if stored there
				});
			}
			catch (Exception ex) {
				_logger.LogWarning(ex, "Failed to read manifest for {PluginName}", pluginName);
			}
		}

		return Task.FromResult<IEnumerable<PluginInfo>>(plugins.OrderBy(p => p.Name));
	}

	public async Task<bool> TogglePluginAsync(string name) {
		var plugins = await GetAllPluginsAsync();
		var plugin = plugins.FirstOrDefault(p => p.Name == name);

		if (plugin == null) {
			_logger.LogWarning("Attempted to toggle non-existent plugin: {PluginName}", name);
			return false;
		}

		var newState = !plugin.IsEnabled;
		return await SetPluginStateAsync(name, newState);
	}

	public async Task<bool> SetPluginStateAsync(string name, bool enabled) {
		if (string.IsNullOrEmpty(_options.PluginRepositoryDirectory) ||
			string.IsNullOrEmpty(_options.ActivePluginsDirectory)) {
			_logger.LogWarning("Plugin directories not configured");
			return false;
		}

		var sourceDir = Path.Combine(_options.PluginRepositoryDirectory, name);
		if (!Directory.Exists(sourceDir)) {
			_logger.LogWarning("Plugin {PluginName} not found in repository", name);
			return false;
		}

		var activeDir = Path.Combine(_options.ActivePluginsDirectory, name);
		var currentlyEnabled = Directory.Exists(activeDir);

		if (currentlyEnabled == enabled) {
			return true; // Already in desired state
		}

		try {
			if (enabled) {
				// Copy plugin to active directory
				Directory.CreateDirectory(_options.ActivePluginsDirectory);
				CopyDirectory(sourceDir, activeDir);
				_logger.LogInformation("Enabled plugin: {PluginName}", name);
			}
			else {
				// Remove from active directory
				if (Directory.Exists(activeDir)) {
					Directory.Delete(activeDir, true);
				}
				_logger.LogInformation("Disabled plugin: {PluginName}", name);
			}

			await BroadcastStateAsync();
			return true;
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Failed to {Action} plugin {PluginName}",
				enabled ? "enable" : "disable", name);
			return false;
		}
	}

	private static void CopyDirectory(string sourceDir, string destinationDir) {
		Directory.CreateDirectory(destinationDir);

		foreach (var file in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories)) {
			var relativePath = Path.GetRelativePath(sourceDir, file);
			var destFile = Path.Combine(destinationDir, relativePath);
			var destFileDir = Path.GetDirectoryName(destFile);

			if (!string.IsNullOrEmpty(destFileDir)) {
				Directory.CreateDirectory(destFileDir);
			}

			File.Copy(file, destFile, true);
		}
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
		var threshold = DateTime.UtcNow.AddMinutes(-_options.RecentlyModifiedWindowMinutes);
		var recentPlugins = new List<string>();

		var activePluginsDir = _options.ActivePluginsDirectory;
		if (!Directory.Exists(activePluginsDir)) {
			return recentPlugins;
		}

		var pluginDirs = Directory.GetDirectories(activePluginsDir);
		foreach (var pluginDir in pluginDirs) {
			var manifestPath = Path.Combine(pluginDir, "manifest.json");
			if (File.Exists(manifestPath)) {
				var lastModified = File.GetLastWriteTimeUtc(manifestPath);
				if (lastModified > threshold) {
					recentPlugins.Add(Path.GetFileName(pluginDir));
				}
			}
		}

		return await Task.FromResult(recentPlugins);
	}

	/// <summary>
	/// Disable multiple plugins (used for auto-recovery)
	/// </summary>
	public async Task DisablePluginsAsync(IEnumerable<string> pluginNames) {
		if (string.IsNullOrEmpty(_options.ActivePluginsDirectory)) {
			return;
		}

		var disabledCount = 0;
		foreach (var pluginName in pluginNames) {
			var activePluginDir = Path.Combine(_options.ActivePluginsDirectory, pluginName);
			if (Directory.Exists(activePluginDir)) {
				Directory.Delete(activePluginDir, recursive: true);
				disabledCount++;
			}
		}

		_logger.LogWarning("Auto-disabled {Count} plugins: {Plugins}",
			disabledCount, string.Join(", ", pluginNames));

		await BroadcastStateAsync();
	}

	/// <summary>
	/// Stream plugin state updates via SSE
	/// </summary>
	public async Task StreamPluginEventsAsync(Stream outputStream, CancellationToken cancellationToken) {
		var writer = new StreamWriter(outputStream, Encoding.UTF8, leaveOpen: true);

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
		await writer.FlushAsync(); // Use async flush instead of AutoFlush
	}

	private async Task BroadcastStateAsync() {
		var plugins = await GetAllPluginsAsync();
		await _updateChannel.Writer.WriteAsync(plugins.ToArray());
	}

	// IPluginStateProvider implementation
	public async Task<bool> IsPluginEnabledAsync(string pluginName) {
		if (string.IsNullOrEmpty(_options.ActivePluginsDirectory)) {
			return false;
		}

		var activePluginDir = Path.Combine(_options.ActivePluginsDirectory, pluginName);
		return Directory.Exists(activePluginDir);
	}

	public async Task<IReadOnlyCollection<string>> GetEnabledPluginsAsync() {
		var allPlugins = await GetAllPluginsAsync();
		return allPlugins.Where(p => p.IsEnabled).Select(p => p.Name).ToList();
	}

	public void Dispose() {
		_updateChannel.Writer.Complete();
	}

	/// <summary>
	/// Install a plugin from a .pivotpkg package
	/// </summary>
	public async Task<bool> InstallPluginFromPackageAsync(
		string pluginName,
		string version,
		Stream packageStream,
		string? registryUrl = null) {

		if (string.IsNullOrEmpty(_options.PluginRepositoryDirectory)) {
			_logger.LogWarning("Plugin repository directory not configured");
			return false;
		}

		try {
			// Extract package to repository
			var pluginDir = Path.Combine(_options.PluginRepositoryDirectory, pluginName);

			// Remove old version if exists
			if (Directory.Exists(pluginDir)) {
				// Also remove from active if it was enabled
				if (!string.IsNullOrEmpty(_options.ActivePluginsDirectory)) {
					var activeDir = Path.Combine(_options.ActivePluginsDirectory, pluginName);
					if (Directory.Exists(activeDir)) {
						Directory.Delete(activeDir, true);
					}
				}

				Directory.Delete(pluginDir, true);
				_logger.LogInformation("Removed old version of plugin: {PluginName}", pluginName);
			}

			Directory.CreateDirectory(pluginDir);

			// Extract entire package (manifest, client files, server files)
			using var archive = new System.IO.Compression.ZipArchive(packageStream, System.IO.Compression.ZipArchiveMode.Read);

			foreach (var entry in archive.Entries) {
				// Skip directory entries
				if (string.IsNullOrEmpty(entry.Name)) {
					continue;
				}

				// Preserve directory structure
				var relativePath = entry.FullName;
				var destPath = Path.Combine(pluginDir, relativePath);

				// Create directory if needed
				var destDir = Path.GetDirectoryName(destPath);
				if (!string.IsNullOrEmpty(destDir)) {
					Directory.CreateDirectory(destDir);
				}

				// Extract file
				using var entryStream = entry.Open();
				using var fileStream = File.Create(destPath);
				await entryStream.CopyToAsync(fileStream);

				_logger.LogDebug("Extracted {FileName} to {Path}", relativePath, destPath);
			}

			_logger.LogInformation("Installed plugin {PluginName} v{Version} to repository (disabled by default)",
				pluginName, version);

			await BroadcastStateAsync();

			return true;
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Error installing plugin {PluginName} v{Version}", pluginName, version);
			return false;
		}
	}
}
