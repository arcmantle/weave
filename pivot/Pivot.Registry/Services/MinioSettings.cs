namespace Pivot.Registry.Services;

public class MinioSettings {
	public string Endpoint { get; set; } = "localhost:9000";
	public string AccessKey { get; set; } = "minioadmin";
	public string SecretKey { get; set; } = "minioadmin";
	public bool UseSsl { get; set; } = false;
	public string BucketName { get; set; } = "pivot-plugins";
}
