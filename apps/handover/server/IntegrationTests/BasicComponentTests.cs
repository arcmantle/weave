using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IntegrationTests;

[Collection("Sequential")]
public class BasicComponentTests : IDisposable {
	private HttpClient? _client;

	[Fact]
	public async Task Test01_CanStartMinimalWebServer() {
		// Arrange
		var builder = WebApplication.CreateSlimBuilder();
		builder.WebHost.UseUrls("http://localhost:16000");

		var app = builder.Build();
		app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

		// Act
		await app.StartAsync();

		_client = new HttpClient { BaseAddress = new Uri("http://localhost:16000") };
		var response = await _client.GetAsync("/health");

		// Assert
		Assert.Equal(HttpStatusCode.OK, response.StatusCode);
		Console.WriteLine("✓ Can start minimal web server");

		await app.StopAsync();
	}

	[Fact]
	public async Task Test02_BackendRegistryExists() {
		// Arrange
		var builder = WebApplication.CreateSlimBuilder();
		builder.WebHost.UseUrls("http://localhost:16001");
		builder.Services.AddSingleton<Coordinator.Services.BackendRegistry>();

		var app = builder.Build();

		// Act
		await app.StartAsync();
		var registry = app.Services.GetRequiredService<Coordinator.Services.BackendRegistry>();
		var backends = await registry.GetAllAsync();

		// Assert
		Assert.NotNull(registry);
		Assert.Empty(backends);
		Console.WriteLine("✓ BackendRegistry service works");

		await app.StopAsync();
	}

	[Fact]
	public async Task Test03_BackendRegistryCanUpdateBackends() {
		// Arrange
		var registry = new Coordinator.Services.BackendRegistry();
		var backendInfo = new Coordinator.Models.BackendInfo {
			Port = 5001,
			Address = "http://localhost:5001",
			Status = "starting",
			StartedAt = DateTime.UtcNow
		};

		// Act
		await registry.UpdateAsync(new List<Coordinator.Models.BackendInfo> { backendInfo });
		var backends = await registry.GetAllAsync();

		// Assert
		Assert.Single(backends);
		Assert.Equal(5001, backends[0].Port);
		Assert.Equal("starting", backends[0].Status);
		Console.WriteLine("✓ BackendRegistry can store backends");
	}

	[Fact]
	public async Task Test04_BackendRegistryCanUpdateStatus() {
		// Arrange
		var registry = new Coordinator.Services.BackendRegistry();
		var backendInfo = new Coordinator.Models.BackendInfo {
			Port = 5001,
			Address = "http://localhost:5001",
			Status = "starting",
			StartedAt = DateTime.UtcNow
		};
		await registry.UpdateAsync(new List<Coordinator.Models.BackendInfo> { backendInfo });

		// Act
		var updated = backendInfo with { Status = "healthy" };
		await registry.UpdateAsync(new List<Coordinator.Models.BackendInfo> { updated });
		var backends = await registry.GetAllAsync();

		// Assert
		Assert.Single(backends);
		Assert.Equal("healthy", backends[0].Status);
		Console.WriteLine("✓ BackendRegistry can update backend status");
	}

	[Fact]
	public async Task Test05_CanSpawnDotNetProcess() {
		// Arrange
		var startInfo = new System.Diagnostics.ProcessStartInfo {
			FileName = "dotnet",
			Arguments = "--version",
			RedirectStandardOutput = true,
			UseShellExecute = false
		};

		// Act
		using var process = System.Diagnostics.Process.Start(startInfo);
		Assert.NotNull(process);

		var output = await process.StandardOutput.ReadToEndAsync();
		await process.WaitForExitAsync();

		// Assert
		Assert.Equal(0, process.ExitCode);
		Assert.NotEmpty(output);
		Console.WriteLine($"dotnet version: {output.Trim()}");
	}

	[Fact]
	public async Task Test06_CanCheckIfPortIsAvailable() {
		// Act
		using var client = new HttpClient();
		var portAvailable = false;

		try {
			await client.GetAsync("http://localhost:17000/health");
		}
		catch (HttpRequestException) {
			portAvailable = true; // Port is free
		}

		// Assert
		Assert.True(portAvailable, "Port 17000 should be available");
	}

	[Fact]
	public async Task Test07_CanStartBasicWebApp() {
		// Arrange
		var builder = WebApplication.CreateSlimBuilder();
		builder.WebHost.UseUrls("http://localhost:17001");

		var app = builder.Build();
		app.MapGet("/test", () => "Hello");

		// Act
		await app.StartAsync();

		_client = new HttpClient();
		var response = await _client.GetStringAsync("http://localhost:17001/test");

		// Assert
		Assert.Equal("Hello", response);
		Console.WriteLine("✓ Can start and query basic web app");

		await app.StopAsync();
	}

	public void Dispose() {
		_client?.Dispose();
	}
}
