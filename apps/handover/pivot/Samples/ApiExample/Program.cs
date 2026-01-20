using ApiExample.Data;
using ApiExample.Services;
using Microsoft.EntityFrameworkCore;
using Pivot.Plugin;

var builder = WebApplication.CreateBuilder(args);

// Add Razor Pages
builder.Services.AddRazorPages();

// Add EF Core with SQLite
builder.Services.AddDbContext<PluginDbContext>(options =>
	options.UseSqlite("Data Source=plugins.db"));

// Add Pivot backend with plugin loading
builder.AddPivotBackend(options =>
{
	options.LoadFromReferencedAssemblies = true;
	options.EnableAutoReload = builder.Environment.IsDevelopment();
});

// Add Plugin Manager
builder.Services.AddSingleton<IPluginManager, PluginManager>();

// Add Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
	c.SwaggerDoc("v1", new()
	{
		Title = "Pivot Sample API",
		Version = "v1",
		Description = "Sample application demonstrating Pivot plugin system with dynamic plugin management"
	});

	var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
	var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
	if (File.Exists(xmlPath))
	{
		c.IncludeXmlComments(xmlPath);
	}
});

var app = builder.Build();

// Ensure database is created and migrated
using (var scope = app.Services.CreateScope())
{
	var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();
	db.Database.Migrate();

	// Initialize plugin manager to sync plugins with database
	var pluginManager = scope.ServiceProvider.GetRequiredService<IPluginManager>();
	await pluginManager.InitializeAsync();
}

// Configure middleware
if (app.Environment.IsDevelopment())
{
	app.UseDeveloperExceptionPage();
}

app.UseStaticFiles();
app.UseRouting();

// Enable Swagger
app.UseSwagger();
app.UseSwaggerUI(c =>
{
	c.SwaggerEndpoint("/swagger/v1/swagger.json", "Pivot Sample API v1");
	c.RoutePrefix = "swagger";
});

// Map Pivot backend (includes plugin configuration)
app.MapPivotBackend();

// Map Razor Pages
app.MapRazorPages();

// Map Plugin Management API
var pluginApi = app.MapGroup("/api/plugins")
	.WithTags("Plugin Management");

pluginApi.MapGet("/", async (IPluginManager manager) =>
{
	var plugins = await manager.GetAllPluginsAsync();
	return Results.Ok(plugins);
})
.WithName("GetAllPlugins")
.WithSummary("Get all plugins and their current state")
.WithOpenApi();

pluginApi.MapPost("/{name}/toggle", async (string name, IPluginManager manager) =>
{
	var success = await manager.TogglePluginAsync(name);
	if (!success)
		return Results.NotFound(new { message = $"Plugin '{name}' not found" });

	return Results.Ok(new { message = $"Plugin '{name}' toggled successfully" });
})
.WithName("TogglePlugin")
.WithSummary("Enable or disable a plugin")
.WithOpenApi();

pluginApi.MapGet("/events", async (HttpContext context, IPluginManager manager) =>
{
	context.Response.Headers.Append("Content-Type", "text/event-stream");
	context.Response.Headers.Append("Cache-Control", "no-cache");
	context.Response.Headers.Append("Connection", "keep-alive");

	await manager.StreamPluginEventsAsync(context.Response.Body, context.RequestAborted);
})
.WithName("PluginEvents")
.WithSummary("Server-Sent Events stream for real-time plugin state updates")
.WithOpenApi()
.ExcludeFromDescription(); // Hide from Swagger UI since SSE doesn't work well there

app.Run();
