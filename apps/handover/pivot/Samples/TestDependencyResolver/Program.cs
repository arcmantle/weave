using Pivot.Plugin;

// Test the dependency resolver
Console.WriteLine("Loading plugin manifests...\n");

// For testing, use the actual plugin build output directories
var testDir = @"c:\Programming\projects\arcmantle\weave\apps\handover\pivot\Samples\Plugins";
var pluginDirs = new[]
{
		Path.Combine(testDir, "UsersPlugin", "bin", "Debug", "net9.0"),
		Path.Combine(testDir, "TodosPlugin", "bin", "Debug", "net9.0"),
		Path.Combine(testDir, "WeatherPlugin", "bin", "Debug", "net9.0")
};

var manifests = new List<PluginManifest>();
foreach (var dir in pluginDirs)
{
	var manifestPath = Path.Combine(dir, "plugin.json");
	if (File.Exists(manifestPath))
	{
		var json = File.ReadAllText(manifestPath);
		var manifest = System.Text.Json.JsonSerializer.Deserialize<PluginManifest>(json);
		if (manifest != null)
		{
			manifest.ManifestPath = manifestPath;
			manifest.PluginDirectory = dir;
			manifests.Add(manifest);
			Console.WriteLine($"Found: {manifest.Name} v{manifest.Version}");
			if (manifest.PluginDependencies.Any())
			{
				Console.WriteLine($"  Depends on: {string.Join(", ", manifest.PluginDependencies.Select(d => $"{d.Key} {d.Value}"))}");
			}
		}
	}
}

Console.WriteLine($"\nTotal plugins found: {manifests.Count}\n");

// Resolve load order
Console.WriteLine("Resolving load order...\n");
try
{
	var loadOrder = PluginDependencyResolver.ResolveLoadOrder(manifests);

	Console.WriteLine("✓ Load order resolved successfully:");
	for (int i = 0; i < loadOrder.Count; i++)
	{
		Console.WriteLine($"  {i + 1}. {loadOrder[i].Name} v{loadOrder[i].Version}");
	}
}
catch (Exception ex)
{
	Console.WriteLine($"✗ Failed to resolve: {ex.Message}");
}
