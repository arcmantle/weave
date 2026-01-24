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

// Add Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => {
	c.SwaggerDoc("v1", new() {
		Title = "Pivot Sample API",
		Version = "v1",
		Description = "Simple sample demonstrating the Pivot plugin system"
	});

	var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
	var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
	if (File.Exists(xmlPath)) {
		c.IncludeXmlComments(xmlPath);
	}
});

var app = builder.Build();

// Configure middleware
if (app.Environment.IsDevelopment()) {
	app.UseDeveloperExceptionPage();
}

// Enable Swagger
app.UseSwagger();
app.UseSwaggerUI(c => {
	c.SwaggerEndpoint("/swagger/v1/swagger.json", "Pivot Sample API v1");
	c.RoutePrefix = "swagger";
});

// Map Pivot backend (includes plugin configuration)
app.MapPivotBackend();

app.Run();
