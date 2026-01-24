namespace Pivot.Plugin;


/// <summary>
/// Represents the state of a plugin in the system
/// </summary>
public class PluginState {
	public int Id { get; set; }
	public required string Name { get; set; }
	public bool IsEnabled { get; set; }
	public DateTime LastModified { get; set; }
}


/// <summary>
/// DTO for plugin information
/// </summary>
public class PluginInfo {
	public required string Name { get; set; }
	public bool IsEnabled { get; set; }
	public DateTime LastModified { get; set; }
}
