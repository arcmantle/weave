namespace ApiExample.Data;

/// <summary>
/// Represents the persisted state of a plugin
/// </summary>
public class PluginState
{
	public int Id { get; set; }

	/// <summary>
	/// The unique name of the plugin
	/// </summary>
	public required string Name { get; set; }

	/// <summary>
	/// Whether the plugin is currently enabled
	/// </summary>
	public bool IsEnabled { get; set; } = true;

	/// <summary>
	/// When the plugin state was last modified
	/// </summary>
	public DateTime LastModified { get; set; } = DateTime.UtcNow;
}
