using Microsoft.AspNetCore.Mvc.RazorPages;
using Pivot.Coordinator.Services;
using Pivot.Plugin;

namespace Pivot.Coordinator.Pages;


public class IndexModel : PageModel {
	private readonly PluginStateService _pluginStateService;

	public IEnumerable<PluginInfo> Plugins { get; set; } = Array.Empty<PluginInfo>();

	public IndexModel(PluginStateService pluginStateService) {
		_pluginStateService = pluginStateService;
	}

	public async Task OnGetAsync() {
		Plugins = await _pluginStateService.GetAllPluginsAsync();
	}
}
