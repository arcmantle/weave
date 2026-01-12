using System.Net;
using Xunit;

namespace IntegrationTests;

[Collection("Sequential")]
public class BackendProcessTests : IAsyncLifetime {
	private const string ServerProjectPath = @"C:\Programming\projects\arcmantle\weave\apps\handover\server\Server\Server.csproj";
	private System.Diagnostics.Process? _backendProcess;
	private HttpClient? _client;

	public Task InitializeAsync() {
		// Kill any process on port 18001
		KillProcessOnPort(18001);
		return Task.CompletedTask;
	}

	[Fact]
	public async Task Test01_CanBuildServerProject() {
		// Act
		var startInfo = new System.Diagnostics.ProcessStartInfo {
			FileName = "dotnet",
			Arguments = $"build \"{ServerProjectPath}\"",
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			UseShellExecute = false
		};

		using var process = System.Diagnostics.Process.Start(startInfo);
		Assert.NotNull(process);

		await process.WaitForExitAsync();
		var output = await process.StandardOutput.ReadToEndAsync();

		// Assert
		Assert.Equal(0, process.ExitCode);
		Console.WriteLine(output);
	}

	[Fact]
	public async Task Test02_CanStartBackendProcess() {
		// Arrange
		var projectDir = Path.GetDirectoryName(ServerProjectPath)!;
		var startInfo = new System.Diagnostics.ProcessStartInfo {
			FileName = "dotnet",
			Arguments = "run --no-build --no-launch-profile",
			WorkingDirectory = projectDir,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			UseShellExecute = false,
			CreateNoWindow = true
		};
		startInfo.EnvironmentVariables["ASPNETCORE_URLS"] = "http://localhost:18001";
		startInfo.EnvironmentVariables["ASPNETCORE_ENVIRONMENT"] = "Development";

		// Act
		_backendProcess = System.Diagnostics.Process.Start(startInfo);
		Assert.NotNull(_backendProcess);

		// Capture output
		var outputTask = Task.Run(async () => {
			while (!_backendProcess.StandardOutput.EndOfStream) {
				var line = await _backendProcess.StandardOutput.ReadLineAsync();
				if (line != null) Console.WriteLine($"[Backend] {line}");
			}
		});

		// Wait for it to start
		await Task.Delay(8000);

		// Assert
		Assert.False(_backendProcess.HasExited, "Backend process should still be running");
		Console.WriteLine($"Backend process started with PID: {_backendProcess.Id}");
	}

	[Fact]
	public async Task Test03_BackendRespondsToHealthCheck() {
		// Arrange
		var projectDir = Path.GetDirectoryName(ServerProjectPath)!;
		var startInfo = new System.Diagnostics.ProcessStartInfo {
			FileName = "dotnet",
			Arguments = "run --no-build --no-launch-profile",
			WorkingDirectory = projectDir,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			UseShellExecute = false,
			CreateNoWindow = true
		};
		startInfo.EnvironmentVariables["ASPNETCORE_URLS"] = "http://localhost:18002";
		startInfo.EnvironmentVariables["ASPNETCORE_ENVIRONMENT"] = "Development";

		_backendProcess = System.Diagnostics.Process.Start(startInfo);
		Assert.NotNull(_backendProcess);

		Console.WriteLine($"Started backend process PID: {_backendProcess.Id}");

		// Capture output in background
		_ = Task.Run(async () => {
			while (!_backendProcess.StandardOutput.EndOfStream) {
				var line = await _backendProcess.StandardOutput.ReadLineAsync();
				if (line != null) Console.WriteLine($"[Backend:OUT] {line}");
			}
		});

		_ = Task.Run(async () => {
			while (!_backendProcess.StandardError.EndOfStream) {
				var line = await _backendProcess.StandardError.ReadLineAsync();
				if (line != null) Console.WriteLine($"[Backend:ERR] {line}");
			}
		});

		// Wait for startup - check every second
		_client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
		var started = false;
		for (int i = 0; i < 15; i++) {
			await Task.Delay(1000);
			Console.WriteLine($"Attempt {i + 1}/15: Checking http://localhost:18002/health");

			try {
				var response = await _client.GetAsync("http://localhost:18002/health");
				if (response.IsSuccessStatusCode) {
					started = true;
					Console.WriteLine("✓ Backend is responding!");
					break;
				}
			}
			catch (Exception ex) {
				Console.WriteLine($"Not ready yet: {ex.Message}");
			}
		}

		// Assert
		Assert.True(started, "Backend did not start within 15 seconds");

		_backendProcess.Kill(true);
		await _backendProcess.WaitForExitAsync();
	}

	public async Task DisposeAsync() {
		_client?.Dispose();

		if (_backendProcess != null && !_backendProcess.HasExited) {
			_backendProcess.Kill(true);
			await _backendProcess.WaitForExitAsync();
			_backendProcess.Dispose();
		}

		KillProcessOnPort(18001);
		KillProcessOnPort(18002);
	}

	private void KillProcessOnPort(int port) {
		try {
			var startInfo = new System.Diagnostics.ProcessStartInfo {
				FileName = "netstat",
				Arguments = "-ano",
				RedirectStandardOutput = true,
				UseShellExecute = false
			};

			using var netstat = System.Diagnostics.Process.Start(startInfo);
			if (netstat == null) return;

			var output = netstat.StandardOutput.ReadToEnd();
			netstat.WaitForExit();

			var lines = output.Split('\n');
			foreach (var line in lines) {
				if (line.Contains($":{port} ") && line.Contains("LISTENING")) {
					var parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
					if (parts.Length > 0 && int.TryParse(parts[^1], out var pid)) {
						using var killProcess = System.Diagnostics.Process.Start("taskkill", $"/F /PID {pid}");
						killProcess?.WaitForExit();
						Console.WriteLine($"Killed process {pid} on port {port}");
					}
				}
			}
		}
		catch {
			// Ignore errors
		}
	}
}
