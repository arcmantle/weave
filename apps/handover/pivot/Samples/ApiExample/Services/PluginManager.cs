using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using ApiExample.Data;
using Microsoft.EntityFrameworkCore;
using Pivot.Plugin;

namespace ApiExample.Services;

/// <summary>
/// Manages plugin state persistence and real-time updates
/// </summary>
public class PluginManager : IPluginManager
{
	private readonly IServiceProvider _serviceProvider;
	private readonly IReadOnlyCollection<IPlugin> _plugins;
	private readonly ILogger<PluginManager> _logger;
	private readonly Channel<PluginInfo[]> _updateChannel;

	public PluginManager(
		IServiceProvider serviceProvider,
		IReadOnlyCollection<IPlugin> plugins,
		ILogger<PluginManager> logger)
	{
		_serviceProvider = serviceProvider;
		_plugins = plugins;
		_logger = logger;
		_updateChannel = Channel.CreateUnbounded<PluginInfo[]>();
	}

	public async Task InitializeAsync()
	{
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		// Sync loaded plugins with database
		foreach (var plugin in _plugins)
		{
			var existing = await db.Plugins.FirstOrDefaultAsync(p => p.Name == plugin.Name);
			if (existing == null)
			{
				db.Plugins.Add(new PluginState
				{
					Name = plugin.Name,
					IsEnabled = true,
					LastModified = DateTime.UtcNow
				});
				_logger.LogInformation("Registered new plugin in database: {PluginName}", plugin.Name);
			}
		}

		await db.SaveChangesAsync();

		// Broadcast initial state
		await BroadcastStateAsync();
	}

	public async Task<IEnumerable<PluginInfo>> GetAllPluginsAsync()
	{
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var states = await db.Plugins.ToListAsync();

		return states.Select(s => new PluginInfo
		{
			Name = s.Name,
			IsEnabled = s.IsEnabled,
			LastModified = s.LastModified
		}).ToList();
	}

	public async Task<bool> TogglePluginAsync(string name)
	{
		using var scope = _serviceProvider.CreateScope();
		var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

		var plugin = await db.Plugins.FirstOrDefaultAsync(p => p.Name == name);
		if (plugin == null)
		{
			_logger.LogWarning("Attempted to toggle non-existent plugin: {PluginName}", name);
			return false;
		}

		plugin.IsEnabled = !plugin.IsEnabled;
		plugin.LastModified = DateTime.UtcNow;
		await db.SaveChangesAsync();

		_logger.LogInformation("Toggled plugin {PluginName} to {State}", name, plugin.IsEnabled ? "enabled" : "disabled");

		// Broadcast updated state to all SSE listeners
		await BroadcastStateAsync();

		return true;
	}

	public async Task StreamPluginEventsAsync(Stream outputStream, CancellationToken cancellationToken)
	{
		var writer = new StreamWriter(outputStream, Encoding.UTF8, leaveOpen: true)
		{
			AutoFlush = true
		};

		try
		{
			// Send initial state
			var initialPlugins = await GetAllPluginsAsync();
			await SendEventAsync(writer, initialPlugins);

			// Listen for updates
			await foreach (var plugins in _updateChannel.Reader.ReadAllAsync(cancellationToken))
			{
				await SendEventAsync(writer, plugins);
			}
		}
		catch (OperationCanceledException)
		{
			_logger.LogDebug("SSE client disconnected");
		}
		catch (Exception ex)
		{
			_logger.LogError(ex, "Error in SSE stream");
		}
	}

	private async Task SendEventAsync(StreamWriter writer, IEnumerable<PluginInfo> plugins)
	{
		var json = JsonSerializer.Serialize(plugins, new JsonSerializerOptions
		{
			PropertyNamingPolicy = JsonNamingPolicy.CamelCase
		});

		await writer.WriteLineAsync($"data: {json}");
		await writer.WriteLineAsync();
	}

	private async Task BroadcastStateAsync()
	{
		var plugins = (await GetAllPluginsAsync()).ToArray();
		await _updateChannel.Writer.WriteAsync(plugins);
	}
}
