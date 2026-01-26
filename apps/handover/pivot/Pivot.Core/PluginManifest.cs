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
	/// README content in markdown format
	/// </summary>
	[JsonPropertyName("readme")]
	public string? Readme { get; set; }

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
	/// Get the main assembly path
	/// </summary>
	public string GetMainAssemblyPath() {
		if (PluginDirectory == null)
			throw new InvalidOperationException("PluginDirectory not set");

		var assemblyName = Main ?? $"{Name}.dll";
		return Path.Combine(PluginDirectory, assemblyName);
	}
}
