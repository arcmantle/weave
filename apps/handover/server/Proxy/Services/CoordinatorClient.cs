using System.Text.Json;
using System.Text.Json.Serialization;
using Proxy.Models;
using Yarp.ReverseProxy.Configuration;


namespace Proxy.Services;

[JsonSerializable(typeof(List<BackendInfo>))]
internal partial class BackendJsonContext : JsonSerializerContext { }


public class CoordinatorClient : BackgroundService {
	private readonly ILogger<CoordinatorClient> _logger;
	private readonly HttpClient _httpClient;
	private readonly IProxyConfigProvider _proxyConfigProvider;
	private readonly string _coordinatorUrl;
	private readonly List<RouteConfig> _routes;

	public CoordinatorClient(
		ILogger<CoordinatorClient> logger,
		IConfiguration config,
		IProxyConfigProvider proxyConfigProvider
	) {
		_logger = logger;
		_httpClient = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
		_proxyConfigProvider = proxyConfigProvider;
		_coordinatorUrl = config.GetValue<string>("CoordinatorUrl") ?? "http://localhost:5100";

		// Define the routes once
		_routes = [
			new RouteConfig {
				RouteId = "default-route",
				ClusterId = "backend-cluster",
				Match = new RouteMatch { Path = "{**catch-all}" }
			}
		];
	}

	protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
		_logger.LogInformation("Connecting to coordinator at {Url}", _coordinatorUrl);

		while (!stoppingToken.IsCancellationRequested) {
			try {
				await using var stream = await _httpClient.GetStreamAsync(
					$"{_coordinatorUrl}/backends/stream",
					stoppingToken
				);

				using var reader = new StreamReader(stream);

				_logger.LogInformation("Connected to coordinator SSE stream");

				while (!stoppingToken.IsCancellationRequested) {
					var line = await reader.ReadLineAsync(stoppingToken);

					if (line == null) {
						_logger.LogWarning("Coordinator stream ended");
						break;
					}

					if (line.StartsWith("data: ")) {
						var json = line[6..]; // Remove "data: " prefix
						try {
							var backends = JsonSerializer.Deserialize(json, BackendJsonContext.Default.ListBackendInfo);
							if (backends != null) {
								UpdateProxyConfiguration(backends);
							}
						}
						catch (JsonException ex) {
							_logger.LogError(ex, "Failed to parse backend update");
						}
					}
				}
			}
			catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) {
				// Graceful shutdown
				break;
			}
			catch (Exception ex) {
				_logger.LogError(ex, "Lost connection to coordinator, reconnecting in 2s...");
				await Task.Delay(2000, stoppingToken);
			}
		}

		_logger.LogInformation("Coordinator client stopped");
	}

	private void UpdateProxyConfiguration(List<BackendInfo> backends) {
		if (backends.Count == 0) {
			_logger.LogWarning("No backends available");
			return;
		}

		var destinations = backends.ToDictionary(
			b => $"backend-{b.Port}",
			b => new DestinationConfig { Address = b.Address }
		);

		var clusters = new[] {
			new ClusterConfig {
				ClusterId = "backend-cluster",
				Destinations = destinations,
				HealthCheck = new HealthCheckConfig {
					Active = new ActiveHealthCheckConfig {
						Enabled = true,
						Interval = TimeSpan.FromSeconds(5),
						Timeout = TimeSpan.FromSeconds(2),
						Path = "/health"
					}
				}
			}
		};

		((InMemoryConfigProvider)_proxyConfigProvider).Update(_routes, clusters);

		_logger.LogInformation(
			"Updated proxy configuration with {Count} backend(s): {Backends}",
			backends.Count,
			string.Join(", ", backends.Select(b => $"port {b.Port}"))
		);
	}
}
