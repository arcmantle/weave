using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Pivot.Orchestration.Models;
using Yarp.ReverseProxy.Configuration;


namespace Pivot.Proxy.Services;

[JsonSerializable(typeof(List<BackendInfo>))]
internal partial class BackendJsonContext : JsonSerializerContext { }


public class CoordinatorClient : BackgroundService
{
	private static readonly ActivitySource ActivitySource = new("Pivot.Proxy");

	private readonly ILogger<CoordinatorClient> _logger;
	private readonly HttpClient _httpClient;
	private readonly IProxyConfigProvider _proxyConfigProvider;
	private readonly PivotProxyOptions _options;
	private readonly List<RouteConfig> _routes;

	public CoordinatorClient(
		ILogger<CoordinatorClient> logger,
		PivotProxyOptions options,
		IProxyConfigProvider proxyConfigProvider
	)
	{
		_logger = logger;
		_httpClient = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
		_proxyConfigProvider = proxyConfigProvider;
		_options = options;

		// Define the routes once
		_routes = [
			new RouteConfig {
				RouteId = "default-route",
				ClusterId = "backend-cluster",
				Match = new RouteMatch { Path = "{**catch-all}" }
			}
		];
	}

	protected override async Task ExecuteAsync(CancellationToken stoppingToken)
	{
		using var activity = ActivitySource.StartActivity("CoordinatorConnection");
		activity?.SetTag("coordinator.url", _options.CoordinatorUrl);

		_logger.LogInformation("Connecting to coordinator at {Url}", _options.CoordinatorUrl);

		while (!stoppingToken.IsCancellationRequested)
		{
			try
			{
				activity?.AddEvent(new ActivityEvent("ConnectionAttempt"));

				await using var stream = await _httpClient.GetStreamAsync(
					$"{_options.CoordinatorUrl}/backends/stream",
					stoppingToken
				);

				using var reader = new StreamReader(stream);

				_logger.LogInformation("Connected to coordinator SSE stream");
				activity?.AddEvent(new ActivityEvent("Connected"));

				while (!stoppingToken.IsCancellationRequested)
				{
					var line = await reader.ReadLineAsync(stoppingToken);

					if (line == null)
					{
						_logger.LogWarning("Coordinator stream ended");
						activity?.AddEvent(new ActivityEvent("StreamEnded"));
						break;
					}

					if (line.StartsWith("data: "))
					{
						var json = line[6..]; // Remove "data: " prefix
						try
						{
							var backends = JsonSerializer.Deserialize(json, BackendJsonContext.Default.ListBackendInfo);
							if (backends != null)
							{
								UpdateProxyConfiguration(backends);
							}
						}
						catch (JsonException ex)
						{
							_logger.LogError(ex, "Failed to parse backend update");
						}
					}
				}
			}
			catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
			{
				// Graceful shutdown
				activity?.AddEvent(new ActivityEvent("Shutdown"));
				break;
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Error communicating with coordinator, retrying in 5s");
				activity?.AddEvent(new ActivityEvent("ConnectionError", tags: new ActivityTagsCollection
				{
					{ "error.type", ex.GetType().Name },
					{ "error.message", ex.Message }
				}));
				await Task.Delay(2000, stoppingToken);
			}
		}

		_logger.LogInformation("Coordinator client stopped");
	}

	private void UpdateProxyConfiguration(List<BackendInfo> backends)
	{
		using var activity = ActivitySource.StartActivity("UpdateProxyConfig");
		activity?.SetTag("backends.count", backends.Count);

		if (backends.Count == 0)
		{
			_logger.LogWarning("No backends available");
			activity?.SetTag("config.empty", true);
			return;
		}

		var destinations = backends.ToDictionary(
			b => $"backend-{b.Port}",
			b => new DestinationConfig { Address = b.Address }
		);

		activity?.SetTag("destinations.count", destinations.Count);

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

		activity?.SetTag("config.updated", true);
		foreach (var backend in backends)
		{
			activity?.AddEvent(new ActivityEvent("BackendConfigured", tags: new ActivityTagsCollection
			{
				{ "backend.port", backend.Port },
				{ "backend.status", backend.Status }
			}));
		}
	}
}
