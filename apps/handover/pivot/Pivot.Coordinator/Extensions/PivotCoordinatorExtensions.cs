using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Pivot.Development;
using Pivot.Orchestration;

namespace Pivot.Extensions;


public static class PivotCoordinatorExtensions
{
	public static WebApplicationBuilder AddPivotCoordinator(
		this WebApplicationBuilder builder,
		Action<PivotCoordinatorOptions>? configure = null
	)
	{
		var options = new PivotCoordinatorOptions();

		// Load from appsettings first
		builder.Configuration.GetSection("BackendConfig").Bind(options);

		// Fluent config overrides
		configure?.Invoke(options);

		builder.Services.AddSingleton(options);
		builder.Services.AddSingleton<BackendRegistry>();
		builder.Services.AddSingleton<BackendOrchestrator>();
		builder.Services.AddHostedService(sp => sp.GetRequiredService<BackendOrchestrator>());
		// Add development-only plugin source watcher
		if (builder.Environment.IsDevelopment())
		{
			builder.Services.AddHostedService<PluginSourceWatcher>();
		}
		// Add CORS for development
		builder.Services.AddCors(options =>
		{
			options.AddDefaultPolicy(policy =>
			{
				policy.AllowAnyOrigin()
					.AllowAnyMethod()
					.AllowAnyHeader();
			});
		});

		return builder;
	}

	public static WebApplication MapPivotCoordinator(this WebApplication app)
	{
		var registry = app.Services.GetRequiredService<BackendRegistry>();
		var orchestrator = app.Services.GetRequiredService<BackendOrchestrator>();

		// Set coordinator address for backend environment variable
		var urls = app.Configuration["ASPNETCORE_URLS"] ?? "http://localhost:5100";
		var firstUrl = urls.Split(';')[0];
		orchestrator.SetCoordinatorAddress(firstUrl);

		app.UseCors();

		// REST API - Get current backends
		app.MapGet("/backends", async () =>
		{
			var backends = await registry.GetAllAsync();
			return Results.Json(backends);
		});

		// Server-Sent Events - Stream backend changes in real-time
		app.MapGet("/backends/stream", async (HttpContext context) =>
		{
			context.Response.Headers.ContentType = "text/event-stream";
			context.Response.Headers.CacheControl = "no-cache";
			context.Response.Headers["X-Accel-Buffering"] = "no"; // Disable nginx buffering

			try
			{
				await foreach (var backends in registry.WatchChangesAsync(context.RequestAborted))
				{
					var json = JsonSerializer.Serialize(backends);
					await context.Response.WriteAsync($"data: {json}\n\n");
					await context.Response.Body.FlushAsync();
				}
			}
			catch (OperationCanceledException)
			{
				// Client disconnected, this is normal
			}
		});

		// Trigger reload
		app.MapPost("/reload", () =>
		{
			// Fire and forget - reload happens in background
			_ = Task.Run(async () => await orchestrator.ReloadBackendsAsync());
			return Results.Ok(new { message = "Reload initiated" });
		});

		// Health check
		app.MapGet("/health", () => Results.Ok(new
		{
			status = "healthy",
			timestamp = DateTime.UtcNow
		}));

		return app;
	}
}
