using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pivot.Coordinator.Data;
using Pivot.Coordinator.Services;
using Pivot.Plugin;

namespace Pivot.Coordinator.Extensions;


public static class PluginManagementExtensions {
	/// <summary>
	/// Adds plugin management services to the Coordinator
	/// </summary>
	public static WebApplicationBuilder AddPluginManagement(
		this WebApplicationBuilder builder,
		Action<PluginManagementOptions>? configure = null) {
		var options = new PluginManagementOptions();
		builder.Configuration.GetSection("Pivot:PluginManagement").Bind(options);
		configure?.Invoke(options);

		if (!options.Enabled) {
			return builder;
		}

		// Register options
		builder.Services.AddSingleton(options);

		// Add database context
		builder.Services.AddDbContext<PluginDbContext>(opts =>
			opts.UseSqlite(options.ConnectionString));

		// Add plugin state service
		builder.Services.AddSingleton<PluginStateService>();
		builder.Services.AddSingleton<IPluginStateProvider>(sp =>
			sp.GetRequiredService<PluginStateService>());

		// Add Razor Pages for admin UI
		builder.Services.AddRazorPages();

		return builder;
	}

	/// <summary>
	/// Maps plugin management endpoints and UI
	/// </summary>
	public static WebApplication MapPluginManagement(this WebApplication app) {
		var options = app.Services.GetService<PluginManagementOptions>();
		if (options == null || !options.Enabled) {
			return app;
		}

		// Ensure database is created
		using (var scope = app.Services.CreateScope()) {
			var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();
			db.Database.Migrate();
		}

		// Map static files (for admin UI)
		app.UseStaticFiles();

		// Map Razor Pages
		app.MapRazorPages();

		// Map Plugin Management API
		var pluginApi = app.MapGroup("/api/plugins")
			.WithTags("Plugin Management");

		pluginApi.MapGet("/", async (PluginStateService service) => {
			var plugins = await service.GetAllPluginsAsync();
			return Results.Ok(plugins);
		})
		.WithName("GetAllPlugins")
		.WithSummary("Get all plugins and their current state");

		pluginApi.MapPost("/{name}/toggle", async (string name, PluginStateService service) => {
			var success = await service.TogglePluginAsync(name);
			if (!success)
				return Results.NotFound(new { message = $"Plugin '{name}' not found" });

			return Results.Ok(new { message = $"Plugin '{name}' toggled successfully" });
		})
		.WithName("TogglePlugin")
		.WithSummary("Enable or disable a plugin");

		pluginApi.MapPost("/{name}/enable", async (string name, PluginStateService service) => {
			var success = await service.SetPluginStateAsync(name, true);
			if (!success)
				return Results.NotFound(new { message = $"Plugin '{name}' not found" });

			return Results.Ok(new { message = $"Plugin '{name}' enabled" });
		})
		.WithName("EnablePlugin")
		.WithSummary("Enable a specific plugin");

		pluginApi.MapPost("/{name}/disable", async (string name, PluginStateService service) => {
			var success = await service.SetPluginStateAsync(name, false);
			if (!success)
				return Results.NotFound(new { message = $"Plugin '{name}' not found" });

			return Results.Ok(new { message = $"Plugin '{name}' disabled" });
		})
		.WithName("DisablePlugin")
		.WithSummary("Disable a specific plugin");

		pluginApi.MapPost("/deploy", async (PluginStateService service, ILogger<PluginStateService> logger) => {
			try {
				await service.DeployEnabledPluginsAsync();
				return Results.Ok(new {
					message = "Plugin deployment completed successfully",
					note = "Trigger backend reload for changes to take effect"
				});
			}
			catch (Exception ex) {
				logger.LogError(ex, "Failed to deploy plugins");
				return Results.Problem("Failed to deploy plugins: " + ex.Message);
			}
		})
		.WithName("DeployPlugins")
		.WithSummary("Deploy enabled plugins from repository to active directory");

		pluginApi.MapGet("/events", async (HttpContext context, PluginStateService service) => {
			context.Response.Headers.Append("Content-Type", "text/event-stream");
			context.Response.Headers.Append("Cache-Control", "no-cache");
			context.Response.Headers.Append("Connection", "keep-alive");

			await service.StreamPluginEventsAsync(context.Response.Body, context.RequestAborted);
		})
		.WithName("PluginEvents")
		.WithSummary("Server-Sent Events stream for real-time plugin state updates")
		.ExcludeFromDescription();

		return app;
	}

	/// <summary>
	/// Initialize plugin states from discovered plugins in repository
	/// </summary>
	public static async Task InitializePluginStatesAsync(this WebApplication app) {
		var options = app.Services.GetService<PluginManagementOptions>();
		if (options == null || !options.Enabled) {
			return;
		}

		var service = app.Services.GetRequiredService<PluginStateService>();

		if (string.IsNullOrEmpty(options.PluginRepositoryDirectory) ||
			!Directory.Exists(options.PluginRepositoryDirectory)) {
			app.Logger.LogWarning("Plugin repository directory not configured or not found");
			return;
		}

		// Discover plugins from repository
		var pluginFiles = Directory.GetFiles(options.PluginRepositoryDirectory, "*.dll");
		var pluginNames = pluginFiles
			.Select(Path.GetFileNameWithoutExtension)
			.Where(name => !string.IsNullOrEmpty(name))
			.Cast<string>()
			.ToList();

		app.Logger.LogInformation("Discovered {Count} plugins in repository", pluginNames.Count);

		await service.InitializeAsync(pluginNames);
	}
}
