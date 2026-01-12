using Core.Plugin;
using Microsoft.Extensions.Diagnostics.HealthChecks;


WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment()) {
	// Add services to the container.
	// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
	builder.Services.AddOpenApi();
}

builder.LoadAndInitializePlugins(builder.Environment.IsDevelopment());

builder.Services.AddHealthChecks()
	.AddCheck("Database", () => {
		// Check database connection
		return new(HealthStatus.Healthy) { };
	})
	.AddCheck("Plugin System", () => {
		// Check plugin system health
		return new(HealthStatus.Healthy) { };
	});

WebApplication app = builder.Build();

app.ConfigurePlugins();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment()) {
	app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapHealthChecks("/health");

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

app.MapGet("/shutdown", () => {
	_ = Task.Run(async () => {
		await app.StopAsync();

		Environment.Exit(0);
	});
	return Results.Ok("Shutting down...");
});

app.Run();

