namespace Pivot.Plugin;


/// <summary>
/// Default implementation that assumes all plugins are enabled.
/// Used when no custom plugin state provider is registered.
/// </summary>
public class DefaultPluginStateProvider : IPluginStateProvider {
	public Task<bool> IsPluginEnabledAsync(string pluginName) {
		return Task.FromResult(true);
	}

	public Task<IReadOnlyCollection<string>> GetEnabledPluginsAsync() {
		return Task.FromResult<IReadOnlyCollection<string>>(Array.Empty<string>());
	}
}
