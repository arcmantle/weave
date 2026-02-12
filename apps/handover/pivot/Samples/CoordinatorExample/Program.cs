using Pivot.Coordinator.Extensions;
using Pivot.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Configure cross-platform application data paths
var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
var appName = builder.Configuration.GetValue<string>("ApplicationName") ?? "CoordinatorExample";
var coordinatorDataDir = Path.Combine(appDataPath, "Pivot", "Coordinators", appName);
Directory.CreateDirectory(coordinatorDataDir);

// Add plugin management (admin UI without backend orchestration for now)
builder.AddPluginManagement(options => {
	options.Enabled = true;
	options.PluginRepositoryDirectory = Path.Combine(coordinatorDataDir, "plugin-repository");
	options.ActivePluginsDirectory = Path.Combine(coordinatorDataDir, "active-plugins");
	options.ConnectionString = $"Data Source={Path.Combine(coordinatorDataDir, "coordinator.db")}";
	options.RecentlyModifiedWindowMinutes = 5;
});

var app = builder.Build();

// Map plugin management endpoints and UI
await app.MapPluginManagement();

// Initialize plugin states from repository (this happens in background)
_ = Task.Run(async () => await app.InitializePluginStatesAsync());

app.Run();
