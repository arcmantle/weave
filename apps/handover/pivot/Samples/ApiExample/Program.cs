using Pivot.Extensions;
using Pivot.Plugin;

var builder = WebApplication.CreateBuilder(args);

// Add Pivot backend with plugin loading
builder.AddPivotBackend(options => {
	// Development: Load plugins from referenced assemblies (enables IntelliSense, debugging)
	// Production: Load from directory (enables hot reload without restart)
	options.LoadFromReferencedAssemblies = builder.Environment.IsDevelopment();
	options.EnableAutoReload = builder.Environment.IsDevelopment();

	// For directory-based loading (production or when LoadFromReferencedAssemblies = false):
	options.PluginDirectory = Path.Combine(AppContext.BaseDirectory, "plugins");
});

// Add OpenAPI
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure middleware
if (app.Environment.IsDevelopment()) {
	app.UseDeveloperExceptionPage();
}

// Enable OpenAPI
app.MapOpenApi();

// Map Pivot backend (includes plugin configuration)
app.MapPivotBackend();

// Map client-side plugin serving (static files + manifest/import-map endpoints)
app.MapPivotClientPlugins(options => {
	// In dev, point at source Plugins directory so discovery finds client/dist/client/
	if (app.Environment.IsDevelopment()) {
		var samplePluginsDir = Path.GetFullPath(
			Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Plugins"));
		if (Directory.Exists(samplePluginsDir))
			options.PluginDirectory = samplePluginsDir;
	}
});

app.Run();
