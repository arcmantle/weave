using System.Diagnostics;

namespace Pivot.Registry.Tests;

public class ServerFixture : IAsyncLifetime
{
	private Process? _serverProcess;
	public const string BaseUrl = "http://localhost:5000";

	public async Task InitializeAsync()
	{
		// Start the server process
		var projectPath = Path.Combine(
			Directory.GetCurrentDirectory(),
			"..", "..", "..", "..",
			"Pivot.Registry.TestHost",
			"Pivot.Registry.TestHost.csproj"
		);

		_serverProcess = new Process
		{
			StartInfo = new ProcessStartInfo
			{
				FileName = "dotnet",
				Arguments = $"run --project \"{projectPath}\"",
				UseShellExecute = false,
				RedirectStandardOutput = true,
				RedirectStandardError = true,
				CreateNoWindow = true,
				Environment =
				{
					["ASPNETCORE_ENVIRONMENT"] = "Development",
					["ASPNETCORE_URLS"] = BaseUrl
				}
			}
		};

		// Capture output for debugging
		_serverProcess.OutputDataReceived += (sender, e) =>
		{
			if (!string.IsNullOrEmpty(e.Data))
				Console.WriteLine($"[Server]: {e.Data}");
		};
		_serverProcess.ErrorDataReceived += (sender, e) =>
		{
			if (!string.IsNullOrEmpty(e.Data))
				Console.WriteLine($"[Server Error]: {e.Data}");
		};

		_serverProcess.Start();
		_serverProcess.BeginOutputReadLine();
		_serverProcess.BeginErrorReadLine();

		// Wait for server to be ready
		using var httpClient = new HttpClient();
		httpClient.Timeout = TimeSpan.FromSeconds(5);
		var maxAttempts = 40;
		var delayMs = 1000;

		for (int i = 0; i < maxAttempts; i++)
		{
			try
			{
				var response = await httpClient.GetAsync(BaseUrl);
				// Any response means server is up
				Console.WriteLine($"Server is ready! Status: {response.StatusCode}");
				return;
			}
			catch (Exception ex)
			{
				// Server not ready yet
				Console.WriteLine($"Attempt {i + 1}/{maxAttempts}: {ex.Message}");
			}

			await Task.Delay(delayMs);
		}

		throw new Exception("Server failed to start within the expected time");
	}

	public Task DisposeAsync()
	{
		if (_serverProcess != null && !_serverProcess.HasExited)
		{
			_serverProcess.Kill(entireProcessTree: true);
			_serverProcess.Dispose();
		}

		return Task.CompletedTask;
	}
}
