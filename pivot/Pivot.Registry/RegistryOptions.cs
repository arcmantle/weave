using System.Text.Json.Serialization;

namespace Pivot.Registry;


/// <summary>
/// Controls whether the registry requires authentication for read operations.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum RegistryAccessMode {
	/// <summary>
	/// Browse and download are open to everyone. Upload, delete, and storage
	/// management still require authentication.
	/// </summary>
	Public,

	/// <summary>
	/// All operations require authentication (default).
	/// </summary>
	Private,
}

/// <summary>
/// Configuration options for the Pivot Registry
/// </summary>
public class RegistryOptions {
	/// <summary>
	/// Whether the registry is enabled
	/// </summary>
	public bool Enabled { get; set; } = true;

	/// <summary>
	/// Access mode: "Public" allows unauthenticated browsing/downloading,
	/// "Private" requires authentication for all operations.
	/// </summary>
	public RegistryAccessMode AccessMode { get; set; } = RegistryAccessMode.Private;

	/// <summary>
	/// Application name for data directory isolation
	/// </summary>
	public string ApplicationName { get; set; } = "Pivot.Registry";

	/// <summary>
	/// Database connection string (if empty, uses cross-platform app data directory)
	/// </summary>
	public string? ConnectionString { get; set; }

	/// <summary>
	/// Storage provider: "FileSystem" or "MinIO"
	/// </summary>
	public string StorageProvider { get; set; } = "FileSystem";

	/// <summary>
	/// Base path for FileSystem storage (if empty, uses cross-platform app data directory)
	/// </summary>
	public string? FileSystemBasePath { get; set; }

	/// <summary>
	/// MinIO endpoint
	/// </summary>
	public string? MinioEndpoint { get; set; }

	/// <summary>
	/// MinIO access key
	/// </summary>
	public string? MinioAccessKey { get; set; }

	/// <summary>
	/// MinIO secret key
	/// </summary>
	public string? MinioSecretKey { get; set; }

	/// <summary>
	/// MinIO use SSL
	/// </summary>
	public bool MinioUseSsl { get; set; } = false;

	/// <summary>
	/// MinIO bucket name
	/// </summary>
	public string MinioBucketName { get; set; } = "pivot-plugins";
}
