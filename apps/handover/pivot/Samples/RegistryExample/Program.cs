using Pivot.Registry.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to listen on port 5100
builder.WebHost.ConfigureKestrel(options => {
	options.ListenLocalhost(5100);
});

// Add Pivot Registry services (includes Blazor)
builder.AddPivotRegistry(options => {
	options.Enabled = true;
	options.ApplicationName = "RegistryExample";
	options.StorageProvider = "FileSystem";
});

var app = builder.Build();

// Initialize and map Pivot Registry (includes Blazor components)
await app.MapPivotRegistry();

app.Run();
