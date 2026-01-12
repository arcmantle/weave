using System.Runtime.Loader;
using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Pivot.Plugin;


public class PluginLoader
{

	public static IReadOnlyCollection<IPlugin> LoadFromReferencedAssemblies(
		WebApplicationBuilder builder,
		ILogger? logger = null
	)
	{
		// Get all currently loaded assemblies first
		Dictionary<string, Assembly> loadedAssemblies = GetFilteredAssemblies()
			.ToDictionary(a => a.GetName().FullName);

		// Force load the referenced assemblies from bin directory
		string? binPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
			?? throw new DirectoryNotFoundException("Could not find the bin directory.");

		// Only load assemblies that might contain plugins and aren't already loaded
		foreach (string path in Directory.GetFiles(binPath, "*.dll"))
		{
			// Skip system assemblies and already loaded ones
			string filename = Path.GetFileName(path);
			if (filename.StartsWith("System.", StringComparison.Ordinal) ||
				 filename.StartsWith("Microsoft.", StringComparison.Ordinal))
				continue;

			try
			{
				// Try to load the assembly if it's not already loaded
				AssemblyName assemblyName = AssemblyName.GetAssemblyName(path);
				if (!loadedAssemblies.ContainsKey(assemblyName.FullName))
				{
					Assembly assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(path);
					loadedAssemblies[assemblyName.FullName] = assembly;
				}
			}
			// Silently ignore assemblies that can't be loaded
			catch (Exception) { }
		}

		// Do a second pass to check for any new assemblies that were loaded as dependencies
		// This is necessary because some assemblies may load other assemblies as dependencies.
		// We do this repeatedly until no new assemblies are found.
		HashSet<string> loadedNames = [.. loadedAssemblies.Keys];
		while (true)
		{
			List<Assembly> unloadedAssemblies = [
				.. GetFilteredAssemblies()
				.Where(a => !loadedNames.Contains(a.GetName().FullName))
			];

			foreach (Assembly assembly in unloadedAssemblies)
				loadedNames.Add(assembly.GetName().FullName);

			if (unloadedAssemblies.Count == 0)
				break;
		}

		// Get all loaded assemblies again (now including our newly loaded ones)
		IEnumerable<Assembly> assemblies = GetFilteredAssemblies();

		List<IPlugin> plugins = [];

		foreach (Assembly assembly in assemblies)
		{
			try
			{
				// Find all types implementing IPlugin
				IEnumerable<Type> pluginTypes = assembly
					.GetTypes()
					.Where(t => typeof(IPlugin)
						.IsAssignableFrom(t) && !t.IsInterface && !t.IsAbstract);

				foreach (Type pluginType in pluginTypes)
				{
					try
					{
						// Faster than Activator.CreateInstance for repeated calls
						ConstructorInfo? constructor = pluginType.GetConstructor(Type.EmptyTypes);
						if (constructor is not null)
						{
							IPlugin plugin = (IPlugin)constructor.Invoke(null);
							plugins.Add(plugin);

							logger?.LogInformation("Loading plugin: {PluginName}", plugin.Name);
						}
					}
					catch (Exception ex)
					{
						logger?.LogError(ex, "Failed to instantiate plugin {PluginType}", pluginType.FullName);
					}
				}
			}
			catch (Exception ex)
			{
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
	)
	{
		if (!Directory.Exists(directory))
		{
			logger?.LogWarning("Plugin directory not found: {Directory}", directory);
			return Array.Empty<IPlugin>();
		}

		List<IPlugin> plugins = [];

		foreach (string dllPath in Directory.GetFiles(directory, "*.dll"))
		{
			try
			{
				// Load assembly from file (shared context, no isolation)
				Assembly assembly = Assembly.LoadFrom(dllPath);

				// Find IPlugin implementations
				var pluginTypes = assembly
					.GetTypes()
					.Where(t => typeof(IPlugin).IsAssignableFrom(t)
						&& !t.IsInterface
						&& !t.IsAbstract);

				foreach (var pluginType in pluginTypes)
				{
					try
					{
						var constructor = pluginType.GetConstructor(Type.EmptyTypes);
						if (constructor is not null)
						{
							var plugin = (IPlugin)constructor.Invoke(null);
							plugins.Add(plugin);
							logger?.LogInformation("Loading plugin: {PluginName} from {FileName}",
								plugin.Name, Path.GetFileName(dllPath));
						}
					}
					catch (Exception ex)
					{
						logger?.LogError(ex, "Failed to instantiate plugin {PluginType}", pluginType.FullName);
					}
				}
			}
			catch (Exception ex)
			{
				logger?.LogError(ex, "Failed to load assembly {DllPath}", dllPath);
			}
		}

		// Store for later configuration
		builder.Services.AddSingleton(plugins as IReadOnlyCollection<IPlugin>);

		return plugins;
	}

	protected static IEnumerable<Assembly> GetFilteredAssemblies()
	{
		IEnumerable<Assembly> assemblies = AppDomain.CurrentDomain.GetAssemblies()
			.Where(a => !a.IsDynamic
				&& !(a.FullName?.StartsWith("System.", StringComparison.Ordinal) ?? false)
				&& !(a.FullName?.StartsWith("Microsoft.", StringComparison.Ordinal) ?? false));

		return assemblies;
	}
}
