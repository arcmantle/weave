using Pivot.Extensions;
using Microsoft.Extensions.Diagnostics.HealthChecks;


WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment()) {
	builder.Services.AddOpenApi();
}

builder.AddPivotBackend(options => {
	options.LoadFromReferencedAssemblies = false; // Always load from directory for true hot reload
	options.PluginDirectory = Path.Combine(AppContext.BaseDirectory, "plugins");
	options.EnableAutoReload = builder.Environment.IsDevelopment();
	options.WatchDebounceMs = 1000; // Wait for build to complete before triggering reload
});

WebApplication app = builder.Build();

app.MapPivotBackend();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment()) {
	app.MapOpenApi();
}

app.UseHttpsRedirection();

// Demo endpoints
app.MapGet("/", () => Results.Ok(new {
	message = "Backend server running",
	port = Environment.GetEnvironmentVariable("ASPNETCORE_URLS"),
	timestamp = DateTime.UtcNow
}));

app.MapGet("/api/status", () => Results.Ok(new {
	status = "healthy",
	version = "1.0.0",
	uptime = DateTime.UtcNow - System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime()
}));

app.MapGet("/api/data", () => Results.Ok(new[] {
	new { id = 1, name = "Item 1", value = 100 },
	new { id = 2, name = "Item 2", value = 200 },
	new { id = 3, name = "Item 3", value = 300 }
}));

app.MapPost("/api/echo", async (HttpContext context) => {
	using var reader = new StreamReader(context.Request.Body);
	var body = await reader.ReadToEndAsync();
	return Results.Ok(new {
		received = body,
		timestamp = DateTime.UtcNow
	});
});

app.MapPost("/shutdown", () => {
	_ = Task.Run(async () => {
		await Task.Delay(100); // Small delay to allow response to be sent
		await app.StopAsync();
		Environment.Exit(0);
	});
	return Results.Ok("Shutting down...");
});

app.Run();

