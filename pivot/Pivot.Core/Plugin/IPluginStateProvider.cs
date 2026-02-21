namespace Pivot.Plugin;


/// <summary>
/// Interface for providing plugin enabled/disabled state.
/// Implement this interface to integrate with your own database or state management system.
/// </summary>
public interface IPluginStateProvider {
	/// <summary>
	/// Checks if a plugin is currently enabled
	/// </summary>
	/// <param name="pluginName">Name of the plugin</param>
	/// <returns>True if the plugin is enabled, false otherwise</returns>
	Task<bool> IsPluginEnabledAsync(string pluginName);

	/// <summary>
	/// Gets all enabled plugin names
	/// </summary>
	/// <returns>Collection of enabled plugin names</returns>
	Task<IReadOnlyCollection<string>> GetEnabledPluginsAsync();
}
