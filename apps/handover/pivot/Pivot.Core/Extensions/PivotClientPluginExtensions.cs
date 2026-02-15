using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Pivot.Backend;
using Pivot.Plugin;

namespace Pivot.Extensions;


/// <summary>
/// Extension methods for serving client-side plugin assets and providing
/// plugin metadata to the app shell via API endpoints.
/// </summary>
public static class PivotClientPluginExtensions {
	/// <summary>
	/// Maps endpoints and middleware for serving client-side plugin assets.
	///
	/// This adds:
	/// - Static file serving for each plugin's /client/ directory at /plugins/{name}/client/
	/// - GET /api/plugins/client-manifests — returns all enabled plugins' client manifests
	/// - GET /api/client/import-map — returns a generated browser import map
	/// </summary>
	public static WebApplication MapPivotClientPlugins(
		this WebApplication app,
		Action<PivotClientPluginOptions>? configure = null
	) {
		var options = new PivotClientPluginOptions();
		configure?.Invoke(options);

		var logger = app.Services.GetRequiredService<ILogger<WebApplication>>();
		var backendOptions = app.Services.GetService<PivotBackendOptions>();

		var pluginDirectory = options.PluginDirectory
			?? backendOptions?.PluginDirectory;

		if (string.IsNullOrEmpty(pluginDirectory) || !Directory.Exists(pluginDirectory)) {
			logger.LogWarning(
				"Plugin directory not configured or not found for client plugin serving. " +
				"Client-side plugin assets will not be available.");
			return app;
		}

		// Discover plugins with client manifests
		var resolvedPlugins = DiscoverClientPlugins(pluginDirectory, logger);

		// Serve static files for each plugin's client directory
		foreach (var plugin in resolvedPlugins) {
			var clientDir = plugin.ClientDirectory;
			if (!Directory.Exists(clientDir))
				continue;

			var requestPath = $"/plugins/{plugin.Name}/client";

			app.UseStaticFiles(new StaticFileOptions {
				FileProvider = new PhysicalFileProvider(clientDir),
				RequestPath = requestPath,
				ContentTypeProvider = new FileExtensionContentTypeProvider(
					new Dictionary<string, string> {
						{ ".js",   "application/javascript" },
						{ ".mjs",  "application/javascript" },
						{ ".css",  "text/css" },
						{ ".json", "application/json" },
						{ ".map",  "application/json" },
						{ ".svg",  "image/svg+xml" },
						{ ".png",  "image/png" },
						{ ".jpg",  "image/jpeg" },
						{ ".woff", "font/woff" },
						{ ".woff2", "font/woff2" },
					}
				),
				ServeUnknownFileTypes = false,
			});

			logger.LogInformation(
				"Serving client assets for plugin '{Plugin}' at {Path}",
				plugin.Name, requestPath);
		}

		// Optionally serve shared dependencies directory
		if (!string.IsNullOrEmpty(options.SharedDependenciesDirectory)
			&& Directory.Exists(options.SharedDependenciesDirectory)) {
			app.UseStaticFiles(new StaticFileOptions {
				FileProvider = new PhysicalFileProvider(options.SharedDependenciesDirectory),
				RequestPath = "/shared",
			});

			logger.LogInformation(
				"Serving shared dependencies from {Dir} at /shared",
				options.SharedDependenciesDirectory);
		}

		// Map API endpoints
		MapClientPluginEndpoints(app, resolvedPlugins, options);

		return app;
	}

	/// <summary>
	/// Discovers plugins that have client-side manifests.
	/// Supports both production layout (client/client-manifest.json)
	/// and development layout (client/dist/client/client-manifest.json).
	/// </summary>
	private static List<DiscoveredClientPlugin> DiscoverClientPlugins(
		string pluginDirectory,
		ILogger logger
	) {
		var result = new List<DiscoveredClientPlugin>();

		// Look for plugin directories that contain a `client/` subdirectory
		// with a `client-manifest.json`
		foreach (var dir in Directory.GetDirectories(pluginDirectory)) {
			var pluginName = Path.GetFileName(dir);

			// Try production layout first: {plugin}/client/client-manifest.json
			var clientDir = Path.Combine(dir, "client");
			var manifestPath = Path.Combine(clientDir, "client-manifest.json");

			// Fall back to dev layout: {plugin}/client/dist/client/client-manifest.json
			if (!File.Exists(manifestPath)) {
				var devClientDir = Path.Combine(dir, "client", "dist", "client");
				var devManifestPath = Path.Combine(devClientDir, "client-manifest.json");
				if (File.Exists(devManifestPath)) {
					clientDir = devClientDir;
					manifestPath = devManifestPath;
				}
			}

			if (!File.Exists(manifestPath))
				continue;

			try {
				var json = File.ReadAllText(manifestPath);
				var manifest = JsonSerializer.Deserialize<ClientManifest>(json);

				if (manifest == null) {
					logger.LogWarning(
						"Failed to deserialize client manifest for plugin '{Plugin}'",
						pluginName);
					continue;
				}

				// Try to read the plugin.json for version info
				var version = "0.0.0";
				var pluginJsonPath = Path.Combine(dir, "plugin.json");
				if (File.Exists(pluginJsonPath)) {
					try {
						var pluginJson = File.ReadAllText(pluginJsonPath);
						var pluginManifest = JsonSerializer.Deserialize<PluginManifest>(pluginJson);
						if (pluginManifest != null)
							version = pluginManifest.Version;
					}
					catch {
						// Ignore — use default version
					}
				}

				result.Add(new DiscoveredClientPlugin {
					Name = pluginName,
					Version = version,
					ClientDirectory = clientDir,
					ClientManifest = manifest,
				});

				logger.LogInformation(
					"Discovered client plugin '{Plugin}' v{Version} with entry '{Entry}'",
					pluginName, version, manifest.EntryModule);
			}
			catch (Exception ex) {
				logger.LogError(ex,
					"Error loading client manifest for plugin '{Plugin}'",
					pluginName);
			}
		}

		// Also check flat plugin directories (plugins without server/client subdirectories)
		// This handles the case where client-manifest.json is directly in the plugin dir
		var pluginJsonFiles = Directory.GetFiles(pluginDirectory, "plugin.json", SearchOption.TopDirectoryOnly);
		if (pluginJsonFiles.Length > 0) {
			var clientDir = Path.Combine(pluginDirectory, "client");
			var manifestPath = Path.Combine(clientDir, "client-manifest.json");

			// Only handle if there's a client manifest in the flat structure
			if (File.Exists(manifestPath)) {
				try {
					var json = File.ReadAllText(manifestPath);
					var manifest = JsonSerializer.Deserialize<ClientManifest>(json);
					if (manifest != null) {
						var pluginJson = File.ReadAllText(pluginJsonFiles[0]);
						var pluginManifest = JsonSerializer.Deserialize<PluginManifest>(pluginJson);

						if (pluginManifest != null && !result.Any(p => p.Name == pluginManifest.Name)) {
							result.Add(new DiscoveredClientPlugin {
								Name = pluginManifest.Name,
								Version = pluginManifest.Version,
								ClientDirectory = clientDir,
								ClientManifest = manifest,
							});
						}
					}
				}
				catch {
					// Ignore flat structure errors
				}
			}
		}

		return result;
	}

	/// <summary>
	/// Maps API endpoints for client plugin discovery.
	/// </summary>
	private static void MapClientPluginEndpoints(
		WebApplication app,
		List<DiscoveredClientPlugin> plugins,
		PivotClientPluginOptions options
	) {
		// Resolve shared dependency versions across all plugins.
		// For each root package, the plugin with the highest version (same major) wins.
		var resolvedShared = ResolveSharedDependencies(plugins, app.Logger);

		// Serve the winning plugin's shared/ directory at /shared/
		ServeResolvedSharedBundles(app, resolvedShared);

		var clientApi = app.MapGroup("/api/plugins")
			.WithTags("Client Plugins");

		// GET /api/plugins/client-manifests
		// Returns all enabled plugins' client manifests with their asset base URLs
		clientApi.MapGet("/client-manifests", () => {
			var resolved = plugins.Select(p => new ResolvedClientPlugin {
				Name = p.Name,
				Version = p.Version,
				BaseUrl = $"/plugins/{p.Name}/client/",
				ClientManifest = p.ClientManifest,
			}).ToList();

			return Results.Ok(resolved);
		})
		.WithName("GetClientManifests")
		.WithSummary("Get all enabled plugins' client manifests");

		// GET /api/client/import-map
		// Returns a generated browser import map built from resolved shared deps
		app.MapGet("/api/client/import-map", () => {
			var imports = new Dictionary<string, string>();

			// Build import map from resolved shared dependency bundles.
			// Each specifier maps to /shared/{filename} served from the
			// winning plugin's shared/ directory.
			foreach (var (specifier, entry) in resolvedShared) {
				imports[specifier] = $"/shared/{entry.FileName}";
			}

			// Apply explicit overrides from options (takes precedence)
			if (options.SharedDependencies != null) {
				foreach (var (name, url) in options.SharedDependencies) {
					imports[name] = url;
				}
			}

			// Add plugin entry points
			foreach (var plugin in plugins) {
				var key = $"@pivot-plugin/{plugin.Name.ToLowerInvariant()}";
				imports[key] = $"/plugins/{plugin.Name}/client/{plugin.ClientManifest.EntryModule}";
			}

			var importMap = new {
				imports,
			};

			return Results.Json(importMap, contentType: "application/importmap+json");
		})
		.WithName("GetImportMap")
		.WithSummary("Get the generated browser import map for plugin resolution")
		.WithTags("Client Plugins");
	}

	/// <summary>
	/// Resolves shared dependency versions across all plugins.
	///
	/// For each root package, picks the plugin with the highest version
	/// within the same major version. All specifiers from that root package
	/// are served from the winning plugin's shared/ directory.
	/// </summary>
	internal static Dictionary<string, ResolvedSharedEntry> ResolveSharedDependencies(
		List<DiscoveredClientPlugin> plugins,
		ILogger logger
	) {
		// Group by root package → list of (plugin, version, files)
		var candidates = new Dictionary<string, List<(DiscoveredClientPlugin Plugin, Version Version, Dictionary<string, string> Files, string SharedDir)>>();

		foreach (var plugin in plugins) {
			var bundles = plugin.ClientManifest.SharedBundles;
			if (bundles == null)
				continue;

			foreach (var (rootPkg, bundle) in bundles) {
				if (!System.Version.TryParse(SanitizeVersion(bundle.Version), out var version)) {
					logger.LogWarning(
						"Plugin '{Plugin}' declares shared dep '{Pkg}' with unparseable version '{Version}'",
						plugin.Name, rootPkg, bundle.Version);
					continue;
				}

				var sharedDir = Path.Combine(plugin.ClientDirectory, "shared");

				if (!candidates.ContainsKey(rootPkg))
					candidates[rootPkg] = [];

				candidates[rootPkg].Add((plugin, version, bundle.Files, sharedDir));
			}
		}

		// Pick the winner for each root package
		var result = new Dictionary<string, ResolvedSharedEntry>();

		foreach (var (rootPkg, entries) in candidates) {
			// Sort by version descending — highest wins
			var sorted = entries.OrderByDescending(e => e.Version).ToList();
			var winner = sorted[0];

			// Warn if there are major version conflicts
			var distinctMajors = sorted.Select(e => e.Version.Major).Distinct().Count();
			if (distinctMajors > 1) {
				logger.LogWarning(
					"Shared dep '{Pkg}' has conflicting major versions across plugins. " +
					"Using v{Version} from '{Plugin}'",
					rootPkg, winner.Version, winner.Plugin.Name);
			}
			else if (sorted.Count > 1) {
				logger.LogInformation(
					"Shared dep '{Pkg}': using v{Version} from '{Plugin}' (highest of {Count} candidates)",
					rootPkg, winner.Version, winner.Plugin.Name, sorted.Count);
			}

			// Map each specifier to its resolved file
			foreach (var (specifier, fileName) in winner.Files) {
				result[specifier] = new ResolvedSharedEntry {
					RootPackage = rootPkg,
					Version = winner.Version.ToString(),
					FileName = fileName,
					SourceDirectory = winner.SharedDir,
					SourcePlugin = winner.Plugin.Name,
				};
			}
		}

		return result;
	}

	/// <summary>
	/// Configures static file serving for the resolved shared dependency bundles.
	/// All winning plugins' shared/ directories are served at /shared/.
	/// </summary>
	private static void ServeResolvedSharedBundles(
		WebApplication app,
		Dictionary<string, ResolvedSharedEntry> resolvedShared
	) {
		var logger = app.Services.GetRequiredService<ILogger<WebApplication>>();

		// Collect unique source directories to serve
		var directories = resolvedShared.Values
			.Select(e => e.SourceDirectory)
			.Distinct()
			.Where(Directory.Exists)
			.ToList();

		foreach (var dir in directories) {
			app.UseStaticFiles(new StaticFileOptions {
				FileProvider = new PhysicalFileProvider(dir),
				RequestPath = "/shared",
				ContentTypeProvider = new FileExtensionContentTypeProvider(
					new Dictionary<string, string> {
						{ ".js",  "application/javascript" },
						{ ".mjs", "application/javascript" },
						{ ".map", "application/json" },
					}
				),
				ServeUnknownFileTypes = false,
			});

			logger.LogInformation("Serving shared dependency bundles from {Dir} at /shared", dir);
		}
	}

	/// <summary>
	/// Strips pre-release and build metadata from a semver string
	/// so it can be parsed by System.Version (major.minor.patch only).
	/// </summary>
	internal static string SanitizeVersion(string version) {
		// Remove leading 'v' if present
		if (version.StartsWith('v'))
			version = version[1..];

		// Strip pre-release (-beta.1) and build metadata (+hash)
		var dashIdx = version.IndexOf('-');
		if (dashIdx >= 0)
			version = version[..dashIdx];

		var plusIdx = version.IndexOf('+');
		if (plusIdx >= 0)
			version = version[..plusIdx];

		return version;
	}

	/// <summary>
	/// Internal model for a resolved shared dependency entry.
	/// </summary>
	internal class ResolvedSharedEntry {
		public required string RootPackage { get; set; }
		public required string Version { get; set; }
		public required string FileName { get; set; }
		public required string SourceDirectory { get; set; }
		public required string SourcePlugin { get; set; }
	}

	/// <summary>
	/// Internal model for a discovered client plugin.
	/// </summary>
	internal class DiscoveredClientPlugin {
		public required string Name { get; set; }
		public required string Version { get; set; }
		public required string ClientDirectory { get; set; }
		public required ClientManifest ClientManifest { get; set; }
	}
}


/// <summary>
/// Configuration options for client-side plugin serving.
/// </summary>
public class PivotClientPluginOptions {
	/// <summary>
	/// Directory where active plugins are located.
	/// Falls back to PivotBackendOptions.PluginDirectory if not set.
	/// </summary>
	public string? PluginDirectory { get; set; }

	/// <summary>
	/// Directory containing pre-built shared dependencies (Lit, etc.)
	/// that are served at /shared/ and referenced by the import map.
	/// </summary>
	public string? SharedDependenciesDirectory { get; set; }

	/// <summary>
	/// Shared dependencies to include in the generated import map.
	/// Key = bare module specifier (e.g. "lit"), Value = URL path.
	/// </summary>
	public Dictionary<string, string>? SharedDependencies { get; set; }
}
