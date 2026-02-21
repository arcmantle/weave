using Pivot.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Add Pivot Proxy with YARP reverse proxy
builder.AddPivotProxy(options => {
	options.CoordinatorUrl = "http://localhost:5000";
});

var app = builder.Build();

// Map Pivot Proxy (YARP configuration)
app.MapPivotProxy();

app.Run();
