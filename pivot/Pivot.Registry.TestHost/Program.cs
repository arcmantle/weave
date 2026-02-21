using Pivot.Registry.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Add Pivot Registry
builder.AddPivotRegistry();

var app = builder.Build();

// Map Pivot Registry endpoints
await app.MapPivotRegistry();

app.Run();
