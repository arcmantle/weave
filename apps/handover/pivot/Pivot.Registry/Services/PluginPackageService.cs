using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pivot.Registry.Data;
using Pivot.Registry.Models;

namespace Pivot.Registry.Services;

public class PluginPackageService {
	private readonly RegistryDbContext _dbContext;
	private readonly IPluginStorage _storage;
	private readonly PluginValidationService _validation;
	private readonly ILogger<PluginPackageService> _logger;

	public PluginPackageService(
		 RegistryDbContext dbContext,
		 IPluginStorage storage,
		 PluginValidationService validation,
		 ILogger<PluginPackageService> logger) {
		_dbContext = dbContext;
		_storage = storage;
		_validation = validation;
		_logger = logger;
	}

	public async Task<(bool Success, string? Error, int? PluginVersionId)> UploadPackageAsync(
		 Stream packageStream,
		 CancellationToken cancellationToken = default) {
		// Validate package
		var validationResult = await _validation.ValidatePackageAsync(packageStream, cancellationToken);

		if (!validationResult.IsValid) {
			return (false, string.Join("; ", validationResult.Errors), null);
		}

		var manifest = validationResult.Manifest!;

		// Check if this version already exists
		var existingVersion = await _dbContext.PluginVersions
			 .Include(pv => pv.Plugin)
			 .FirstOrDefaultAsync(pv => pv.Plugin.Name == manifest.Name && pv.Version == manifest.Version, cancellationToken);

		if (existingVersion != null) {
			return (false, $"Plugin {manifest.Name} version {manifest.Version} already exists", null);
		}

		// Get or create plugin
		var plugin = await _dbContext.Plugins
			 .FirstOrDefaultAsync(p => p.Name == manifest.Name, cancellationToken);

		if (plugin == null) {
			plugin = new Models.Plugin {
				Name = manifest.Name,
				Description = manifest.Description,
				Author = manifest.Author,
				Tags = manifest.Tags != null ? string.Join(",", manifest.Tags) : null
			};
			_dbContext.Plugins.Add(plugin);
			await _dbContext.SaveChangesAsync(cancellationToken);
		}
		else {
			// Update plugin metadata if provided
			if (!string.IsNullOrWhiteSpace(manifest.Description))
				plugin.Description = manifest.Description;
			if (!string.IsNullOrWhiteSpace(manifest.Author))
				plugin.Author = manifest.Author;
			if (manifest.Tags != null && manifest.Tags.Count > 0)
				plugin.Tags = string.Join(",", manifest.Tags);
		}

		// Store package in storage
		packageStream.Position = 0;
		await _storage.UploadAsync(manifest.Name, manifest.Version, packageStream, cancellationToken);

		// Create plugin version entry
		var pluginVersion = new PluginVersion {
			PluginId = plugin.Id,
			Version = manifest.Version,
			ManifestJson = JsonSerializer.Serialize(manifest),
			StorageKey = _storage.GetStorageKey(manifest.Name, manifest.Version),
			FileSize = validationResult.PackageSize
		};

		_dbContext.PluginVersions.Add(pluginVersion);
		await _dbContext.SaveChangesAsync(cancellationToken);

		// Add dependencies
		foreach (var dep in manifest.PluginDependencies) {
			_dbContext.PluginDependencies.Add(new PluginDependency {
				PluginVersionId = pluginVersion.Id,
				DependencyName = dep.Key,
				VersionRange = dep.Value
			});
		}

		await _dbContext.SaveChangesAsync(cancellationToken);

		_logger.LogInformation("Successfully uploaded plugin: {Name} v{Version}", manifest.Name, manifest.Version);
		return (true, null, pluginVersion.Id);
	}

	public async Task<bool> DeleteVersionAsync(string name, string version, CancellationToken cancellationToken = default) {
		var pluginVersion = await _dbContext.PluginVersions
			 .Include(pv => pv.Plugin)
			 .FirstOrDefaultAsync(pv => pv.Plugin.Name == name && pv.Version == version, cancellationToken);

		if (pluginVersion == null) {
			return false;
		}

		// Delete from storage
		await _storage.DeleteAsync(name, version, cancellationToken);

		// Delete from database
		_dbContext.PluginVersions.Remove(pluginVersion);
		await _dbContext.SaveChangesAsync(cancellationToken);

		_logger.LogInformation("Deleted plugin version: {Name} v{Version}", name, version);
		return true;
	}

	public async Task<Stream?> GetPackageStreamAsync(string name, string version, CancellationToken cancellationToken = default) {
		var pluginVersion = await _dbContext.PluginVersions
			 .Include(pv => pv.Plugin)
			 .FirstOrDefaultAsync(pv => pv.Plugin.Name == name && pv.Version == version, cancellationToken);

		if (pluginVersion == null) {
			return null;
		}

		// Increment download count
		pluginVersion.DownloadCount++;
		await _dbContext.SaveChangesAsync(cancellationToken);

		return await _storage.DownloadAsync(name, version, cancellationToken);
	}
}
