using System.Text.Json;
using Coordinator.Services;


var builder = WebApplication.CreateSlimBuilder(args);

// Add services
builder.Services.AddSingleton<BackendRegistry>();
builder.Services.AddSingleton<BackendOrchestrator>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<BackendOrchestrator>());

// Add CORS for local development
builder.Services.AddCors(options => {
	options.AddDefaultPolicy(policy => {
		policy.AllowAnyOrigin()
			.AllowAnyMethod()
			.AllowAnyHeader();
	});
});

var app = builder.Build();

app.UseCors();

// REST API - Get current backends
app.MapGet("/backends", async (BackendRegistry registry) => {
	var backends = await registry.GetAllAsync();
	return Results.Json(backends);
});

// Server-Sent Events - Stream backend changes in real-time
app.MapGet("/backends/stream", async (HttpContext context, BackendRegistry registry) => {
	context.Response.Headers.ContentType = "text/event-stream";
	context.Response.Headers.CacheControl = "no-cache";
	context.Response.Headers["X-Accel-Buffering"] = "no"; // Disable nginx buffering

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

// Trigger reload
app.MapPost("/reload", (BackendOrchestrator orchestrator) => {
	// Fire and forget - reload happens in background
	_ = Task.Run(async () => await orchestrator.ReloadBackendsAsync());
	return Results.Ok(new { message = "Reload initiated" });
});

// Health check
app.MapGet("/health", () => Results.Ok(new {
	status = "healthy",
	timestamp = DateTime.UtcNow
}));

app.Run();
