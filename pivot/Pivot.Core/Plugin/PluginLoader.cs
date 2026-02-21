using System.Runtime.Loader;
using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Pivot.Plugin;


public class PluginLoader {
	private const int MaxDependencyLoadIterations = 10;

	public static IReadOnlyCollection<IPlugin> LoadFromReferencedAssemblies(
		WebApplicationBuilder builder,
		ILogger? logger = null
	) {
		// Get all currently loaded assemblies first
		Dictionary<string, Assembly> loadedAssemblies = GetFilteredAssemblies()
			.ToDictionary(a => a.GetName().FullName);

		// Force load the referenced assemblies from bin directory
		string? binPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
			?? throw new DirectoryNotFoundException("Could not find the bin directory.");

		// Only load assemblies that might contain plugins and aren't already loaded
		foreach (string path in Directory.GetFiles(binPath, "*.dll")) {
			// Skip system assemblies and already loaded ones
			string filename = Path.GetFileName(path);
			if (filename.StartsWith("System.", StringComparison.Ordinal) ||
				 filename.StartsWith("Microsoft.", StringComparison.Ordinal))
				continue;

			try {
				// Try to load the assembly if it's not already loaded
				AssemblyName assemblyName = AssemblyName.GetAssemblyName(path);
				if (!loadedAssemblies.ContainsKey(assemblyName.FullName)) {
					Assembly assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(path);
					loadedAssemblies[assemblyName.FullName] = assembly;
				}
			}
			catch (Exception ex) {
				logger?.LogWarning("Failed to load assembly {AssemblyPath}: {Message}", path, ex.Message);
			}
		}

		// Do a second pass to check for any new assemblies that were loaded as dependencies
		// This is necessary because some assemblies may load other assemblies as dependencies.
		// We do this repeatedly until no new assemblies are found.
		HashSet<string> loadedNames = [.. loadedAssemblies.Keys];
		int iteration = 0;
		for (; iteration < MaxDependencyLoadIterations; iteration++) {
			Assembly[] currentAssemblies = GetFilteredAssemblies().ToArray();
			List<Assembly> unloadedAssemblies = [
				.. currentAssemblies
				.Where(a => !loadedNames.Contains(a.GetName().FullName))
			];

			foreach (Assembly assembly in unloadedAssemblies)
				loadedNames.Add(assembly.GetName().FullName);

			if (unloadedAssemblies.Count == 0)
				break;
		}

		if (iteration >= MaxDependencyLoadIterations) {
			logger?.LogWarning("Dependency load iteration limit ({MaxIterations}) reached. Some plugin dependencies may not have been fully resolved.", MaxDependencyLoadIterations);
		}
		else {
			logger?.LogDebug("Dependency resolution completed in {IterationCount} iteration(s)", iteration);
		}

		// Get all loaded assemblies again (now including our newly loaded ones)
		Assembly[] assemblies = GetFilteredAssemblies().ToArray();

		List<IPlugin> plugins = [];

		foreach (Assembly assembly in assemblies) {
			try {
				// Find all types implementing IPlugin
				Type[] types;
				try {
					types = assembly.GetTypes();
				}
				catch (ReflectionTypeLoadException ex) {
					// Partial failure - use types that did load successfully
					types = ex.Types.Where(t => t is not null).ToArray()!;
					logger?.LogWarning("Assembly {AssemblyName} had type load failures, processing available types", assembly.FullName);
				}

				IEnumerable<Type> pluginTypes = types
					.Where(t => typeof(IPlugin)
						.IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract);

				foreach (Type pluginType in pluginTypes) {
					try {
						// Faster than Activator.CreateInstance for repeated calls
						ConstructorInfo? constructor = pluginType.GetConstructor(Type.EmptyTypes);
						if (constructor is not null) {
							IPlugin plugin = (IPlugin)constructor.Invoke(Array.Empty<object>());
							plugins.Add(plugin);

							logger?.LogInformation("Loading plugin: {PluginName}", plugin.Name);
						}
					}
					catch (Exception ex) {
						logger?.LogError(ex, "Failed to instantiate plugin {PluginType}", pluginType.FullName);
					}
				}
			}
			catch (Exception ex) {
				logger?.LogError(ex, "Error loading plugin from assembly {AssemblyName}", assembly.FullName);
			}
		}

		// Store for later configuration
		builder.Services.AddSingleton(plugins as IReadOnlyCollection<IPlugin>);

		return plugins;
	}

	public static IReadOnlyCollection<IPlugin> LoadFromDirectory(
		string directory,
		WebApplicationBuilder builder,
		ILogger? logger = null
	) {
		if (!Directory.Exists(directory)) {
			logger?.LogWarning("Plugin directory not found: {Directory}", directory);
			return Array.Empty<IPlugin>();
		}

		// Load manifests and resolve dependencies
		logger?.LogInformation("Loading plugin manifests from {Directory}", directory);
		List<PluginManifest> manifests;
		try {
			manifests = PluginDependencyResolver.LoadManifests(directory);
			logger?.LogInformation("Found {Count} plugin(s) with manifests", manifests.Count);
		}
		catch (Exception ex) {
			logger?.LogError(ex, "Failed to load plugin manifests");
			return Array.Empty<IPlugin>();
		}

		// Resolve load order
		List<PluginManifest> loadOrder;
		try {
			loadOrder = PluginDependencyResolver.ResolveLoadOrder(manifests);
			logger?.LogInformation("Plugin load order resolved: {Plugins}",
				string.Join(" → ", loadOrder.Select(m => m.Name)));
		}
		catch (Exception ex) {
			logger?.LogError(ex, "Failed to resolve plugin dependencies");
			return Array.Empty<IPlugin>();
		}

		// Detect package conflicts
		var conflicts = PluginDependencyResolver.DetectPackageConflicts(manifests);
		if (conflicts.Count > 0) {
			logger?.LogWarning("Detected {Count} third-party package conflict(s):", conflicts.Count);
			foreach (var conflict in conflicts) {
				var usageDetails = string.Join(", ", conflict.Usages.Select(u => $"{u.PluginName} needs {u.Version}"));
				logger?.LogWarning("  {PackageName}: {Details}", conflict.PackageName, usageDetails);
			}
			logger?.LogWarning("Plugins may fail at runtime due to version conflicts. First loaded version will be used.");
		}

		List<IPlugin> plugins = [];

		// Load plugins in dependency order - all in default context
		foreach (var manifest in loadOrder) {
			try {
				var assemblyPath = manifest.GetMainAssemblyPath();

				if (!File.Exists(assemblyPath)) {
					logger?.LogError("Plugin assembly not found: {Path}", assemblyPath);
					continue;
				}

				logger?.LogInformation("Loading plugin: {Name} v{Version}", manifest.Name, manifest.Version);

				// Load in default context
				var assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(assemblyPath);
				Type[] types;
				try {
					types = assembly.GetTypes();
				}
				catch (ReflectionTypeLoadException ex) {
					types = ex.Types.Where(t => t is not null).ToArray()!;
					logger?.LogWarning("Assembly {AssemblyName} had type load failures, processing available types",
						assembly.FullName);
				}

				var pluginTypes = types
					.Where(t => typeof(IPlugin).IsAssignableFrom(t)
						&& !t.IsInterface
						&& !t.IsAbstract);

				foreach (var pluginType in pluginTypes) {
					try {
						var constructor = pluginType.GetConstructor(Type.EmptyTypes);
						if (constructor is not null) {
							var plugin = (IPlugin)constructor.Invoke(Array.Empty<object>());
							plugins.Add(plugin);
							logger?.LogInformation("Initialized plugin: {PluginName}", plugin.Name);
						}
					}
					catch (Exception ex) {
						logger?.LogError(ex, "Failed to instantiate plugin {PluginType}", pluginType.FullName);
					}
				}
			}
			catch (Exception ex) {
				logger?.LogError(ex, "Failed to load plugin {PluginName}", manifest.Name);
			}
		}

		// Store for later configuration
		builder.Services.AddSingleton(plugins as IReadOnlyCollection<IPlugin>);

		return plugins;
	}

	protected static IEnumerable<Assembly> GetFilteredAssemblies() {
		IEnumerable<Assembly> assemblies = AppDomain.CurrentDomain.GetAssemblies()
			.Where(a => !a.IsDynamic
				&& !(a.FullName?.StartsWith("System.", StringComparison.Ordinal) ?? false)
				&& !(a.FullName?.StartsWith("Microsoft.", StringComparison.Ordinal) ?? false));

		return assemblies;
	}
}
