using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IntegrationTests;

[Collection("IntegrationTests")]
public class HandoverSystemTests : IAsyncLifetime {
	private WebApplication? _coordinatorApp;
	private WebApplication? _proxyApp;
	private HttpClient? _coordinatorClient;
	private HttpClient? _proxyClient;
	private const string CoordinatorUrl = "http://localhost:15100";
	private const string ProxyUrl = "http://localhost:15000";

	public async Task InitializeAsync() {
		Console.WriteLine("=== Test Initialization ===");

		// Kill any orphaned processes on test ports
		await KillOrphanedProcessesAsync();

		// Start Coordinator
		Console.WriteLine("Starting Coordinator...");
		_coordinatorApp = await StartCoordinatorAsync();
		_coordinatorClient = new HttpClient { BaseAddress = new Uri(CoordinatorUrl) };

		// Wait for coordinator to be ready
		Console.WriteLine("Waiting for Coordinator health...");
		await WaitForHealthyAsync(_coordinatorClient);
		Console.WriteLine("Coordinator is healthy");

		// Start Proxy (which connects to Coordinator)
		Console.WriteLine("Starting Proxy...");
		_proxyApp = await StartProxyAsync();
		_proxyClient = new HttpClient { BaseAddress = new Uri(ProxyUrl) };

		// Wait for proxy to be ready
		Console.WriteLine("Waiting for Proxy health...");
		await WaitForHealthyAsync(_proxyClient);
		Console.WriteLine("Proxy is healthy");

		// Wait for initial backend to be started by coordinator
		Console.WriteLine("Waiting for initial backend...");
		List<BackendInfo> backends = [];
		for (int i = 0; i < 30; i++) {
			await Task.Delay(1000);
			backends = await GetBackendsAsync();
			if (backends.Count > 0 && backends[0].Status == "healthy") {
				Console.WriteLine($"Backend ready after {i + 1}s");
				break;
			}
		}

		Console.WriteLine($"Initial backends: {backends.Count}");
		foreach (var backend in backends) {
			Console.WriteLine($"  - Port {backend.Port}: {backend.Status} at {backend.Address}");
		}

		if (backends.Count == 0) {
			throw new Exception("No backends started after 30s!");
		}

		// Try to hit the backend directly to see if it's actually running
		try {
			using var testClient = new HttpClient();
			var directResponse = await testClient.GetAsync($"http://localhost:{backends[0].Port}/health");
			Console.WriteLine($"Direct backend health check: {directResponse.StatusCode}");
		}
		catch (Exception ex) {
			Console.WriteLine($"Failed to connect to backend directly: {ex.Message}");
		}

		if (backends[0].Status != "healthy") {
			Console.WriteLine($"WARNING: Initial backend status is '{backends[0].Status}' instead of 'healthy'");
			// Don't fail here, let's see what happens in the actual test
		}

		Console.WriteLine("=== Initialization Complete ===");
	}

	public async Task DisposeAsync() {
		_coordinatorClient?.Dispose();
		_proxyClient?.Dispose();

		if (_proxyApp != null) {
			await _proxyApp.StopAsync();
			await _proxyApp.DisposeAsync();
		}

		if (_coordinatorApp != null) {
			await _coordinatorApp.StopAsync();
			await _coordinatorApp.DisposeAsync();
		}
	}

	[Fact]
	public async Task Coordinator_StartsInitialBackend() {
		// Act
		var response = await _coordinatorClient!.GetAsync("/backends");

		// Assert
		Assert.Equal(HttpStatusCode.OK, response.StatusCode);

		var json = await response.Content.ReadAsStringAsync();
		var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
		var backends = JsonSerializer.Deserialize<List<BackendInfo>>(json, options);

		Assert.NotNull(backends);
		Assert.Single(backends);
		Assert.Equal(5001, backends[0].Port);
		Assert.Equal("healthy", backends[0].Status);
	}

	[Fact]
	public async Task Proxy_RoutesRequestToBackend() {
		// Act - Request through proxy should hit the backend
		var response = await _proxyClient!.GetAsync("/health");

		// Assert
		Assert.Equal(HttpStatusCode.OK, response.StatusCode);

		var json = await response.Content.ReadAsStringAsync();
		Assert.Contains("healthy", json);
	}

	[Fact(Timeout = 45000)] // Increased timeout for build time
	public async Task Reload_PerformsZeroDowntimeSwitch() {
		// Arrange - Verify we start with one backend
		var initialBackends = await GetBackendsAsync();
		Assert.Single(initialBackends);
		var initialPort = initialBackends[0].Port;
		Console.WriteLine($"Initial backend on port {initialPort}");

		// Act - Trigger reload (don't wait for completion)
		Console.WriteLine("Triggering reload...");
		var reloadTask = _coordinatorClient!.PostAsync("/reload", null);

		// Wait for new backend to be added - poll until we see 2 backends (during drain period)
		var duringDrainBackends = new List<BackendInfo>();
		var maxAttempts = 40; // 40 attempts * 100ms = 4s max
		for (int i = 0; i < maxAttempts; i++) {
			await Task.Delay(100);
			duringDrainBackends = await GetBackendsAsync();
			if (duringDrainBackends.Count == 2) {
				break;
			}
		}

		// Assert - During drain period, both backends should be active
		Console.WriteLine($"Backends during drain: {duringDrainBackends.Count} - Ports: {string.Join(", ", duringDrainBackends.Select(b => b.Port))}");

		Assert.Equal(2, duringDrainBackends.Count);
		Assert.Contains(duringDrainBackends, b => b.Port == initialPort);
		Assert.Contains(duringDrainBackends, b => b.Port != initialPort);

		// Wait for reload to complete
		var reloadResponse = await reloadTask;
		Console.WriteLine($"Reload response: {reloadResponse.StatusCode}");
		Assert.True(reloadResponse.IsSuccessStatusCode, "Reload should return success");

		// Proxy should still work during transition
		var midReloadResponse = await _proxyClient!.GetAsync("/health");
		Assert.Equal(HttpStatusCode.OK, midReloadResponse.StatusCode);

		// Wait for old backend to be removed (drain time is now 2s for tests)
		await Task.Delay(3000);

		// Assert - Only new backend should remain
		var finalBackends = await GetBackendsAsync();
		Assert.Single(finalBackends);
		Assert.NotEqual(initialPort, finalBackends[0].Port);

		// Proxy should still work after reload
		var finalResponse = await _proxyClient!.GetAsync("/health");
		Assert.Equal(HttpStatusCode.OK, finalResponse.StatusCode);
	}

	[Fact(Timeout = 60000)]
	public async Task MultipleReloads_WorksCorrectly() {
		// Arrange
		var initialBackends = await GetBackendsAsync();
		var portsUsed = new HashSet<int> { initialBackends[0].Port };

		// Act & Assert - Perform 3 reloads
		for (int i = 0; i < 3; i++) {
			Console.WriteLine($"Starting reload {i + 1}/3");
			var reloadResponse = await _coordinatorClient!.PostAsync("/reload", null);
			Assert.Equal(HttpStatusCode.OK, reloadResponse.StatusCode);

			// Wait for reload to complete (drain period is 2s for tests)
			await Task.Delay(5000);

			var backends = await GetBackendsAsync();
			Console.WriteLine($"After reload {i + 1}: {backends.Count} backend(s) on port {backends[0].Port}");
			Assert.Single(backends);
			portsUsed.Add(backends[0].Port);

			// Verify proxy still works
			var healthResponse = await _proxyClient!.GetAsync("/health");
			Assert.Equal(HttpStatusCode.OK, healthResponse.StatusCode);
		}

		// Verify each reload used a different port
		Assert.Equal(4, portsUsed.Count); // Initial + 3 reloads = 4 unique ports
		Console.WriteLine($"✓ All 3 reloads completed successfully using ports: {string.Join(", ", portsUsed.OrderBy(p => p))}");
	}

	private async Task<List<BackendInfo>> GetBackendsAsync() {
		var response = await _coordinatorClient!.GetAsync("/backends");
		response.EnsureSuccessStatusCode();
		var json = await response.Content.ReadAsStringAsync();
		var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
		return JsonSerializer.Deserialize<List<BackendInfo>>(json, options) ?? new();
	}

	private static async Task<WebApplication> StartCoordinatorAsync() {
		var builder = WebApplication.CreateSlimBuilder(new[] { "--urls", CoordinatorUrl });

		// Enable logging to console for tests
		builder.Logging.ClearProviders();
		builder.Logging.AddConsole();
		builder.Logging.SetMinimumLevel(LogLevel.Information);

		// Configure path to Server project for tests
		var serverProjectPath = Path.GetFullPath(Path.Combine(
			AppContext.BaseDirectory,
			"..", "..", "..", "..", "Server", "Server.csproj"
		));

		if (!File.Exists(serverProjectPath)) {
			throw new FileNotFoundException($"Server project not found at: {serverProjectPath}");
		}

		Console.WriteLine($"Server project path: {serverProjectPath}");

		builder.Configuration["BackendConfig:ServerProjectPath"] = serverProjectPath;
		builder.Configuration["BackendConfig:HealthCheckMaxAttempts"] = "60"; // Increased for dotnet run build time
		builder.Configuration["BackendConfig:HealthCheckIntervalMs"] = "500";
		builder.Configuration["BackendConfig:ShutdownDrainTimeMs"] = "2000"; // Shorter drain for tests

		// Copy configuration from actual Coordinator
		builder.Services.AddSingleton<Coordinator.Services.BackendRegistry>();
		builder.Services.AddSingleton<Coordinator.Services.BackendOrchestrator>();
		builder.Services.AddHostedService(sp => sp.GetRequiredService<Coordinator.Services.BackendOrchestrator>());

		var app = builder.Build();

		// Copy endpoints from actual Coordinator
		app.MapGet("/backends", async (Coordinator.Services.BackendRegistry registry) => {
			var backends = await registry.GetAllAsync();
			return Results.Json(backends);
		});

		// SSE endpoint for real-time backend changes
		app.MapGet("/backends/stream", async (HttpContext context, Coordinator.Services.BackendRegistry registry) => {
			context.Response.Headers.ContentType = "text/event-stream";
			context.Response.Headers.CacheControl = "no-cache";
			context.Response.Headers["X-Accel-Buffering"] = "no";

			try {
				await foreach (var backends in registry.WatchChangesAsync(context.RequestAborted)) {
					var json = JsonSerializer.Serialize(backends);
					await context.Response.WriteAsync($"data: {json}\n\n");
					await context.Response.Body.FlushAsync();
				}
			}
			catch (OperationCanceledException) {
				// Client disconnected, this is normal
			}
		});

		app.MapPost("/reload", async (Coordinator.Services.BackendOrchestrator orchestrator) => {
			var success = await orchestrator.ReloadBackendsAsync();
			return success ? Results.Ok(new { message = "Reload completed successfully" }) : Results.StatusCode(503);
		});

		app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

		await app.StartAsync();
		return app;
	}

	private static async Task<WebApplication> StartProxyAsync() {
		var builder = WebApplication.CreateSlimBuilder(new[] { "--urls", ProxyUrl });

		// Set coordinator URL for testing
		builder.Configuration["CoordinatorUrl"] = CoordinatorUrl;

		// Copy configuration from actual Proxy
		var inMemoryConfig = new Yarp.ReverseProxy.Configuration.InMemoryConfigProvider([], []);
		builder.Services
			.AddSingleton<Yarp.ReverseProxy.Configuration.IProxyConfigProvider>(inMemoryConfig)
			.AddReverseProxy();

		builder.Services.AddSingleton<Proxy.Services.CoordinatorClient>();
		builder.Services.AddHostedService(sp => sp.GetRequiredService<Proxy.Services.CoordinatorClient>());

		var app = builder.Build();

		app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));
		app.MapReverseProxy();

		await app.StartAsync();
		return app;
	}

	private static async Task WaitForHealthyAsync(HttpClient client) {
		for (int i = 0; i < 30; i++) {
			try {
				var response = await client.GetAsync("/health");
				if (response.IsSuccessStatusCode)
					return;
			}
			catch {
				// Still starting
			}
			await Task.Delay(500);
		}
		throw new TimeoutException("Service did not become healthy");
	}

	private record BackendInfo {
		public string Address { get; init; } = "";
		public int Port { get; init; }
		public DateTime StartedAt { get; init; }
		public string Status { get; init; } = "";
	}

	private static async Task KillOrphanedProcessesAsync() {
		await Task.Run(() => {
			try {
				var ports = new[] { 5001, 5002, 15000, 15100 };
				foreach (var port in ports) {
					var startInfo = new System.Diagnostics.ProcessStartInfo {
						FileName = "netstat",
						Arguments = "-ano",
						RedirectStandardOutput = true,
						UseShellExecute = false,
						CreateNoWindow = true
					};

					var process = System.Diagnostics.Process.Start(startInfo);
					if (process != null) {
						var output = process.StandardOutput.ReadToEnd();
						process.WaitForExit();

						var lines = output.Split('\n');
						foreach (var line in lines) {
							if (line.Contains($":{port}") && line.Contains("LISTENING")) {
								var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
								if (parts.Length > 4 && int.TryParse(parts[4], out var pid)) {
									try {
										var killProcess = System.Diagnostics.Process.GetProcessById(pid);
										killProcess.Kill(true);
										Console.WriteLine($"Killed orphaned process {pid} on port {port}");
									}
									catch { /* Process already gone */ }
								}
							}
						}
					}
				}
				Thread.Sleep(2000); // Wait for ports to fully release
			}
			catch (Exception ex) {
				Console.WriteLine($"Warning: Failed to kill orphaned processes: {ex.Message}");
			}
		});
	}
}
