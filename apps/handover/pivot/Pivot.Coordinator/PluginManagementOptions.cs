namespace Pivot.Coordinator;


/// <summary>
/// Options for plugin management in the Coordinator
/// </summary>
public class PluginManagementOptions {
	/// <summary>
	/// Enable the plugin management UI and database
	/// </summary>
	public bool Enabled { get; set; } = false;

	/// <summary>
	/// Database connection string for plugin state
	/// </summary>
	public string ConnectionString { get; set; } = "Data Source=pivot-plugins.db";

	/// <summary>
	/// Directory containing all available plugins (repository)
	/// </summary>
	public string? PluginRepositoryDirectory { get; set; }

	/// <summary>
	/// Directory where enabled plugins are deployed before backend startup
	/// </summary>
	public string? ActivePluginsDirectory { get; set; }

	/// <summary>
	/// Automatically disable recently modified plugins if backend fails to start
	/// </summary>
	public bool AutoDisableOnFailure { get; set; } = true;

	/// <summary>
	/// Time window (in minutes) to consider plugins as "recently modified" for auto-disable
	/// </summary>
	public int RecentlyModifiedWindowMinutes { get; set; } = 5;
}
