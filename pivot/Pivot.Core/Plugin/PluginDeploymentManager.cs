using Microsoft.Extensions.Logging;

namespace Pivot.Plugin;


/// <summary>
/// Manages plugin deployment from a repository directory to the active plugins directory.
/// Only enabled plugins are copied to the active directory for loading.
/// </summary>
public class PluginDeploymentManager {
	private readonly ILogger<PluginDeploymentManager>? _logger;

	public PluginDeploymentManager(ILogger<PluginDeploymentManager>? logger = null) {
		_logger = logger;
	}

	/// <summary>
	/// Deploys enabled plugins from the repository directory to the target directory
	/// </summary>
	/// <param name="repositoryDir">Source directory containing all available plugins</param>
	/// <param name="targetDir">Destination directory where enabled plugins should be deployed</param>
	/// <param name="stateProvider">Provider to determine which plugins are enabled</param>
	public async Task DeployEnabledPluginsAsync(
		string repositoryDir,
		string targetDir,
		IPluginStateProvider stateProvider) {
		if (!Directory.Exists(repositoryDir)) {
			_logger?.LogWarning("Plugin repository directory not found: {Dir}", repositoryDir);
			return;
		}

		// Ensure target directory exists
		Directory.CreateDirectory(targetDir);

		// Get enabled plugins
		var enabledPlugins = await stateProvider.GetEnabledPluginsAsync();
		var enabledPluginSet = new HashSet<string>(enabledPlugins, StringComparer.OrdinalIgnoreCase);

		_logger?.LogInformation("Deploying {Count} enabled plugins from repository to {Target}",
			enabledPluginSet.Count, targetDir);

		// Clear target directory (remove previously deployed plugins)
		ClearDirectory(targetDir);

		// Copy only enabled plugins
		var pluginFiles = Directory.GetFiles(repositoryDir, "*.dll");
		foreach (var pluginFile in pluginFiles) {
			var pluginName = Path.GetFileNameWithoutExtension(pluginFile);

			// Check if this plugin is enabled
			if (!enabledPluginSet.Contains(pluginName)) {
				_logger?.LogDebug("Skipping disabled plugin: {Plugin}", pluginName);
				continue;
			}

			// Copy all related files (dll, pdb, deps.json, etc.)
			var relatedFiles = Directory.GetFiles(repositoryDir, $"{pluginName}.*");
			foreach (var file in relatedFiles) {
				var fileName = Path.GetFileName(file);
				var targetPath = Path.Combine(targetDir, fileName);

				File.Copy(file, targetPath, overwrite: true);
				_logger?.LogDebug("Deployed: {File}", fileName);
			}

			_logger?.LogInformation("Deployed plugin: {Plugin}", pluginName);
		}

		_logger?.LogInformation("Plugin deployment completed");
	}

	/// <summary>
	/// Clears all files from a directory without deleting the directory itself
	/// </summary>
	private void ClearDirectory(string directory) {
		if (!Directory.Exists(directory))
			return;

		foreach (var file in Directory.GetFiles(directory)) {
			try {
				File.Delete(file);
			}
			catch (Exception ex) {
				_logger?.LogWarning(ex, "Failed to delete file: {File}", file);
			}
		}
	}
}
