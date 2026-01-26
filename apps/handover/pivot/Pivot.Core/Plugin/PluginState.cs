namespace Pivot.Plugin;


/// <summary>
/// Represents the state of a plugin in the system
/// </summary>
public class PluginState {
	public int Id { get; set; }
	public required string Name { get; set; }
	public bool IsEnabled { get; set; }
	public DateTime LastModified { get; set; }

	/// <summary>
	/// Installed version of the plugin (null if not versioned)
	/// </summary>
	public string? InstalledVersion { get; set; }

	/// <summary>
	/// Source registry URL if installed from remote registry
	/// </summary>
	public string? RegistryUrl { get; set; }
}


/// <summary>
/// DTO for plugin information
/// </summary>
public class PluginInfo {
	public required string Name { get; set; }
	public bool IsEnabled { get; set; }
	public DateTime LastModified { get; set; }
	public string? InstalledVersion { get; set; }
	public string? RegistryUrl { get; set; }
}
