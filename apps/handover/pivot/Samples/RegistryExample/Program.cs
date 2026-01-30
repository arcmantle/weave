using Pivot.Registry.Extensions;


var builder = WebApplication.CreateBuilder(args);

// Add Pivot Registry services (includes Lit-based client)
builder.AddPivotRegistry(options => {
	options.Enabled = true;
	options.ApplicationName = "RegistryExample";
	options.StorageProvider = "FileSystem";
});

var app = builder.Build();

// Initialize and map Pivot Registry (includes Lit client and API)
await app.MapPivotRegistry();

app.Run();
