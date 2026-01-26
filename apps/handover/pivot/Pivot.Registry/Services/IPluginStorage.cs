namespace Pivot.Registry.Services;

public interface IPluginStorage {
	Task InitializeAsync();
	Task UploadAsync(string name, string version, Stream content, CancellationToken cancellationToken = default);
	Task<Stream> DownloadAsync(string name, string version, CancellationToken cancellationToken = default);
	Task<bool> ExistsAsync(string name, string version, CancellationToken cancellationToken = default);
	Task DeleteAsync(string name, string version, CancellationToken cancellationToken = default);
	string GetStorageKey(string name, string version);
}
