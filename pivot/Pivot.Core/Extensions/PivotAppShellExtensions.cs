using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Pivot.Extensions;


/// <summary>
/// Options for serving the Pivot app shell in production.
/// </summary>
public class PivotAppShellOptions {
	/// <summary>
	/// Directory containing the built app shell static files.
	/// Defaults to <c>wwwroot</c> in the content root.
	/// </summary>
	public string? OutputDirectory { get; set; }
}


/// <summary>
/// Extension methods for serving the Pivot app shell static files
/// and providing SPA fallback routing in production.
/// </summary>
public static class PivotAppShellExtensions {
	/// <summary>
	/// Serves the built Pivot app shell from <c>wwwroot/</c> and
	/// configures SPA fallback routing so that client-side routes
	/// (e.g. <c>/weather</c>, <c>/todos</c>) serve <c>index.html</c>.
	///
	/// In Development, this is a no-op — use <see cref="PivotDevServerExtensions.UsePivotDevServer"/>
	/// instead for HMR support.
	/// </summary>
	public static WebApplication MapPivotAppShell(
		this WebApplication app,
		Action<PivotAppShellOptions>? configure = null
	) {
		// In development, the Vite dev server handles the app shell.
		if (app.Environment.IsDevelopment())
			return app;

		var options = new PivotAppShellOptions();
		configure?.Invoke(options);

		var logger = app.Services.GetRequiredService<ILogger<WebApplication>>();

		var webRoot = options.OutputDirectory
			?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");

		if (!Directory.Exists(webRoot)) {
			logger.LogWarning(
				"[pivot] App shell directory '{Dir}' not found. " +
				"Run 'dotnet publish' to build the app shell, or use " +
				"UsePivotDevServer() in Development.",
				webRoot);
			return app;
		}

		var indexPath = Path.Combine(webRoot, "index.html");
		if (!File.Exists(indexPath)) {
			logger.LogWarning(
				"[pivot] No index.html found in '{Dir}'. " +
				"The app shell may not have been built correctly.",
				webRoot);
			return app;
		}

		// Serve static files from the app shell build output.
		var fileProvider = new PhysicalFileProvider(webRoot);
		app.UseStaticFiles(new StaticFileOptions {
			FileProvider = fileProvider,
		});

		// SPA fallback: serve index.html for any unmatched GET request
		// that accepts text/html (i.e. browser navigation, not API calls).
		app.MapFallback(async context => {
			// Don't intercept API routes or plugin asset requests.
			var path = context.Request.Path.Value ?? "";
			if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
				|| path.StartsWith("/plugins/", StringComparison.OrdinalIgnoreCase)
				|| path.StartsWith("/shared/", StringComparison.OrdinalIgnoreCase)) {
				context.Response.StatusCode = 404;
				return;
			}

			context.Response.ContentType = "text/html; charset=utf-8";
			context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
			await context.Response.SendFileAsync(fileProvider.GetFileInfo("index.html"));
		});

		logger.LogInformation("[pivot] Serving app shell from {Dir}", webRoot);

		return app;
	}
}
