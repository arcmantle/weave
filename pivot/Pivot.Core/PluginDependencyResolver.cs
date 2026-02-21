using System.Text.Json;

namespace Pivot.Plugin;

/// <summary>
/// Resolves plugin dependencies and determines load order
/// </summary>
public class PluginDependencyResolver {
	/// <summary>
	/// Load all plugin manifests from a directory
	/// </summary>
	public static List<PluginManifest> LoadManifests(string pluginDirectory) {
		var manifests = new List<PluginManifest>();

		if (!Directory.Exists(pluginDirectory))
			return manifests;

		// Look for plugin.json in subdirectories
		foreach (var dir in Directory.GetDirectories(pluginDirectory)) {
			var manifestPath = Path.Combine(dir, "plugin.json");
			if (!File.Exists(manifestPath))
				continue;

			try {
				var json = File.ReadAllText(manifestPath);
				var manifest = JsonSerializer.Deserialize<PluginManifest>(json);

				if (manifest != null) {
					manifest.ManifestPath = manifestPath;
					manifest.PluginDirectory = dir;
					manifests.Add(manifest);
				}
			}
			catch (Exception ex) {
				throw new InvalidOperationException($"Failed to load plugin manifest from {manifestPath}", ex);
			}
		}

		return manifests;
	}

	/// <summary>
	/// Resolve plugin dependencies and return load order (topological sort)
	/// </summary>
	/// <param name="manifests">All available plugin manifests</param>
	/// <returns>Plugins in dependency order (dependencies first)</returns>
	/// <exception cref="InvalidOperationException">If circular dependencies or missing dependencies detected</exception>
	public static List<PluginManifest> ResolveLoadOrder(List<PluginManifest> manifests) {
		// Build lookup by name
		var manifestByName = manifests.ToDictionary(m => m.Name, m => m);

		// Verify all dependencies exist
		foreach (var manifest in manifests) {
			foreach (var dep in manifest.PluginDependencies.Keys) {
				if (!manifestByName.ContainsKey(dep)) {
					throw new InvalidOperationException(
						$"Plugin '{manifest.Name}' depends on '{dep}' which is not installed");
				}
			}
		}

		// Topological sort using DFS
		var sorted = new List<PluginManifest>();
		var visiting = new HashSet<string>(); // For cycle detection
		var visited = new HashSet<string>();

		void Visit(PluginManifest manifest) {
			if (visited.Contains(manifest.Name))
				return;

			if (visiting.Contains(manifest.Name)) {
				throw new InvalidOperationException(
					$"Circular dependency detected involving plugin '{manifest.Name}'");
			}

			visiting.Add(manifest.Name);

			// Visit dependencies first
			foreach (var depName in manifest.PluginDependencies.Keys) {
				Visit(manifestByName[depName]);
			}

			visiting.Remove(manifest.Name);
			visited.Add(manifest.Name);
			sorted.Add(manifest);
		}

		// Visit all plugins
		foreach (var manifest in manifests) {
			Visit(manifest);
		}

		return sorted;
	}

	/// <summary>
	/// Detect conflicts in third-party package dependencies across plugins
	/// </summary>
	public static List<PackageConflict> DetectPackageConflicts(List<PluginManifest> manifests) {
		var conflicts = new List<PackageConflict>();
		var packagesByName = new Dictionary<string, List<(string PluginName, string Version)>>(StringComparer.OrdinalIgnoreCase);

		// Collect all package dependencies
		foreach (var manifest in manifests) {
			foreach (var (packageName, version) in manifest.PackageDependencies) {
				if (!packagesByName.ContainsKey(packageName))
					packagesByName[packageName] = new();

				packagesByName[packageName].Add((manifest.Name, version));
			}
		}

		// Find packages with multiple different versions
		foreach (var (packageName, usages) in packagesByName) {
			var distinctVersions = usages.Select(u => u.Version).Distinct().ToList();
			if (distinctVersions.Count > 1) {
				conflicts.Add(new PackageConflict {
					PackageName = packageName,
					Usages = usages.ToList()
				});
			}
		}

		return conflicts;
	}

	/// <summary>
	/// Check if a version satisfies a semver range constraint.
	/// Supports: "1.2.3" (exact), "^1.2.0" (compatible), ">=1.0.0" (range)
	/// </summary>
	public static bool SatisfiesVersion(string version, string constraint) {
		// Simple version matching - could be enhanced with proper semver library

		if (constraint.StartsWith("^")) {
			// Caret: ^1.2.3 means >=1.2.3 <2.0.0
			var requiredVersion = constraint[1..];
			var required = ParseVersion(requiredVersion);
			var actual = ParseVersion(version);

			return actual.Major == required.Major &&
						 (actual.Minor > required.Minor ||
							(actual.Minor == required.Minor && actual.Patch >= required.Patch));
		}
		else if (constraint.StartsWith(">=")) {
			var requiredVersion = constraint[2..];
			return CompareVersions(version, requiredVersion) >= 0;
		}
		else if (constraint.StartsWith(">")) {
			var requiredVersion = constraint[1..];
			return CompareVersions(version, requiredVersion) > 0;
		}
		else {
			// Exact match
			return version == constraint;
		}
	}

	private static (int Major, int Minor, int Patch) ParseVersion(string version) {
		var parts = version.Split('.');
		return (
			int.Parse(parts[0]),
			parts.Length > 1 ? int.Parse(parts[1]) : 0,
			parts.Length > 2 ? int.Parse(parts[2]) : 0
		);
	}

	private static int CompareVersions(string v1, string v2) {
		var version1 = ParseVersion(v1);
		var version2 = ParseVersion(v2);

		if (version1.Major != version2.Major)
			return version1.Major.CompareTo(version2.Major);
		if (version1.Minor != version2.Minor)
			return version1.Minor.CompareTo(version2.Minor);
		return version1.Patch.CompareTo(version2.Patch);
	}
}

/// <summary>
/// Represents a conflict where multiple plugins require different versions of the same package
/// </summary>
public class PackageConflict {
	public required string PackageName { get; init; }
	public required List<(string PluginName, string Version)> Usages { get; init; }
}
