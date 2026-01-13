namespace Pivot.Backend;


public class PivotBackendOptions
{
	public string? PluginDirectory { get; set; }
	public bool EnableAutoReload { get; set; } = false;
	public bool LoadFromReferencedAssemblies { get; set; } = true;
	public int WatchDebounceMs { get; set; } = 500;
}
