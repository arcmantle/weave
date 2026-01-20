using ApiExample.Data;

namespace ApiExample.Services;

/// <summary>
/// Plugin information with current state
/// </summary>
public class PluginInfo
{
	public required string Name { get; set; }
	public bool IsEnabled { get; set; }
	public DateTime LastModified { get; set; }
}

/// <summary>
/// Service for managing plugin state and providing real-time updates
/// </summary>
public interface IPluginManager
{
	/// <summary>
	/// Initialize the plugin manager by syncing loaded plugins with database
	/// </summary>
	Task InitializeAsync();

	/// <summary>
	/// Get all plugins with their current state
	/// </summary>
	Task<IEnumerable<PluginInfo>> GetAllPluginsAsync();

	/// <summary>
	/// Toggle a plugin's enabled state
	/// </summary>
	/// <returns>True if plugin was found and toggled, false otherwise</returns>
	Task<bool> TogglePluginAsync(string name);

	/// <summary>
	/// Stream plugin state changes via Server-Sent Events
	/// </summary>
	Task StreamPluginEventsAsync(Stream outputStream, CancellationToken cancellationToken);
}
