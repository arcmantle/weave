using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Pivot.Auth.Extensions;
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

		// Add Pivot authentication services
		builder.AddPivotAuth(authOptions => {
			authOptions.ConnectionString = options.ConnectionString;
		});

		// Add plugin state service
		builder.Services.AddSingleton<PluginStateService>();
		builder.Services.AddSingleton<IPluginStateProvider>(sp =>
			sp.GetRequiredService<PluginStateService>());

		// Add Blazor Server for admin UI
		builder.Services.AddRazorComponents()
			.AddInteractiveServerComponents();

		return builder;
	}

	/// <summary>
	/// Maps plugin management endpoints and UI
	/// </summary>
	public static async Task<WebApplication> MapPluginManagement(this WebApplication app) {
		var options = app.Services.GetService<PluginManagementOptions>();
		if (options == null || !options.Enabled) {
			return app;
		}

		// Ensure plugin directories exist
		if (!string.IsNullOrEmpty(options.PluginRepositoryDirectory)) {
			Directory.CreateDirectory(options.PluginRepositoryDirectory);
		}
		if (!string.IsNullOrEmpty(options.ActivePluginsDirectory)) {
			Directory.CreateDirectory(options.ActivePluginsDirectory);
		}

		// Map Pivot authentication middleware and ensure auth DB is created
		await app.MapPivotAuth();

		// Map auth controllers (login, logout, refresh, me)
		app.MapControllers();

		// Serve static files from embedded resources (wwwroot)
		var assembly = typeof(PluginManagementExtensions).Assembly;
		var embeddedProvider = new ManifestEmbeddedFileProvider(assembly, "wwwroot");

		app.UseStaticFiles(new StaticFileOptions {
			FileProvider = embeddedProvider,
			RequestPath = "" // Serve from root path
		});

		// Enable antiforgery for Blazor
		app.UseAntiforgery();

		// Map Blazor components
		app.MapRazorComponents<Components.App>()
			.AddInteractiveServerRenderMode();

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

		pluginApi.MapPost("/install", async (
			HttpContext context,
			PluginStateService service,
			ILogger<PluginStateService> logger) => {
				try {
					var registryUrl = context.Request.Query["registryUrl"].FirstOrDefault();
					var pluginName = context.Request.Query["name"].FirstOrDefault();
					var version = context.Request.Query["version"].FirstOrDefault();

					if (string.IsNullOrEmpty(registryUrl) || string.IsNullOrEmpty(pluginName) || string.IsNullOrEmpty(version)) {
						return Results.BadRequest(new { message = "registryUrl, name, and version are required" });
					}

					// Download package from registry
					var downloadUrl = $"{registryUrl}/api/plugins/{pluginName}/versions/{version}/download";
					using var httpClient = new HttpClient();
					var response = await httpClient.GetAsync(downloadUrl);

					if (!response.IsSuccessStatusCode) {
						return Results.Problem($"Failed to download plugin from registry: {response.ReasonPhrase}");
					}

					await using var packageStream = await response.Content.ReadAsStreamAsync();

					var success = await service.InstallPluginFromPackageAsync(pluginName, version, packageStream, registryUrl);

					if (!success) {
						return Results.Problem("Failed to install plugin");
					}

					return Results.Ok(new {
						message = $"Plugin '{pluginName}' v{version} installed successfully",
						note = "Enable the plugin and deploy to activate it"
					});
				}
				catch (Exception ex) {
					logger.LogError(ex, "Failed to install plugin from registry");
					return Results.Problem("Failed to install plugin: " + ex.Message);
				}
			})
		.WithName("InstallPluginFromRegistry")
		.WithSummary("Install a plugin from a remote registry");

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
		// Plugins are now organized in subdirectories with their full package content
		var pluginDirs = Directory.GetDirectories(options.PluginRepositoryDirectory);
		var discoveredPlugins = new List<(string Name, string? Version)>();

		foreach (var pluginDir in pluginDirs) {
			var pluginName = Path.GetFileName(pluginDir);

			// Look for server DLLs in the server/ subdirectory
			var serverDir = Path.Combine(pluginDir, "server");
			if (Directory.Exists(serverDir)) {
				var dll = Path.Combine(serverDir, $"{pluginName}.dll");
				if (File.Exists(dll)) {
					// Try to read version from manifest.json
					string? version = null;
					var manifestPath = Path.Combine(pluginDir, "manifest.json");
					if (File.Exists(manifestPath)) {
						try {
							var manifestJson = await File.ReadAllTextAsync(manifestPath);
							var manifest = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(manifestJson);
							if (manifest != null && manifest.TryGetValue("version", out var versionObj)) {
								version = versionObj?.ToString();
							}
						}
						catch (Exception ex) {
							app.Logger.LogWarning(ex, "Failed to read manifest for {PluginName}", pluginName);
						}
					}

					discoveredPlugins.Add((pluginName, version));
				}
			}
		}

		app.Logger.LogInformation("Discovered {Count} plugins in repository", discoveredPlugins.Count);
	}
}
