using Microsoft.Extensions.Logging;
using Pivot.Extensions;
using Pivot.Plugin;

using static Pivot.Extensions.PivotClientPluginExtensions;

namespace Pivot.Core.Tests;


public class ResolveSharedDependenciesTests {
	private static readonly ILogger Logger = LoggerFactory
		.Create(b => b.AddConsole())
		.CreateLogger<ResolveSharedDependenciesTests>();


	/// <summary>
	/// Creates a <see cref="DiscoveredClientPlugin"/> with the given shared bundles
	/// for use in test scenarios.
	/// </summary>
	private static DiscoveredClientPlugin CreatePlugin(
		string name,
		Dictionary<string, SharedBundle>? sharedBundles
	) {
		return new DiscoveredClientPlugin {
			Name = name,
			Version = "1.0.0",
			ClientDirectory = $"/plugins/{name}/client",
			ClientManifest = new ClientManifest {
				EntryModule = "index.js",
				SharedBundles = sharedBundles,
			},
		};
	}


	[Fact]
	public void No_plugins_returns_empty_result() {
		var result = ResolveSharedDependencies([], Logger);

		Assert.Empty(result);
	}

	[Fact]
	public void Plugin_without_shared_bundles_is_ignored() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", null),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		Assert.Empty(result);
	}

	[Fact]
	public void Single_plugin_all_specifiers_resolved() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.1",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
						["lit/decorators.js"] = "lit__decorators_js.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		Assert.Equal(2, result.Count);
		Assert.True(result.ContainsKey("lit"));
		Assert.True(result.ContainsKey("lit/decorators.js"));

		Assert.Equal("lit.js", result["lit"].FileName);
		Assert.Equal("lit__decorators_js.js", result["lit/decorators.js"].FileName);
		Assert.Equal("PluginA", result["lit"].SourcePlugin);
		Assert.Equal("3.2.1", result["lit"].Version);
	}

	[Fact]
	public void Two_plugins_same_package_higher_version_wins() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.1.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
			CreatePlugin("PluginB", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		Assert.Single(result);
		Assert.Equal("PluginB", result["lit"].SourcePlugin);
		Assert.Equal("3.2.0", result["lit"].Version);
	}

	[Fact]
	public void Higher_version_wins_regardless_of_plugin_order() {
		// PluginA has the higher version this time, but is listed first
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.5.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
			CreatePlugin("PluginB", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.1.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		Assert.Equal("PluginA", result["lit"].SourcePlugin);
	}

	[Fact]
	public void Winner_serves_all_specifiers_from_its_files() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.1.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
						["lit/decorators.js"] = "lit__decorators_js.js",
					},
				},
			}),
			CreatePlugin("PluginB", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
						["lit/decorators.js"] = "lit__decorators_js.js",
						["lit/directives/when.js"] = "lit__directives__when_js.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		// PluginB wins — it has 3 specifiers, all should come from PluginB
		Assert.Equal(3, result.Count);
		Assert.All(result.Values, entry => Assert.Equal("PluginB", entry.SourcePlugin));
		Assert.Equal("lit__directives__when_js.js", result["lit/directives/when.js"].FileName);
	}

	[Fact]
	public void Different_root_packages_resolved_independently() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
				["tslib"] = new SharedBundle {
					Version = "2.6.0",
					Files = new Dictionary<string, string> {
						["tslib"] = "tslib.js",
					},
				},
			}),
			CreatePlugin("PluginB", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.1.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
				["tslib"] = new SharedBundle {
					Version = "2.7.0",
					Files = new Dictionary<string, string> {
						["tslib"] = "tslib.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		// lit@3.2.0 from PluginA, tslib@2.7.0 from PluginB
		Assert.Equal("PluginA", result["lit"].SourcePlugin);
		Assert.Equal("3.2.0", result["lit"].Version);
		Assert.Equal("PluginB", result["tslib"].SourcePlugin);
		Assert.Equal("2.7.0", result["tslib"].Version);
	}

	[Fact]
	public void Prerelease_version_is_sanitized_before_comparison() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.0-beta.1",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
			CreatePlugin("PluginB", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.1.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		// 3.2.0-beta.1 sanitizes to 3.2.0, which is > 3.1.0
		Assert.Equal("PluginA", result["lit"].SourcePlugin);
	}

	[Fact]
	public void Unparseable_version_is_skipped() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "not-a-version",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
			CreatePlugin("PluginB", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.1.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		// PluginA is skipped due to bad version, PluginB wins by default
		Assert.Equal("PluginB", result["lit"].SourcePlugin);
	}

	[Fact]
	public void All_versions_unparseable_returns_empty() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "garbage",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		Assert.Empty(result);
	}

	[Fact]
	public void Major_version_conflict_still_picks_highest() {
		// Both should be resolved — highest version wins regardless of major mismatch
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "2.0.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
			CreatePlugin("PluginB", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.1.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		Assert.Equal("PluginB", result["lit"].SourcePlugin);
		Assert.Equal("3.1.0", result["lit"].Version);
	}

	[Fact]
	public void Source_directory_points_to_shared_subdirectory() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		var expectedDir = Path.Combine("/plugins/PluginA/client", "shared");
		Assert.Equal(expectedDir, result["lit"].SourceDirectory);
	}

	[Fact]
	public void Root_package_field_is_set_correctly() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["@lit/context"] = new SharedBundle {
					Version = "1.1.0",
					Files = new Dictionary<string, string> {
						["@lit/context"] = "@lit__context.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		Assert.Equal("@lit/context", result["@lit/context"].RootPackage);
	}

	[Fact]
	public void Three_plugins_competing_on_same_package() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.1.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
			CreatePlugin("PluginB", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.3.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
			CreatePlugin("PluginC", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		Assert.Equal("PluginB", result["lit"].SourcePlugin);
		Assert.Equal("3.3.0", result["lit"].Version);
	}

	[Fact]
	public void Plugin_with_identical_versions_first_wins() {
		var plugins = new List<DiscoveredClientPlugin> {
			CreatePlugin("PluginA", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
			CreatePlugin("PluginB", new Dictionary<string, SharedBundle> {
				["lit"] = new SharedBundle {
					Version = "3.2.0",
					Files = new Dictionary<string, string> {
						["lit"] = "lit.js",
					},
				},
			}),
		};

		var result = ResolveSharedDependencies(plugins, Logger);

		// Both have the same version, the first one in the sorted order wins
		Assert.Contains(result["lit"].SourcePlugin, new List<string> { "PluginA", "PluginB" });
		Assert.Equal("3.2.0", result["lit"].Version);
	}
}
