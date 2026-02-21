using System.Text.Json.Serialization;

namespace Pivot.Plugin;

/// <summary>
/// Plugin manifest declaring metadata and dependencies.
/// Should be named "plugin.json" in the plugin directory.
/// </summary>
public class PluginManifest {
	/// <summary>
	/// Unique plugin identifier (matches assembly name)
	/// </summary>
	[JsonPropertyName("name")]
	public required string Name { get; set; }

	/// <summary>
	/// Semantic version of this plugin
	/// </summary>
	[JsonPropertyName("version")]
	public required string Version { get; set; }

	/// <summary>
	/// Human-readable description
	/// </summary>
	[JsonPropertyName("description")]
	public string? Description { get; set; }

	/// <summary>
	/// Plugin author
	/// </summary>
	[JsonPropertyName("author")]
	public string? Author { get; set; }

	/// <summary>
	/// Other plugins this plugin depends on.
	/// Key = plugin name, Value = semver range (e.g., "^1.0.0", ">=2.0.0")
	/// </summary>
	[JsonPropertyName("pluginDependencies")]
	public Dictionary<string, string> PluginDependencies { get; set; } = new();

	/// <summary>
	/// Third-party NuGet packages this plugin depends on.
	/// Key = package name, Value = version (for conflict detection)
	/// </summary>
	[JsonPropertyName("packageDependencies")]
	public Dictionary<string, string> PackageDependencies { get; set; } = new();

	/// <summary>
	/// Main assembly file name (defaults to {Name}.dll if not specified)
	/// </summary>
	[JsonPropertyName("main")]
	public string? Main { get; set; }

	/// <summary>
	/// License identifier (e.g., "MIT", "Apache-2.0", "GPL-3.0")
	/// </summary>
	[JsonPropertyName("license")]
	public string? License { get; set; }

	/// <summary>
	/// Tags for categorization and searchability
	/// </summary>
	[JsonPropertyName("tags")]
	public List<string>? Tags { get; set; }

	/// <summary>
	/// README content in markdown format (root README.md)
	/// </summary>
	[JsonPropertyName("readme")]
	public string? Readme { get; set; }

	/// <summary>
	/// Server-side README content in markdown format (server/README.md)
	/// </summary>
	[JsonPropertyName("serverReadme")]
	public string? ServerReadme { get; set; }

	/// <summary>
	/// Client-side README content in markdown format (client/README.md)
	/// </summary>
	[JsonPropertyName("clientReadme")]
	public string? ClientReadme { get; set; }

	/// <summary>
	/// Repository URL (e.g., GitHub repo)
	/// </summary>
	[JsonPropertyName("repository")]
	public string? Repository { get; set; }

	/// <summary>
	/// Homepage URL
	/// </summary>
	[JsonPropertyName("homepage")]
	public string? Homepage { get; set; }

	/// <summary>
	/// Path to the manifest file (populated when loading)
	/// </summary>
	[JsonIgnore]
	public string? ManifestPath { get; set; }

	/// <summary>
	/// Directory containing the plugin (populated when loading)
	/// </summary>
	[JsonIgnore]
	public string? PluginDirectory { get; set; }

	/// <summary>
	/// Client-side manifest (populated from client/client-manifest.json if present)
	/// </summary>
	[JsonIgnore]
	public ClientManifest? Client { get; set; }

	/// <summary>
	/// Whether this plugin has a client-side component
	/// </summary>
	[JsonIgnore]
	public bool HasClient => Client != null;

	/// <summary>
	/// Get the path to the plugin's client directory
	/// </summary>
	public string? GetClientDirectory() {
		if (PluginDirectory == null)
			return null;

		var clientDir = Path.Combine(PluginDirectory, "client");
		return Directory.Exists(clientDir) ? clientDir : null;
	}

	/// <summary>
	/// Try to load the client manifest from the plugin's client directory
	/// </summary>
	public bool TryLoadClientManifest() {
		var clientDir = GetClientDirectory();
		if (clientDir == null)
			return false;

		var manifestPath = Path.Combine(clientDir, "client-manifest.json");
		if (!File.Exists(manifestPath))
			return false;

		try {
			var json = File.ReadAllText(manifestPath);
			Client = System.Text.Json.JsonSerializer.Deserialize<ClientManifest>(json);
			return Client != null;
		}
		catch {
			return false;
		}
	}

	/// <summary>
	/// Get the main assembly path
	/// </summary>
	public string GetMainAssemblyPath() {
		if (PluginDirectory == null)
			throw new InvalidOperationException("PluginDirectory not set");

		var assemblyName = Main ?? $"{Name}.dll";
		return Path.Combine(PluginDirectory, assemblyName);
	}
}
