# Pivot Framework Implementation Plan

## Overview
Transform the Handover Coordinator/Proxy/Server system into a reusable Pivot framework for zero-downtime plugin hot-reload via blue-green deployment.

## Architecture Decisions

### Framework Name
**Pivot** - Represents the rotation/switching mechanism between backend instances during hot-reload.

### Project Structure
- **Location**: `apps/handover/pivot/`
- **Solution**: `Pivot.sln`
- **Projects**:
  - `Pivot.Core` - Shared models, interfaces, backend extensions
  - `Pivot.Coordinator` - Orchestration logic, backend lifecycle management
  - `Pivot.Proxy` - YARP reverse proxy with SSE client

### Key Design Principles
1. **Separate processes** for coordinator/proxy/backend for horizontal scalability
2. **Auto-detection** of executable paths (bin/Debug vs bin/Release vs published)
3. **Zero consumer burden** for coordinator URL discovery (via environment variables)
4. **Shared AssemblyLoadContext** for plugins (no isolation, full process restart)
5. **Fluent configuration** overrides appsettings.json values
6. **OpenTelemetry** integration for observability

## Implementation Steps

### Step 1: Create Pivot Solution Structure

**Create directories**:
- `apps/handover/pivot/`
- `apps/handover/pivot/Pivot.Core/`
- `apps/handover/pivot/Pivot.Coordinator/`
- `apps/handover/pivot/Pivot.Proxy/`

**Create projects**:
```bash
dotnet new sln -n Pivot -o apps/handover/pivot/
dotnet new classlib -n Pivot.Core -o apps/handover/pivot/Pivot.Core -f net9.0
dotnet new classlib -n Pivot.Coordinator -o apps/handover/pivot/Pivot.Coordinator -f net9.0
dotnet new classlib -n Pivot.Proxy -o apps/handover/pivot/Pivot.Proxy -f net9.0
dotnet sln apps/handover/pivot/Pivot.sln add apps/handover/pivot/Pivot.Core/Pivot.Core.csproj
dotnet sln apps/handover/pivot/Pivot.sln add apps/handover/pivot/Pivot.Coordinator/Pivot.Coordinator.csproj
dotnet sln apps/handover/pivot/Pivot.sln add apps/handover/pivot/Pivot.Proxy/Pivot.Proxy.csproj
```

**Add project references**:
```bash
dotnet add apps/handover/pivot/Pivot.Coordinator reference apps/handover/pivot/Pivot.Core
dotnet add apps/handover/pivot/Pivot.Proxy reference apps/handover/pivot/Pivot.Core
```

**Move plugin infrastructure**:
- Copy `server/Core/Plugin/IPlugin.cs` → `pivot/Pivot.Core/Plugin/IPlugin.cs`
- Copy `server/Core/Plugin/PluginLoader.cs` → `pivot/Pivot.Core/Plugin/PluginLoader.cs`
- Update namespaces to `Pivot.Plugin`

**Add dependencies**:
- Pivot.Core: `Microsoft.AspNetCore.App` framework reference
- Pivot.Coordinator: (none initially)
- Pivot.Proxy: `Yarp.ReverseProxy` (2.3.0)

---

### Step 2: Extract Coordinator into Pivot.Coordinator

**Create directory structure**:
- `pivot/Pivot.Coordinator/Orchestration/`
- `pivot/Pivot.Coordinator/Orchestration/Models/`
- `pivot/Pivot.Coordinator/Extensions/`

**Move files**:
- `server/Coordinator/Services/BackendOrchestrator.cs` → `pivot/Pivot.Coordinator/Orchestration/BackendOrchestrator.cs`
- `server/Coordinator/Services/BackendRegistry.cs` → `pivot/Pivot.Coordinator/Orchestration/BackendRegistry.cs`
- `server/Coordinator/Models/BackendInfo.cs` → `pivot/Pivot.Coordinator/Orchestration/Models/BackendInfo.cs`
- `server/Coordinator/Models/BackendInstance.cs` → `pivot/Pivot.Coordinator/Orchestration/Models/BackendInstance.cs`
- Delete `server/Proxy/Models/BackendInfo.cs` (duplicate)

**Update namespaces**:
- All moved files: `namespace Pivot.Orchestration;` or `namespace Pivot.Orchestration.Models;`

**Create `PivotCoordinatorOptions.cs`**:
```csharp
namespace Pivot.Orchestration;

public class PivotCoordinatorOptions {
    public int InitialPort { get; set; } = 5001;
    public int HealthCheckMaxAttempts { get; set; } = 30;
    public int HealthCheckIntervalMs { get; set; } = 500;
    public int ShutdownDrainTimeMs { get; set; } = 10000;
    public string? ServerProjectPath { get; set; }
    public string? ServerExecutablePath { get; set; }
}
```

**Create `PivotCoordinatorExtensions.cs`**:
```csharp
namespace Pivot.Extensions;

public static class PivotCoordinatorExtensions {
    public static WebApplicationBuilder AddPivotCoordinator(
        this WebApplicationBuilder builder,
        Action<PivotCoordinatorOptions>? configure = null
    ) {
        var options = new PivotCoordinatorOptions();

        // Load from appsettings first
        builder.Configuration.GetSection("BackendConfig").Bind(options);

        // Fluent config overrides
        configure?.Invoke(options);

        builder.Services.AddSingleton(options);
        builder.Services.AddSingleton<BackendRegistry>();
        builder.Services.AddSingleton<BackendOrchestrator>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<BackendOrchestrator>());

        return builder;
    }

    public static WebApplication MapPivotCoordinator(this WebApplication app) {
        var registry = app.Services.GetRequiredService<BackendRegistry>();
        var orchestrator = app.Services.GetRequiredService<BackendOrchestrator>();

        // GET /backends
        app.MapGet("/backends", async () => {
            var backends = await registry.GetAllAsync();
            return Results.Json(backends);
        });

        // GET /backends/stream (SSE)
        app.MapGet("/backends/stream", async (HttpContext context) => {
            context.Response.Headers.ContentType = "text/event-stream";
            context.Response.Headers.CacheControl = "no-cache";
            context.Response.Headers["X-Accel-Buffering"] = "no";

            try {
                await foreach (var backends in registry.WatchChangesAsync(context.RequestAborted)) {
                    var json = JsonSerializer.Serialize(backends);
                    await context.Response.WriteAsync($"data: {json}\n\n");
                    await context.Response.Body.FlushAsync();
                }
            }
            catch (OperationCanceledException) { }
        });

        // POST /reload
        app.MapPost("/reload", () => {
            _ = Task.Run(async () => await orchestrator.ReloadBackendsAsync());
            return Results.Ok(new { message = "Reload initiated" });
        });

        // GET /health
        app.MapGet("/health", () => Results.Ok(new {
            status = "healthy",
            timestamp = DateTime.UtcNow
        }));

        return app;
    }
}
```

**Update BackendOrchestrator.cs**:
- Inject `PivotCoordinatorOptions` instead of `IConfiguration`
- Update constructor to use options properties
- Implement auto-detection in `StartBackendAsync()`:
  ```csharp
  private async Task<BackendInstance> StartBackendAsync(int port, CancellationToken ct) {
      string command, args, workingDir;

      // Auto-detect executable or project
      if (!string.IsNullOrEmpty(_options.ServerExecutablePath)) {
          command = "dotnet";
          args = $"exec \"{_options.ServerExecutablePath}\" --urls=http://localhost:{port}";
          workingDir = Path.GetDirectoryName(_options.ServerExecutablePath)!;
      }
      else if (!string.IsNullOrEmpty(_options.ServerProjectPath)) {
          var binDebug = Path.Combine(
              Path.GetDirectoryName(_options.ServerProjectPath)!,
              "bin/Debug/net9.0",
              Path.GetFileNameWithoutExtension(_options.ServerProjectPath) + ".dll"
          );
          var binRelease = Path.Combine(
              Path.GetDirectoryName(_options.ServerProjectPath)!,
              "bin/Release/net9.0",
              Path.GetFileNameWithoutExtension(_options.ServerProjectPath) + ".dll"
          );

          if (File.Exists(binDebug)) {
              command = "dotnet";
              args = $"exec \"{binDebug}\" --urls=http://localhost:{port}";
              workingDir = Path.GetDirectoryName(binDebug)!;
          }
          else if (File.Exists(binRelease)) {
              command = "dotnet";
              args = $"exec \"{binRelease}\" --urls=http://localhost:{port}";
              workingDir = Path.GetDirectoryName(binRelease)!;
          }
          else {
              command = "dotnet";
              args = $"run --project \"{_options.ServerProjectPath}\" --no-launch-profile --urls=http://localhost:{port}";
              workingDir = Path.GetDirectoryName(_options.ServerProjectPath)!;
          }
      }
      else {
          throw new InvalidOperationException("Must configure ServerProjectPath or ServerExecutablePath");
      }

      // Set PIVOT_COORDINATOR_URL environment variable for backend
      var coordinatorUrl = $"http://localhost:{/* current coordinator port */}";

      var startInfo = new ProcessStartInfo {
          FileName = command,
          Arguments = args,
          WorkingDirectory = workingDir,
          UseShellExecute = false,
          CreateNoWindow = false,
          RedirectStandardOutput = true,
          RedirectStandardError = true,
      };
      startInfo.Environment["PIVOT_COORDINATOR_URL"] = coordinatorUrl;

      // ... rest of process spawning logic
  }
  ```

---

### Step 3: Extract Proxy into Pivot.Proxy

**Create directory structure**:
- `pivot/Pivot.Proxy/Services/`
- `pivot/Pivot.Proxy/Extensions/`

**Move files**:
- `server/Proxy/Services/CoordinatorClient.cs` → `pivot/Pivot.Proxy/Services/CoordinatorClient.cs`

**Update namespaces**:
- CoordinatorClient: `namespace Pivot.Proxy.Services;`
- Update using statements to reference `Pivot.Orchestration.Models`

**Add NuGet packages**:
```bash
dotnet add apps/handover/pivot/Pivot.Proxy package Yarp.ReverseProxy
```

**Create `PivotProxyOptions.cs`**:
```csharp
namespace Pivot.Proxy;

public class PivotProxyOptions {
    public string CoordinatorUrl { get; set; } = "http://localhost:5100";
}
```

**Create `PivotProxyExtensions.cs`**:
```csharp
namespace Pivot.Extensions;

public static class PivotProxyExtensions {
    public static WebApplicationBuilder AddPivotProxy(
        this WebApplicationBuilder builder,
        Action<PivotProxyOptions>? configure = null
    ) {
        var options = new PivotProxyOptions();
        builder.Configuration.GetSection("Proxy").Bind(options);
        configure?.Invoke(options);

        builder.Services.AddSingleton(options);

        // Create YARP in-memory config provider
        var inMemoryConfig = new InMemoryConfigProvider([], []);
        builder.Services.AddSingleton<IProxyConfigProvider>(inMemoryConfig);
        builder.Services.AddReverseProxy();

        // Add coordinator client
        builder.Services.AddSingleton<CoordinatorClient>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<CoordinatorClient>());

        return builder;
    }

    public static WebApplication MapPivotProxy(this WebApplication app) {
        app.MapGet("/health", () => Results.Ok(new {
            status = "healthy",
            timestamp = DateTime.UtcNow
        }));

        app.MapReverseProxy();

        return app;
    }
}
```

**Update CoordinatorClient.cs**:
- Inject `PivotProxyOptions` instead of `IConfiguration`
- Use `options.CoordinatorUrl`

---

### Step 4: Create Backend Extensions in Pivot.Core

**Create directory structure**:
- `pivot/Pivot.Core/Backend/`
- `pivot/Pivot.Core/Backend/Options/`
- `pivot/Pivot.Core/Backend/Services/`
- `pivot/Pivot.Core/Extensions/`

**Create `PivotBackendOptions.cs`**:
```csharp
namespace Pivot.Backend;

public class PivotBackendOptions {
    public string? PluginDirectory { get; set; }
    public bool EnableAutoReload { get; set; } = false;
    public bool LoadFromReferencedAssemblies { get; set; } = true;
}
```

**Complete `PluginLoader.LoadFromDirectory()`**:
```csharp
public static IReadOnlyCollection<IPlugin> LoadFromDirectory(
    string directory,
    WebApplicationBuilder builder
) {
    if (!Directory.Exists(directory)) {
        Console.WriteLine($"Plugin directory not found: {directory}");
        return Array.Empty<IPlugin>();
    }

    List<IPlugin> plugins = [];

    foreach (string dllPath in Directory.GetFiles(directory, "*.dll")) {
        try {
            // Load assembly from file
            Assembly assembly = Assembly.LoadFrom(dllPath);

            // Find IPlugin implementations
            var pluginTypes = assembly
                .GetTypes()
                .Where(t => typeof(IPlugin).IsAssignableFrom(t)
                    && !t.IsInterface
                    && !t.IsAbstract);

            foreach (var pluginType in pluginTypes) {
                try {
                    var constructor = pluginType.GetConstructor(Type.EmptyTypes);
                    if (constructor is not null) {
                        var plugin = (IPlugin)constructor.Invoke(null);
                        plugins.Add(plugin);
                        Console.WriteLine($"Loading plugin: {plugin.Name} from {Path.GetFileName(dllPath)}");
                    }
                }
                catch (Exception ex) {
                    Console.WriteLine($"Failed to instantiate plugin {pluginType.FullName}: {ex.Message}");
                }
            }
        }
        catch (Exception ex) {
            Console.WriteLine($"Failed to load assembly {dllPath}: {ex.Message}");
        }
    }

    // Store for later configuration
    builder.Services.AddSingleton(plugins as IReadOnlyCollection<IPlugin>);

    return plugins;
}
```

**Create `PluginFileWatcher.cs`**:
```csharp
namespace Pivot.Backend.Services;

public class PluginFileWatcher : BackgroundService {
    private readonly ILogger<PluginFileWatcher> _logger;
    private readonly PivotBackendOptions _options;
    private readonly string? _coordinatorUrl;
    private FileSystemWatcher? _watcher;
    private Timer? _debounceTimer;

    public PluginFileWatcher(
        ILogger<PluginFileWatcher> logger,
        PivotBackendOptions options
    ) {
        _logger = logger;
        _options = options;
        _coordinatorUrl = Environment.GetEnvironmentVariable("PIVOT_COORDINATOR_URL");
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken) {
        if (!_options.EnableAutoReload) {
            _logger.LogInformation("Plugin auto-reload is disabled");
            return Task.CompletedTask;
        }

        if (string.IsNullOrEmpty(_options.PluginDirectory)) {
            _logger.LogWarning("PluginDirectory not configured, auto-reload disabled");
            return Task.CompletedTask;
        }

        if (string.IsNullOrEmpty(_coordinatorUrl)) {
            _logger.LogWarning("PIVOT_COORDINATOR_URL not set, auto-reload disabled");
            return Task.CompletedTask;
        }

        if (!Directory.Exists(_options.PluginDirectory)) {
            _logger.LogWarning("Plugin directory does not exist: {Dir}", _options.PluginDirectory);
            return Task.CompletedTask;
        }

        _logger.LogInformation("Watching plugin directory: {Dir}", _options.PluginDirectory);

        _watcher = new FileSystemWatcher(_options.PluginDirectory, "*.dll") {
            NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName,
            EnableRaisingEvents = true
        };

        _watcher.Changed += OnPluginChanged;
        _watcher.Created += OnPluginChanged;
        _watcher.Deleted += OnPluginChanged;
        _watcher.Renamed += OnPluginChanged;

        return Task.CompletedTask;
    }

    private void OnPluginChanged(object sender, FileSystemEventArgs e) {
        _logger.LogInformation("Plugin change detected: {File}", e.Name);

        // Debounce changes (500ms)
        _debounceTimer?.Dispose();
        _debounceTimer = new Timer(_ => TriggerReload(), null, 500, Timeout.Infinite);
    }

    private async void TriggerReload() {
        try {
            _logger.LogInformation("Triggering reload via coordinator: {Url}", _coordinatorUrl);

            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var response = await client.PostAsync($"{_coordinatorUrl}/reload", null);

            if (response.IsSuccessStatusCode) {
                _logger.LogInformation("Reload triggered successfully");
            }
            else {
                _logger.LogWarning("Failed to trigger reload: {Status}", response.StatusCode);
            }
        }
        catch (Exception ex) {
            _logger.LogError(ex, "Error triggering reload");
        }
    }

    public override void Dispose() {
        _watcher?.Dispose();
        _debounceTimer?.Dispose();
        base.Dispose();
    }
}
```

**Create `PivotBackendExtensions.cs`**:
```csharp
namespace Pivot.Extensions;

public static class PivotBackendExtensions {
    public static WebApplicationBuilder AddPivotBackend(
        this WebApplicationBuilder builder,
        Action<PivotBackendOptions>? configure = null
    ) {
        var options = new PivotBackendOptions();
        builder.Configuration.GetSection("Pivot:Backend").Bind(options);
        configure?.Invoke(options);

        builder.Services.AddSingleton(options);

        // Load plugins based on configuration
        IReadOnlyCollection<IPlugin>? plugins = null;

        if (options.LoadFromReferencedAssemblies) {
            plugins = PluginLoader.LoadFromReferencedAssemblies(builder);
        }
        else if (!string.IsNullOrEmpty(options.PluginDirectory)) {
            plugins = PluginLoader.LoadFromDirectory(options.PluginDirectory, builder);
        }

        // Initialize plugins
        if (plugins != null) {
            foreach (var plugin in plugins) {
                try {
                    _logger.LogInformation("Initializing plugin: {Name}", plugin.Name);
                    plugin.Initialize(builder);
                }
                catch (Exception ex) {
                    _logger.LogError(ex, "Error initializing plugin {Name}", plugin.Name);
                }
            }
        }

        // Add file watcher if enabled
        if (options.EnableAutoReload) {
            builder.Services.AddHostedService<PluginFileWatcher>();
        }

        // Add health checks
        builder.Services.AddHealthChecks();

        return builder;
    }

    public static WebApplication MapPivotBackend(this WebApplication app) {
        var plugins = app.Services.GetService<IReadOnlyCollection<IPlugin>>();

        // Configure plugins
        if (plugins != null) {
            foreach (var plugin in plugins) {
                try {
                    _logger.LogInformation("Configuring plugin: {Name}", plugin.Name);
                    plugin.Configure(app);
                }
                catch (Exception ex) {
                    _logger.LogError(ex, "Error configuring plugin {Name}", plugin.Name);
                }
            }
        }

        // Map health check
        app.MapHealthChecks("/health");

        return app;
    }
}
```

---

### Step 5: Add OpenTelemetry Instrumentation

**Add NuGet packages to all Pivot projects**:
```bash
dotnet add apps/handover/pivot/Pivot.Core package OpenTelemetry.Extensions.Hosting
dotnet add apps/handover/pivot/Pivot.Core package OpenTelemetry.Instrumentation.AspNetCore
dotnet add apps/handover/pivot/Pivot.Coordinator package OpenTelemetry.Extensions.Hosting
dotnet add apps/handover/pivot/Pivot.Proxy package OpenTelemetry.Extensions.Hosting
```

**Update BackendOrchestrator.cs**:
```csharp
using System.Diagnostics;

public class BackendOrchestrator : BackgroundService {
    private static readonly ActivitySource ActivitySource = new("Pivot.Orchestration");

    public async Task<bool> ReloadBackendsAsync() {
        using var activity = ActivitySource.StartActivity("ReloadBackends");
        var startTime = DateTime.UtcNow;

        try {
            // ... existing reload logic

            activity?.SetTag("reload.success", true);
            activity?.SetTag("reload.duration_ms", (DateTime.UtcNow - startTime).TotalMilliseconds);

            return true;
        }
        catch (Exception ex) {
            activity?.SetTag("reload.success", false);
            activity?.SetTag("error.message", ex.Message);
            throw;
        }
    }

    private async Task<BackendInstance> StartBackendAsync(int port, CancellationToken ct) {
        using var activity = ActivitySource.StartActivity("StartBackend");
        activity?.SetTag("backend.port", port);

        // ... existing logic
    }

    private async Task<bool> WaitForHealthyAsync(BackendInstance backend) {
        using var activity = ActivitySource.StartActivity("HealthCheck");
        activity?.SetTag("backend.port", backend.Info.Port);

        int attempts = 0;
        // ... existing logic

        activity?.SetTag("health.attempts", attempts);
        activity?.SetTag("health.success", success);

        return success;
    }
}
```

**Update CoordinatorClient.cs**:
```csharp
using System.Diagnostics;

public class CoordinatorClient : BackgroundService {
    private static readonly ActivitySource ActivitySource = new("Pivot.Proxy");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
        using var activity = ActivitySource.StartActivity("ConnectToCoordinator");

        // ... existing connection logic
    }

    private async Task UpdateProxyConfigAsync(List<BackendInfo> backends) {
        using var activity = ActivitySource.StartActivity("UpdateProxyConfig");
        activity?.SetTag("backends.count", backends.Count);

        // ... existing logic
    }
}
```

---

### Step 6: Update Handover to Consume Pivot

**Update server/Coordinator/Coordinator.csproj**:
```xml
<ItemGroup>
  <ProjectReference Include="..\..\pivot\Pivot.Coordinator\Pivot.Coordinator.csproj" />
</ItemGroup>
```

**Update server/Coordinator/Program.cs**:
```csharp
using Pivot.Extensions;

var builder = WebApplication.CreateSlimBuilder(args);

builder.AddPivotCoordinator(options => {
    options.ServerProjectPath = "../Server/Server.csproj";
});

var app = builder.Build();
app.UseCors();
app.MapPivotCoordinator();
app.Run();
```

**Update server/Proxy/Proxy.csproj**:
```xml
<ItemGroup>
  <ProjectReference Include="..\..\pivot\Pivot.Proxy\Pivot.Proxy.csproj" />
</ItemGroup>
```

**Update server/Proxy/Program.cs**:
```csharp
using Pivot.Extensions;

var builder = WebApplication.CreateSlimBuilder(args);

builder.AddPivotProxy(options => {
    options.CoordinatorUrl = "http://localhost:5100";
});

var app = builder.Build();
app.MapPivotProxy();
app.Run();
```

**Update server/Server/Server.csproj**:
```xml
<ItemGroup>
  <ProjectReference Include="..\..\pivot\Pivot.Core\Pivot.Core.csproj" />
</ItemGroup>
```

**Update server/Server/Program.cs**:
```csharp
using Pivot.Extensions;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment()) {
    builder.Services.AddOpenApi();
}

builder.AddPivotBackend(options => {
    options.LoadFromReferencedAssemblies = builder.Environment.IsDevelopment();
    options.PluginDirectory = Path.Combine(AppContext.BaseDirectory, "plugins");
    options.EnableAutoReload = builder.Environment.IsDevelopment();
});

var app = builder.Build();

app.MapPivotBackend();

if (app.Environment.IsDevelopment()) {
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Demo endpoints
app.MapGet("/", () => Results.Ok(new {
    message = "Backend server running",
    port = Environment.GetEnvironmentVariable("ASPNETCORE_URLS"),
    timestamp = DateTime.UtcNow
}));

app.MapGet("/shutdown", () => {
    _ = Task.Run(async () => {
        await app.StopAsync();
        Environment.Exit(0);
    });
    return Results.Ok("Shutting down...");
});

app.Run();
```

**Run integration tests**:
```bash
cd apps/handover/server/IntegrationTests
dotnet test
```

---

## Success Criteria

1. ✅ Pivot solution builds successfully
2. ✅ Handover Coordinator/Proxy/Server run with 3-line Program.cs implementations
3. ✅ All integration tests pass
4. ✅ Plugin hot-reload works via file watcher
5. ✅ Blue-green deployment maintains zero downtime
6. ✅ OpenTelemetry activities traced for reload operations

## Future Enhancements

- NuGet packaging (Pivot.Core, Pivot.Coordinator, Pivot.Proxy)
- Docker/Kubernetes deployment support
- Coordinator HA with standby replica
- Plugin dependency versioning
- Configuration UI/dashboard
