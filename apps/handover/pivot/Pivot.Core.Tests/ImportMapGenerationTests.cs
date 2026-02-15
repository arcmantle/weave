using Microsoft.Extensions.Logging;
using Pivot.Extensions;
using Pivot.Plugin;

using static Pivot.Extensions.PivotClientPluginExtensions;

namespace Pivot.Core.Tests;


/// <summary>
/// Tests that the import map entries derived from resolved shared dependencies
/// produce the expected URL mappings. This exercises the same logic used by
/// the /api/client/import-map endpoint without requiring a full WebApplication.
/// </summary>
public class ImportMapGenerationTests {
	private static readonly ILogger Logger = LoggerFactory
		.Create(b => b.AddConsole())
		.CreateLogger<ImportMapGenerationTests>();


	/// <summary>
	/// Simulates the import map generation logic from MapClientPluginEndpoints.
	/// </summary>
	private static Dictionary<string, string> BuildImportMap(
		List<DiscoveredClientPlugin> plugins,
		Dictionary<string, string>? overrides = null
	) {
		var resolvedShared = ResolveSharedDependencies(plugins, Logger);
		var imports = new Dictionary<string, string>();

		// From resolved shared deps
		foreach (var (specifier, entry) in resolvedShared)
			imports[specifier] = $"/shared/{entry.FileName}";

		// Overrides
		if (overrides != null) {
			foreach (var (name, url) in overrides)
				imports[name] = url;
		}

		// Plugin entry points
		foreach (var plugin in plugins) {
			var key = $"@pivot-plugin/{plugin.Name.ToLowerInvariant()}";
			imports[key] = $"/plugins/{plugin.Name}/client/{plugin.ClientManifest.EntryModule}";
		}

		return imports;
	}

	private static DiscoveredClientPlugin CreatePlugin(
		string name,
		string entryModule = "index.js",
		Dictionary<string, SharedBundle>? sharedBundles = null
	) {
		return new DiscoveredClientPlugin {
			Name = name,
			Version = "1.0.0",
			ClientDirectory = $"/plugins/{name}/client",
			ClientManifest = new ClientManifest {
				EntryModule = entryModule,
				SharedBundles = sharedBundles,
			},
		};
	}


	[Fact]
	public void Shared_deps_map_to_shared_url_path() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("Weather", sharedBundles: new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
						["lit/decorators.js"] = "lit__decorators_js.js",
					},
				},
			}),
		};

		var imports = BuildImportMap(plugins);

		Assert.Equal("/shared/lit.js", imports["lit"]);
		Assert.Equal("/shared/lit__decorators_js.js", imports["lit/decorators.js"]);
	}

	[Fact]
	public void Plugin_entry_points_use_lowercase_plugin_name() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("WeatherPlugin", entryModule: "index.js"),
		};

		var imports = BuildImportMap(plugins);

		Assert.True(imports.ContainsKey("@pivot-plugin/weatherplugin"));
		Assert.Equal("/plugins/WeatherPlugin/client/index.js", imports["@pivot-plugin/weatherplugin"]);
	}

	[Fact]
	public void Explicit_overrides_take_precedence_over_resolved_shared() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", sharedBundles: new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
		};

		var overrides = new Dictionary<string, string> {
			["lit"] = "/custom/lit-override.js",
		};

		var imports = BuildImportMap(plugins, overrides);

		Assert.Equal("/custom/lit-override.js", imports["lit"]);
	}

	[Fact]
	public void Multiple_plugins_combine_their_entry_points() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("Weather"),
			CreatePlugin("Todos"),
		};

		var imports = BuildImportMap(plugins);

		Assert.True(imports.ContainsKey("@pivot-plugin/weather"));
		Assert.True(imports.ContainsKey("@pivot-plugin/todos"));
	}

	[Fact]
	public void No_plugins_produces_empty_import_map() {
		var imports = BuildImportMap([]);

		Assert.Empty(imports);
	}

	[Fact]
	public void Scoped_packages_use_correct_filename() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", sharedBundles: new Dictionary<string, SharedBundle> {
				["@lit/context"] = new SharedBundle {
					Version = "1.1.0",
					Files = new Dictionary<string, string> {
						["@lit/context"] = "@lit__context.js",
					},
				},
			}),
		};

		var imports = BuildImportMap(plugins);

		Assert.Equal("/shared/@lit__context.js", imports["@lit/context"]);
	}

	[Fact]
	public void Version_resolution_across_plugins_reflects_in_import_map() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", sharedBundles: new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.1.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
						["lit/decorators.js"] = "lit__decorators_js.js",
					},
				},
			}),
			CreatePlugin("PluginB", sharedBundles: new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.3.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
						["lit/decorators.js"] = "lit__decorators_js.js",
						["lit/directives/when.js"] = "lit__directives__when_js.js",
					},
				},
			}),
		};

		var imports = BuildImportMap(plugins);

		// PluginB has higher version, so all lit specifiers should resolve
		// The URLs are the same filenames but served from PluginB's shared dir
		Assert.Equal("/shared/lit.js", imports["lit"]);
		Assert.Equal("/shared/lit__decorators_js.js", imports["lit/decorators.js"]);
		Assert.Equal("/shared/lit__directives__when_js.js", imports["lit/directives/when.js"]);
	}
}
