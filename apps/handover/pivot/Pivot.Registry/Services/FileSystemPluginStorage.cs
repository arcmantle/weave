using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Pivot.Registry.Services;

public class FileSystemPluginStorage : IPluginStorage {
	private readonly FileSystemStorageSettings _settings;
	private readonly ILogger<FileSystemPluginStorage> _logger;

	public FileSystemPluginStorage(
		 IOptions<FileSystemStorageSettings> settings,
		 ILogger<FileSystemPluginStorage> logger) {
		_settings = settings.Value;
		_logger = logger;
	}

	public Task InitializeAsync() {
		Directory.CreateDirectory(_settings.BasePath);
		_logger.LogInformation("FileSystem storage initialized at: {BasePath}", _settings.BasePath);
		return Task.CompletedTask;
	}

	public string GetStorageKey(string name, string version) {
		return Path.Combine(name, $"{version}.pivotpkg");
	}

	private string GetFullPath(string name, string version) {
		var storageKey = GetStorageKey(name, version);
		return Path.Combine(_settings.BasePath, storageKey);
	}

	public async Task UploadAsync(string name, string version, Stream content, CancellationToken cancellationToken = default) {
		var fullPath = GetFullPath(name, version);
		var directory = Path.GetDirectoryName(fullPath);

		if (!string.IsNullOrEmpty(directory)) {
			Directory.CreateDirectory(directory);
		}

		await using var fileStream = File.Create(fullPath);
		await content.CopyToAsync(fileStream, cancellationToken);

		_logger.LogInformation("Uploaded plugin package: {Name} v{Version} to {Path}", name, version, fullPath);
	}

	public Task<Stream> DownloadAsync(string name, string version, CancellationToken cancellationToken = default) {
		var fullPath = GetFullPath(name, version);

		if (!File.Exists(fullPath)) {
			throw new FileNotFoundException($"Plugin package not found: {name} v{version}");
		}

		Stream stream = File.OpenRead(fullPath);
		return Task.FromResult(stream);
	}

	public Task<bool> ExistsAsync(string name, string version, CancellationToken cancellationToken = default) {
		var fullPath = GetFullPath(name, version);
		return Task.FromResult(File.Exists(fullPath));
	}

	public Task DeleteAsync(string name, string version, CancellationToken cancellationToken = default) {
		var fullPath = GetFullPath(name, version);

		if (File.Exists(fullPath)) {
			File.Delete(fullPath);
			_logger.LogInformation("Deleted plugin package: {Name} v{Version}", name, version);
		}

		return Task.CompletedTask;
	}
}
