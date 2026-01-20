using ApiExample.Services;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace ApiExample.Pages;

public class IndexModel : PageModel
{
	private readonly IPluginManager _pluginManager;

	public IEnumerable<PluginInfo> Plugins { get; set; } = Array.Empty<PluginInfo>();

	public IndexModel(IPluginManager pluginManager)
	{
		_pluginManager = pluginManager;
	}

	public async Task OnGetAsync()
	{
		Plugins = await _pluginManager.GetAllPluginsAsync();
	}
}
