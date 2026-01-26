using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pivot.Registry.Data;
using Pivot.Registry.Services;
using System.Text.Json;
using Pivot.Plugin;

namespace Pivot.Registry.Controllers;

[ApiController]
[Route("api/plugins")]
public class PluginsController : ControllerBase {
	private readonly RegistryDbContext _dbContext;
	private readonly PluginPackageService _packageService;
	private readonly ILogger<PluginsController> _logger;

	public PluginsController(
		 RegistryDbContext dbContext,
		 PluginPackageService packageService,
		 ILogger<PluginsController> logger) {
		_dbContext = dbContext;
		_packageService = packageService;
		_logger = logger;
	}

	[HttpGet]
	public async Task<IActionResult> GetPlugins(
		 [FromQuery] string? search = null,
		 [FromQuery] string? tag = null,
		 [FromQuery] int page = 1,
		 [FromQuery] int pageSize = 20) {
		var query = _dbContext.Plugins
			 .Include(p => p.Versions)
			 .AsQueryable();

		if (!string.IsNullOrWhiteSpace(search)) {
			query = query.Where(p =>
				 p.Name.Contains(search) ||
				 (p.Description != null && p.Description.Contains(search)));
		}

		if (!string.IsNullOrWhiteSpace(tag)) {
			query = query.Where(p => p.Tags != null && p.Tags.Contains(tag));
		}

		var total = await query.CountAsync();
		var plugins = await query
			 .OrderBy(p => p.Name)
			 .Skip((page - 1) * pageSize)
			 .Take(pageSize)
			 .Select(p => new {
				 p.Id,
				 p.Name,
				 p.Description,
				 p.Author,
				 Tags = p.Tags != null ? p.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries) : Array.Empty<string>(),
				 p.CreatedAt,
				 VersionCount = p.Versions.Count,
				 LatestVersion = p.Versions.OrderByDescending(v => v.UploadedAt).FirstOrDefault() != null
						? p.Versions.OrderByDescending(v => v.UploadedAt).First().Version
						: null,
				 TotalDownloads = p.Versions.Sum(v => v.DownloadCount)
			 })
			 .ToListAsync();

		return Ok(new {
			Plugins = plugins,
			Total = total,
			Page = page,
			PageSize = pageSize,
			TotalPages = (int)Math.Ceiling(total / (double)pageSize)
		});
	}

	[HttpGet("{name}")]
	public async Task<IActionResult> GetPlugin(string name) {
		var plugin = await _dbContext.Plugins
			 .Include(p => p.Versions)
				  .ThenInclude(v => v.Dependencies)
			 .FirstOrDefaultAsync(p => p.Name == name);

		if (plugin == null) {
			return NotFound(new { Error = $"Plugin '{name}' not found" });
		}

		return Ok(new {
			plugin.Id,
			plugin.Name,
			plugin.Description,
			plugin.Author,
			Tags = plugin.Tags != null ? plugin.Tags.Split(',', StringSplitOptions.RemoveEmptyEntries) : Array.Empty<string>(),
			plugin.CreatedAt,
			Versions = plugin.Versions.OrderByDescending(v => v.UploadedAt).Select(v => new {
				v.Id,
				v.Version,
				v.FileSize,
				v.DownloadCount,
				v.UploadedAt,
				Dependencies = v.Dependencies.Select(d => new {
					d.DependencyName,
					d.VersionRange
				}).ToList()
			}).ToList()
		});
	}

	[HttpGet("{name}/versions/{version}")]
	public async Task<IActionResult> GetPluginVersion(string name, string version) {
		var pluginVersion = await _dbContext.PluginVersions
			 .Include(pv => pv.Plugin)
			 .Include(pv => pv.Dependencies)
			 .FirstOrDefaultAsync(pv => pv.Plugin.Name == name && pv.Version == version);

		if (pluginVersion == null) {
			return NotFound(new { Error = $"Plugin '{name}' version '{version}' not found" });
		}

		var manifest = JsonSerializer.Deserialize<PluginManifest>(pluginVersion.ManifestJson);

		return Ok(new {
			pluginVersion.Id,
			Plugin = new {
				pluginVersion.Plugin.Name,
				pluginVersion.Plugin.Description,
				pluginVersion.Plugin.Author
			},
			pluginVersion.Version,
			Manifest = manifest,
			pluginVersion.FileSize,
			pluginVersion.DownloadCount,
			pluginVersion.UploadedAt,
			Dependencies = pluginVersion.Dependencies.Select(d => new {
				d.DependencyName,
				d.VersionRange
			}).ToList()
		});
	}

	[HttpPost("upload")]
	[RequestSizeLimit(104857600)] // 100MB max
	public async Task<IActionResult> UploadPlugin(IFormFile file) {
		if (file == null || file.Length == 0) {
			return BadRequest(new { Error = "No file uploaded" });
		}

		if (!file.FileName.EndsWith(".pivotpkg")) {
			return BadRequest(new { Error = "File must be a .pivotpkg file" });
		}

		try {
			await using var stream = file.OpenReadStream();
			var (success, error, pluginVersionId) = await _packageService.UploadPackageAsync(stream);

			if (!success) {
				return BadRequest(new { Error = error });
			}

			var pluginVersion = await _dbContext.PluginVersions
				 .Include(pv => pv.Plugin)
				 .FirstOrDefaultAsync(pv => pv.Id == pluginVersionId);

			return Ok(new {
				Message = "Plugin uploaded successfully",
				Plugin = pluginVersion!.Plugin.Name,
				Version = pluginVersion.Version,
				Id = pluginVersionId
			});
		}
		catch (Exception ex) {
			_logger.LogError(ex, "Error uploading plugin");
			return StatusCode(500, new { Error = "Internal server error during upload" });
		}
	}

	[HttpGet("{name}/versions/{version}/download")]
	public async Task<IActionResult> DownloadPlugin(string name, string version) {
		var stream = await _packageService.GetPackageStreamAsync(name, version);

		if (stream == null) {
			return NotFound(new { Error = $"Plugin '{name}' version '{version}' not found" });
		}

		return File(stream, "application/zip", $"{name}-{version}.pivotpkg");
	}

	[HttpDelete("{name}/versions/{version}")]
	public async Task<IActionResult> DeletePluginVersion(string name, string version) {
		var deleted = await _packageService.DeleteVersionAsync(name, version);

		if (!deleted) {
			return NotFound(new { Error = $"Plugin '{name}' version '{version}' not found" });
		}

		return Ok(new { Message = $"Plugin '{name}' version '{version}' deleted successfully" });
	}

	[HttpGet("tags")]
	public async Task<IActionResult> GetTags() {
		var tags = await _dbContext.Plugins
			 .Where(p => p.Tags != null)
			 .Select(p => p.Tags!)
			 .ToListAsync();

		var allTags = tags
			 .SelectMany(t => t.Split(',', StringSplitOptions.RemoveEmptyEntries))
			 .Select(t => t.Trim())
			 .Distinct()
			 .OrderBy(t => t)
			 .ToList();

		return Ok(allTags);
	}
}
