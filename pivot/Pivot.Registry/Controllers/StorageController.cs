using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Pivot.Registry.Data;
using Pivot.Registry.Services;

namespace Pivot.Registry.Controllers;

[ApiController]
[Route("api/storage")]
[Authorize(Policy = "RegistryWrite")]
public class StorageController : ControllerBase {
	private readonly RegistryDbContext _dbContext;
	private readonly IServiceProvider _serviceProvider;
	private readonly ILogger<StorageController> _logger;

	public StorageController(
		 RegistryDbContext dbContext,
		 IServiceProvider serviceProvider,
		 ILogger<StorageController> logger) {
		_dbContext = dbContext;
		_serviceProvider = serviceProvider;
		_logger = logger;
	}

	[HttpPost("migrate")]
	public async Task<IActionResult> MigrateStorage(
		 [FromQuery] string from,
		 [FromQuery] string to) {
		if (string.IsNullOrWhiteSpace(from) || string.IsNullOrWhiteSpace(to)) {
			return BadRequest(new { Error = "Both 'from' and 'to' parameters are required" });
		}

		if (from.Equals(to, StringComparison.OrdinalIgnoreCase)) {
			return BadRequest(new { Error = "Source and destination storage must be different" });
		}

		try {
			IPluginStorage? sourceStorage = null;
			IPluginStorage? destStorage = null;

			// Create storage instances based on type
			if (from.Equals("FileSystem", StringComparison.OrdinalIgnoreCase)) {
				sourceStorage = _serviceProvider.GetService<FileSystemPluginStorage>();
				if (sourceStorage == null) {
					sourceStorage = new FileSystemPluginStorage(
						 Microsoft.Extensions.Options.Options.Create(new FileSystemStorageSettings()),
						 _serviceProvider.GetRequiredService<ILogger<FileSystemPluginStorage>>());
				}
			}
			else if (from.Equals("MinIO", StringComparison.OrdinalIgnoreCase)) {
				sourceStorage = _serviceProvider.GetService<MinioPluginStorage>();
				if (sourceStorage == null) {
					return BadRequest(new { Error = "MinIO storage not configured" });
				}
			}

			if (to.Equals("FileSystem", StringComparison.OrdinalIgnoreCase)) {
				destStorage = _serviceProvider.GetService<FileSystemPluginStorage>();
				if (destStorage == null) {
					destStorage = new FileSystemPluginStorage(
						 Microsoft.Extensions.Options.Options.Create(new FileSystemStorageSettings()),
						 _serviceProvider.GetRequiredService<ILogger<FileSystemPluginStorage>>());
				}
			}
			else if (to.Equals("MinIO", StringComparison.OrdinalIgnoreCase)) {
				destStorage = _serviceProvider.GetService<MinioPluginStorage>();
				if (destStorage == null) {
					return BadRequest(new { Error = "MinIO storage not configured" });
				}
			}

			if (sourceStorage == null || destStorage == null) {
				return BadRequest(new { Error = "Invalid storage provider specified" });
			}

			await destStorage.InitializeAsync();

			// Get all plugin versions
			var pluginVersions = await _dbContext.PluginVersions
				 .Include(pv => pv.Plugin)
				 .ToListAsync();

			var migratedCount = 0;
			var errors = new List<string>();

			foreach (var pluginVersion in pluginVersions) {
				try {
					var name = pluginVersion.Plugin.Name;
					var version = pluginVersion.Version;

					// Check if already exists in destination
					if (await destStorage.ExistsAsync(name, version)) {
						_logger.LogInformation("Skipping {Name} v{Version} - already exists in destination", name, version);
						continue;
					}

					// Download from source
					await using var stream = await sourceStorage.DownloadAsync(name, version);

					// Upload to destination
					stream.Position = 0;
					await destStorage.UploadAsync(name, version, stream);

					// Update storage key in database
					pluginVersion.StorageKey = destStorage.GetStorageKey(name, version);
					migratedCount++;

					_logger.LogInformation("Migrated {Name} v{Version}", name, version);
				}
				catch (Exception ex) {
					_logger.LogError(ex, "Error migrating {Name} v{Version}",
						 pluginVersion.Plugin.Name, pluginVersion.Version);
					errors.Add($"{pluginVersion.Plugin.Name} v{pluginVersion.Version}: {ex.Message}");
				}
			}

			await _dbContext.SaveChangesAsync();

			return Ok(new {
				Message = $"Migration completed",
				MigratedCount = migratedCount,
				TotalCount = pluginVersions.Count,
				Errors = errors
			});
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Error during storage migration");
			return StatusCode(500, new { Error = "Internal server error during migration" });
		}
	}

	[HttpGet("info")]
	public IActionResult GetStorageInfo() {
		var currentStorage = _serviceProvider.GetRequiredService<IPluginStorage>();
		var storageType = currentStorage.GetType().Name;

		return Ok(new {
			CurrentStorage = storageType.Replace("PluginStorage", ""),
			AvailableProviders = new[] { "FileSystem", "MinIO" }
		});
	}
}
