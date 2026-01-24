using ApiExample.Data;
using Microsoft.EntityFrameworkCore;
using Pivot.Plugin;

namespace ApiExample.Services;

/// <summary>
/// Plugin state provider that uses the database to track which plugins are enabled
/// </summary>
public class DatabasePluginStateProvider : IPluginStateProvider {
	private readonly IServiceProvider _serviceProvider;

	public DatabasePluginStateProvider(IServiceProvider serviceProvider) {
		_serviceProvider = serviceProvider;
	}

	public async Task<bool> IsPluginEnabledAsync(string pluginName) {
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var plugin = await db.Plugins.FirstOrDefaultAsync(p => p.Name == pluginName);
		return plugin?.IsEnabled ?? false;
	}

	public async Task<IReadOnlyCollection<string>> GetEnabledPluginsAsync() {
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var enabledPlugins = await db.Plugins
			.Where(p => p.IsEnabled)
			.Select(p => p.Name)
			.ToListAsync();

		return enabledPlugins;
	}
}
