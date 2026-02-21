namespace Pivot.Registry.Models;

public class Plugin {
	public int Id { get; set; }
	public required string Name { get; set; }
	public string? Description { get; set; }
	public string? Author { get; set; }
	public string? Tags { get; set; } // Comma-separated tags
	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	public ICollection<PluginVersion> Versions { get; set; } = new List<PluginVersion>();
}

public class PluginVersion {
	public int Id { get; set; }
	public int PluginId { get; set; }
	public required string Version { get; set; }
	public required string ManifestJson { get; set; }
	public required string StorageKey { get; set; }
	public long FileSize { get; set; }
	public int DownloadCount { get; set; }
	public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

	public Plugin Plugin { get; set; } = null!;
	public ICollection<PluginDependency> Dependencies { get; set; } = new List<PluginDependency>();
}

public class PluginDependency {
	public int Id { get; set; }
	public int PluginVersionId { get; set; }
	public required string DependencyName { get; set; }
	public required string VersionRange { get; set; }

	public PluginVersion PluginVersion { get; set; } = null!;
}
