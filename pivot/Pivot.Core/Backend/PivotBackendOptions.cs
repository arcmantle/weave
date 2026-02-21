namespace Pivot.Backend;


public class PivotBackendOptions {
	/// <summary>
	/// Directory where plugins are loaded from (for runtime plugin loading)
	/// </summary>
	public string? PluginDirectory { get; set; }

	/// <summary>
	/// Repository directory containing all available plugins (source of truth)
	/// </summary>
	public string? PluginRepositoryDirectory { get; set; }

	public bool EnableAutoReload { get; set; } = false;
	public bool LoadFromReferencedAssemblies { get; set; } = true;
	public int WatchDebounceMs { get; set; } = 500;
}
