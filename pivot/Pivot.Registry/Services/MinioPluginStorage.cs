using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;

namespace Pivot.Registry.Services;

public class MinioPluginStorage : IPluginStorage {
	private readonly MinioSettings _settings;
	private readonly ILogger<MinioPluginStorage> _logger;
	private readonly IMinioClient _minioClient;

	public MinioPluginStorage(
		 IOptions<MinioSettings> settings,
		 ILogger<MinioPluginStorage> logger) {
		_settings = settings.Value;
		_logger = logger;

		var endpointParts = _settings.Endpoint.Split(':');
		var endpoint = endpointParts[0];
		var port = endpointParts.Length > 1 ? int.Parse(endpointParts[1]) : 9000;

		_minioClient = new MinioClient()
			 .WithEndpoint(endpoint, port)
			 .WithCredentials(_settings.AccessKey, _settings.SecretKey)
			 .WithSSL(_settings.UseSsl)
			 .Build();
	}

	public async Task InitializeAsync() {
		var beArgs = new BucketExistsArgs().WithBucket(_settings.BucketName);
		var bucketExists = await _minioClient.BucketExistsAsync(beArgs);

		if (!bucketExists) {
			var mbArgs = new MakeBucketArgs().WithBucket(_settings.BucketName);
			await _minioClient.MakeBucketAsync(mbArgs);
			_logger.LogInformation("Created MinIO bucket: {BucketName}", _settings.BucketName);
		}
		else {
			_logger.LogInformation("MinIO bucket already exists: {BucketName}", _settings.BucketName);
		}
	}

	public string GetStorageKey(string name, string version) {
		return $"plugins/{name}/{version}.pivotpkg";
	}

	public async Task UploadAsync(string name, string version, Stream content, CancellationToken cancellationToken = default) {
		var objectName = GetStorageKey(name, version);
		var fileSize = content.Length;

		var putArgs = new PutObjectArgs()
			 .WithBucket(_settings.BucketName)
			 .WithObject(objectName)
			 .WithStreamData(content)
			 .WithObjectSize(fileSize)
			 .WithContentType("application/zip");

		await _minioClient.PutObjectAsync(putArgs, cancellationToken);

		_logger.LogInformation("Uploaded plugin package to MinIO: {Name} v{Version}", name, version);
	}

	public async Task<Stream> DownloadAsync(string name, string version, CancellationToken cancellationToken = default) {
		var objectName = GetStorageKey(name, version);
		var memoryStream = new MemoryStream();

		var getArgs = new GetObjectArgs()
			 .WithBucket(_settings.BucketName)
			 .WithObject(objectName)
			 .WithCallbackStream(async (stream, ct) => {
				 await stream.CopyToAsync(memoryStream, ct);
				 memoryStream.Position = 0;
			 });

		await _minioClient.GetObjectAsync(getArgs, cancellationToken);

		return memoryStream;
	}

	public async Task<bool> ExistsAsync(string name, string version, CancellationToken cancellationToken = default) {
		try {
			var objectName = GetStorageKey(name, version);
			var statArgs = new StatObjectArgs()
				 .WithBucket(_settings.BucketName)
				 .WithObject(objectName);

			await _minioClient.StatObjectAsync(statArgs, cancellationToken);
			return true;
		}
		catch (Exception) {
			return false;
		}
	}

	public async Task DeleteAsync(string name, string version, CancellationToken cancellationToken = default) {
		var objectName = GetStorageKey(name, version);

		var removeArgs = new RemoveObjectArgs()
			 .WithBucket(_settings.BucketName)
			 .WithObject(objectName);

		await _minioClient.RemoveObjectAsync(removeArgs, cancellationToken);

		_logger.LogInformation("Deleted plugin package from MinIO: {Name} v{Version}", name, version);
	}
}
