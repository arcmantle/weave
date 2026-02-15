using System.Text.Json.Serialization;

namespace Pivot.Plugin;


/// <summary>
/// Client-side manifest for a Pivot plugin.
/// Deserialized from `client-manifest.json` in the plugin's `/client/` directory.
/// Describes what the plugin contributes to the app shell (routes, content areas, services).
/// </summary>
public class ClientManifest {
	/// <summary>
	/// Relative path to the ES module entry point (e.g. "index.js").
	/// </summary>
	[JsonPropertyName("entryModule")]
	public required string EntryModule { get; set; }

	/// <summary>
	/// Optional CSS files to load with the plugin.
	/// </summary>
	[JsonPropertyName("styles")]
	public List<string>? Styles { get; set; }

	/// <summary>
	/// Routes the plugin contributes to the app shell.
	/// </summary>
	[JsonPropertyName("routes")]
	public List<ClientPluginRoute>? Routes { get; set; }

	/// <summary>
	/// Content areas the plugin contributes to the app shell layout.
	/// </summary>
	[JsonPropertyName("contentAreas")]
	public List<ClientPluginContentArea>? ContentAreas { get; set; }

	/// <summary>
	/// Services the plugin registers into the DI container on activation.
	/// </summary>
	[JsonPropertyName("services")]
	public List<ClientPluginService>? Services { get; set; }

	/// <summary>
	/// Statusbar items the plugin contributes.
	/// </summary>
	[JsonPropertyName("statusbar")]
	public List<ClientPluginStatusbarItem>? Statusbar { get; set; }

	/// <summary>
	/// Dependency declarations.
	/// </summary>
	[JsonPropertyName("dependencies")]
	public ClientPluginDependencies? Dependencies { get; set; }

	/// <summary>
	/// Pre-built shared dependency bundles shipped by this plugin.
	/// Key = root package name (e.g. "lit"), Value = bundle metadata.
	///
	/// During startup the backend resolves version conflicts across all
	/// plugins (highest version per major wins) and serves the winning
	/// plugin's bundles at /shared/.
	///
	/// Generated automatically by the Vite plugin at build time.
	/// </summary>
	[JsonPropertyName("sharedBundles")]
	public Dictionary<string, SharedBundle>? SharedBundles { get; set; }
}


/// <summary>
/// Describes a pre-built shared dependency bundle shipped with a plugin.
/// </summary>
public class SharedBundle {
	/// <summary>
	/// Exact installed version of the root package (e.g. "3.2.1").
	/// </summary>
	[JsonPropertyName("version")]
	public required string Version { get; set; }

	/// <summary>
	/// Maps each bare specifier to its output file path relative to
	/// the plugin's /client/shared/ directory.
	/// E.g. { "lit": "lit.js", "lit/decorators.js": "lit__decorators_js.js" }
	/// </summary>
	[JsonPropertyName("files")]
	public required Dictionary<string, string> Files { get; set; }
}


/// <summary>
/// A route declaration from a plugin's client manifest.
/// </summary>
public class ClientPluginRoute {
	[JsonPropertyName("path")]
	public required string Path { get; set; }

	[JsonPropertyName("name")]
	public required string Name { get; set; }

	[JsonPropertyName("label")]
	public string? Label { get; set; }

	[JsonPropertyName("icon")]
	public string? Icon { get; set; }

	[JsonPropertyName("lazyComponent")]
	public required string LazyComponent { get; set; }
}


/// <summary>
/// A content area declaration from a plugin's client manifest.
/// </summary>
public class ClientPluginContentArea {
	[JsonPropertyName("id")]
	public required string Id { get; set; }

	[JsonPropertyName("defaultLocation")]
	public required string DefaultLocation { get; set; }

	[JsonPropertyName("availableLocations")]
	public required List<string> AvailableLocations { get; set; }

	[JsonPropertyName("tab")]
	public required ClientPluginTab Tab { get; set; }

	[JsonPropertyName("lazyComponent")]
	public required string LazyComponent { get; set; }
}


/// <summary>
/// Tab metadata for a content area.
/// </summary>
public class ClientPluginTab {
	[JsonPropertyName("id")]
	public required string Id { get; set; }

	[JsonPropertyName("title")]
	public required string Title { get; set; }

	[JsonPropertyName("icon")]
	public required string Icon { get; set; }
}


/// <summary>
/// A service declaration from a plugin's client manifest.
/// </summary>
public class ClientPluginService {
	[JsonPropertyName("identifier")]
	public required string Identifier { get; set; }

	[JsonPropertyName("exportName")]
	public required string ExportName { get; set; }
}


/// <summary>
/// A statusbar item declaration from a plugin's client manifest.
/// </summary>
public class ClientPluginStatusbarItem {
	[JsonPropertyName("id")]
	public required string Id { get; set; }

	[JsonPropertyName("alignment")]
	public required string Alignment { get; set; }

	[JsonPropertyName("priority")]
	public int? Priority { get; set; }

	[JsonPropertyName("lazyComponent")]
	public required string LazyComponent { get; set; }
}


/// <summary>
/// Dependency declarations for a client plugin.
/// </summary>
public class ClientPluginDependencies {
	/// <summary>
	/// Packages the plugin expects the host to provide via import map.
	/// Key = package name, Value = semver range.
	/// </summary>
	[JsonPropertyName("shared")]
	public Dictionary<string, string>? Shared { get; set; }

	/// <summary>
	/// Packages the plugin bundles itself (informational only).
	/// </summary>
	[JsonPropertyName("bundled")]
	public List<string>? Bundled { get; set; }
}


/// <summary>
/// Resolved plugin descriptor returned by the client-manifests API.
/// Combines plugin identity with its client manifest and asset base URL.
/// </summary>
public class ResolvedClientPlugin {
	[JsonPropertyName("name")]
	public required string Name { get; set; }

	[JsonPropertyName("version")]
	public required string Version { get; set; }

	[JsonPropertyName("baseUrl")]
	public required string BaseUrl { get; set; }

	[JsonPropertyName("clientManifest")]
	public required ClientManifest ClientManifest { get; set; }
}
