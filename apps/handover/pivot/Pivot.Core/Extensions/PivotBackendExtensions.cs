using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Pivot.Backend;
using Pivot.Backend.Services;
using Pivot.Plugin;

namespace Pivot.Extensions;


public static class PivotBackendExtensions
{
	public static WebApplicationBuilder AddPivotBackend(
		this WebApplicationBuilder builder,
		Action<PivotBackendOptions>? configure = null
	)
	{
		var options = new PivotBackendOptions();
		builder.Configuration.GetSection("Pivot:Backend").Bind(options);
		configure?.Invoke(options);

		builder.Services.AddSingleton(options);

		// Create a logger factory for plugin loading
		using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
		var logger = loggerFactory.CreateLogger("Pivot.PluginLoader");

		// Load plugins based on configuration
		IReadOnlyCollection<IPlugin>? plugins = null;

		if (options.LoadFromReferencedAssemblies)
		{
			logger.LogInformation("Loading plugins from referenced assemblies");
			plugins = PluginLoader.LoadFromReferencedAssemblies(builder, logger);
		}
		else if (!string.IsNullOrEmpty(options.PluginDirectory))
		{
			logger.LogInformation("Loading plugins from directory: {Dir}", options.PluginDirectory);
			plugins = PluginLoader.LoadFromDirectory(options.PluginDirectory, builder, logger);
		}

		// Initialize plugins
		if (plugins != null && plugins.Count > 0)
		{
			foreach (var plugin in plugins)
			{
				try
				{
					logger.LogInformation("Initializing plugin: {Name}", plugin.Name);
					plugin.Initialize(builder);
				}
				catch (Exception ex)
				{
					logger.LogError(ex, "Error initializing plugin {Name}", plugin.Name);
				}
			}
		}

		// Add file watcher if enabled
		if (options.EnableAutoReload)
		{
			builder.Services.AddHostedService<PluginFileWatcher>();
		}

		// Add health checks
		builder.Services.AddHealthChecks();

		return builder;
	}

	public static WebApplication MapPivotBackend(this WebApplication app)
	{
		var plugins = app.Services.GetService<IReadOnlyCollection<IPlugin>>();
		var logger = app.Services.GetRequiredService<ILogger<WebApplication>>();

		// Configure plugins
		if (plugins != null && plugins.Count > 0)
		{
			foreach (var plugin in plugins)
			{
				try
				{
					logger.LogInformation("Configuring plugin: {Name}", plugin.Name);
					plugin.Configure(app);
				}
				catch (Exception ex)
				{
					logger.LogError(ex, "Error configuring plugin {Name}", plugin.Name);
				}
			}
		}

		// Map health check
		app.MapHealthChecks("/health");

		return app;
	}
}
