using Proxy.Services;
using Yarp.ReverseProxy.Configuration;


var builder = WebApplication.CreateSlimBuilder(args);

// Create in-memory config provider for dynamic updates
var inMemoryConfig = new InMemoryConfigProvider([], []);

builder.Services
	.AddSingleton<IProxyConfigProvider>(inMemoryConfig)
	.AddReverseProxy();

// Add the coordinator client service
builder.Services.AddSingleton<CoordinatorClient>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<CoordinatorClient>());

var app = builder.Build();

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new {
	status = "healthy",
	timestamp = DateTime.UtcNow
}));

app.MapReverseProxy();

app.Run();
