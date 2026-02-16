using System.Diagnostics;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Pivot.Extensions;


/// <summary>
/// Options for launching the Pivot Vite dev server alongside the backend.
/// </summary>
public class PivotDevServerOptions {
	/// <summary>
	/// Directory containing plugin subdirectories with client/ folders.
	/// When null, falls back to <see cref="PivotClientPluginOptions.PluginDirectory"/>.
	/// </summary>
	public string? PluginsDirectory { get; set; }

	/// <summary>
	/// Port for the Vite dev server.
	/// </summary>
	public int Port { get; set; } = 3200;

	/// <summary>
	/// The origin URL the dev server will proxy API requests to.
	/// Typically the .NET backend's own URL (e.g. http://localhost:5200).
	/// When null, auto-detected from the app's configured URLs.
	/// </summary>
	public string? BackendUrl { get; set; }

	/// <summary>
	/// Working directory for the pivot-dev process.
	/// If null, defaults to the project directory (resolved from content root).
	/// </summary>
	public string? WorkingDirectory { get; set; }
}


/// <summary>
/// Extension methods for launching the Pivot Vite dev server
/// alongside the .NET backend in Development environments.
/// </summary>
public static class PivotDevServerExtensions {
	/// <summary>
	/// In Development, spawns the <c>pivot-dev</c> CLI as a child process
	/// that serves the Pivot app shell and plugin source code with HMR.
	///
	/// The dev server proxies <c>/api</c> and <c>/plugins</c> requests
	/// to the .NET backend, so the developer only needs to run
	/// <c>dotnet run</c> and open the Vite URL (default http://localhost:3200).
	///
	/// This is a no-op in non-Development environments.
	/// </summary>
	public static WebApplication UsePivotDevServer(
		this WebApplication app,
		Action<PivotDevServerOptions>? configure = null
	) {
		if (!app.Environment.IsDevelopment())
			return app;

		var options = new PivotDevServerOptions();
		configure?.Invoke(options);

		var logger = app.Services.GetRequiredService<ILogger<WebApplication>>();
		var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();

		// Resolve the backend URL that the dev server should proxy to.
		var backendUrl = options.BackendUrl ?? ResolveBackendUrl(app);

		// Resolve plugins directory.
		var pluginsDir = options.PluginsDirectory;
		if (string.IsNullOrEmpty(pluginsDir)) {
			logger.LogWarning(
				"[pivot-dev] PluginsDirectory not set — the dev server will start " +
				"without local plugin HMR. Set it in UsePivotDevServer(options => ...)");
		}

		// Build the command arguments.
		var args = new List<string>();
		if (!string.IsNullOrEmpty(pluginsDir)) {
			args.Add("--plugins");
			args.Add(Path.GetFullPath(pluginsDir));
		}

		args.Add("--port");
		args.Add(options.Port.ToString());
		args.Add("--backend");
		args.Add(backendUrl);

		logger.LogInformation(
			"[pivot-dev] Starting Vite dev server on port {Port}, proxying to {Backend}",
			options.Port, backendUrl);

		// Spawn the process.
		var workDir = options.WorkingDirectory
			?? app.Environment.ContentRootPath;

		// Resolve the CLI script from node_modules instead of using npx.
		// Walk up from the working directory to find the nearest node_modules.
		var cliScript = ResolveCliScript(workDir);
		if (cliScript == null) {
			logger.LogError(
				"[pivot-dev] Could not find @arcmantle/pivot-dev-server in node_modules. " +
				"Run 'npm install @arcmantle/pivot-dev-server' (or pnpm/yarn equivalent).");
			return app;
		}

		var psi = new ProcessStartInfo {
			FileName = "node",
			Arguments = $"\"{cliScript}\" {string.Join(' ', args)}",
			WorkingDirectory = workDir,
			UseShellExecute = false,
			RedirectStandardOutput = true,
			RedirectStandardError = true,
			CreateNoWindow = true,
		};

		Process? process = null;

		try {
			process = Process.Start(psi);
			if (process == null) {
				logger.LogError("[pivot-dev] Failed to start pivot-dev process");
				return app;
			}

			// Forward stdout/stderr to the application logger.
			_ = Task.Run(async () => {
				string? line;
				while ((line = await process.StandardOutput.ReadLineAsync()) != null)
					logger.LogInformation("[pivot-dev] {Line}", line);
			});

			_ = Task.Run(async () => {
				string? line;
				while ((line = await process.StandardError.ReadLineAsync()) != null)
					logger.LogWarning("[pivot-dev] {Line}", line);
			});

			// Kill the dev server when the backend shuts down.
			lifetime.ApplicationStopping.Register(() => {
				if (process is { HasExited: false }) {
					logger.LogInformation("[pivot-dev] Shutting down Vite dev server...");
					try {
						process.Kill(entireProcessTree: true);
					}
					catch {
						// Process may already be exiting.
					}
				}
			});

			logger.LogInformation(
				"[pivot-dev] Vite dev server started (PID {Pid}). Open http://localhost:{Port}",
				process.Id, options.Port);
		}
		catch (Exception ex) {
			logger.LogError(ex,
				"[pivot-dev] Could not start pivot-dev. " +
				"Ensure Node.js is installed and @arcmantle/pivot-dev-server is in node_modules.");
		}

		return app;
	}

	private static string ResolveBackendUrl(WebApplication app) {
		// Try to get the first configured URL from the app's addresses.
		var addresses = app.Urls;
		if (addresses.Count > 0) {
			var first = addresses.First();
			// Prefer http over https for local dev proxy.
			var httpAddr = addresses.FirstOrDefault(a => a.StartsWith("http://", StringComparison.OrdinalIgnoreCase));
			return httpAddr ?? first;
		}

		// Default fallback.
		return "http://localhost:5200";
	}

	/// <summary>
	/// Walks up from <paramref name="startDir"/> looking for
	/// <c>node_modules/@arcmantle/pivot-dev-server/dist/cli.js</c>.
	/// Returns the full path if found, or null.
	/// </summary>
	private static string? ResolveCliScript(string startDir) {
		var dir = Path.GetFullPath(startDir);

		while (dir != null) {
			var candidate = Path.Combine(
				dir, "node_modules", "@arcmantle", "pivot-dev-server", "dist", "cli.js");

			if (File.Exists(candidate))
				return candidate;

			var parent = Directory.GetParent(dir)?.FullName;
			if (parent == dir)
				break;

			dir = parent;
		}

		return null;
	}
}
