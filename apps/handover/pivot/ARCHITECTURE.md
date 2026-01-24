# Pivot Framework Architecture

## Overview

Pivot is a zero-downtime hot-reload framework for ASP.NET Core applications with plugin support. It enables blue-green deployments with automatic backend lifecycle management.

## Architecture Diagram

```txt
┌────────────────────────────────────────────────────────────-─┐
│                       USER TRAFFIC                           │
│                            ↓                                 │
│                      HTTP Requests                           │
└─────────────────────────────────────────────────────────────-┘
                             ↓
┌────────────────────────────────────────────────────────────-─┐
│  PROXY (port 5000) - Your Application's Main Entrypoint      │
│  • Receives all user traffic                                 │
│  • Uses YARP reverse proxy                                   │
│  • Connects to Coordinator via SSE stream                    │
│  • Dynamically routes traffic to healthy backends            │
└─────────────────────────────────────────────────────────────-┘
                             ↓
         ┌──────────────────────────────────────┐
         ↓                                      ↓
┌────────────────────┐              ┌────────────────────┐
│ Backend Instance 1 │              │ Backend Instance 2 │
│   (port 5001)      │              │   (port 5002)      │
│ • Actual Server    │              │ • Actual Server    │
│ • Loads plugins    │              │ • Loads plugins    │
│ • Has your API     │              │ • Has your API     │
└────────────────────┘              └────────────────────┘
         ↑                                      ↑
         └──────────────────┬───────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  COORDINATOR (port 5100) - Backend Lifecycle Manager        │
│  • Spawns new Server instances on different ports           │
│  • Monitors health of all backends                          │
│  • Tells Proxy which backends are available (via SSE)       │
│  • Handles blue-green deployment:                           │
│    1. Starts new backend (port 5002)                        │
│    2. Waits for health check to pass                        │
│    3. Tells Proxy to add new backend to pool                │
│    4. Drains traffic from old backend                       │
│    5. Shuts down old backend (port 5001)                    │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Coordinator

**Purpose**: Manages the lifecycle of backend server instances.

**Responsibilities**:
- Spawns backend processes on unique ports (5001, 5002, 5003...)
- Performs health checks on all backend instances
- Broadcasts backend availability to Proxy instances via Server-Sent Events (SSE)
- Orchestrates blue-green deployments with zero downtime
- Auto-detects whether to run backends via `dotnet run` or execute compiled DLLs

**Configuration**:

```csharp
builder.AddPivotCoordinator(options => {
    options.ServerProjectPath = "../Server/Server.csproj";
    options.InitialPort = 5001;
    options.HealthCheckMaxAttempts = 30;
    options.HealthCheckIntervalMs = 500;
    options.TrafficDrainDelayMs = 5000;
});
```

**Key Endpoints**:

- `GET /backends` - Returns current list of healthy backends
- `GET /backends/stream` - SSE stream of backend changes
- `POST /reload` - Triggers blue-green deployment

### Proxy

**Purpose**: Public-facing reverse proxy that routes traffic to healthy backends.

**Responsibilities**:

- Receives all incoming user traffic
- Maintains persistent SSE connection to Coordinator
- Dynamically updates YARP routing configuration based on backend availability
- Load balances requests across multiple backend instances
- Performs active health checks on backends

**Configuration**:

```csharp
builder.AddPivotProxy(options => {
    options.CoordinatorUrl = "http://localhost:5100";
});
```

**Scalability**: You can run multiple Proxy instances (e.g., behind a load balancer). Each connects to the same Coordinator and receives the same backend pool updates.

### Backend (Server)

**Purpose**: Your actual application with business logic and plugins.

**Responsibilities**:

- Hosts your application endpoints and plugins
- Loads plugins from referenced assemblies (dev) or plugin directory (production)
- Watches plugin directory for changes and triggers reloads
- Registers with Coordinator via environment variable `PIVOT_COORDINATOR_URL`

**Configuration**:

```csharp
builder.AddPivotBackend(options => {
    options.LoadFromReferencedAssemblies = builder.Environment.IsDevelopment();
    options.PluginDirectory = Path.Combine(AppContext.BaseDirectory, "plugins");
    options.EnableAutoReload = builder.Environment.IsDevelopment();
    options.WatchDebounceMs = 500;
});
```

**Process Isolation**: Each backend instance runs as a separate process, providing true isolation and enabling:

- Hot reload without affecting running requests
- Clean plugin assembly unloading
- Horizontal scaling across multiple machines

## Blue-Green Deployment Flow

### Initial State

- Backend Instance 1 running on port 5001 (GREEN)
- Proxy routing all traffic to 5001

### Reload Triggered

1. **New Backend Startup**
   - Coordinator spawns Backend Instance 2 on port 5002 (BLUE)
   - Sets `PIVOT_COORDINATOR_URL` environment variable

2. **Health Check**
   - Coordinator polls `http://localhost:5002/health`
   - Waits up to 30 attempts (15 seconds by default)
   - New backend loads plugins and becomes healthy

3. **Traffic Transition**
   - Coordinator notifies Proxy via SSE: "Add backend 5002"
   - Proxy updates YARP configuration to include both 5001 and 5002
   - YARP begins load balancing between both instances

4. **Drain Period**
   - Wait 5 seconds (configurable) for in-flight requests to complete
   - New requests primarily go to new backend

5. **Old Backend Shutdown**
   - Coordinator sends shutdown signal to Backend Instance 1
   - Coordinator notifies Proxy: "Remove backend 5001"
   - Proxy updates YARP configuration to only route to 5002

### Final State

- Backend Instance 2 running on port 5002 (now GREEN)
- Proxy routing all traffic to 5002
- Backend Instance 1 terminated

**Result**: Zero user-facing downtime, seamless plugin reload.

## Plugin System

### Plugin Interface

```csharp
namespace Pivot.Plugin;

public interface IPlugin
{
    string Name { get; }
    void Initialize(WebApplicationBuilder builder);
    void Configure(WebApplication app);
}
```

### Plugin Loading Strategies

**Development Mode** (`LoadFromReferencedAssemblies = true`):

- Scans all referenced assemblies
- Finds types implementing `IPlugin`
- No file copying needed
- Fast iteration

**Production Mode** (`LoadFromDirectory`):

- Loads plugins from specified directory
- Uses `Assembly.LoadFrom` for shared context
- Enables runtime plugin deployment
- All plugins share dependency resolution

### Plugin Repository Architecture

For production deployments, Pivot supports a **plugin repository** pattern that separates plugin storage from deployment:

- **Plugin Repository Directory**: Central storage for all available plugins (source of truth)
- **Active Plugins Directory**: Contains only enabled plugins that should be loaded
- **Plugin State Provider**: Database or other mechanism tracking enabled/disabled state
- **Deployment Manager**: Copies enabled plugins from repository to active directory

**Architecture Flow**:

```
plugin-repository/     →  [Plugin Deployment]  →  active-plugins/  →  [Blue-Green Deploy]  →  Backend Instance
(all plugins)             (based on state)        (enabled only)         (Coordinator)           (loads plugins)
```

This enables:

- Dynamic plugin enabling/disabling without modifying source files
- Selective deployment of only required plugins
- Integration with blue-green deployments for zero-downtime updates
- Database-backed audit trail of plugin state changes

See [PLUGIN_REPOSITORY.md](PLUGIN_REPOSITORY.md) for detailed documentation and examples.

### Plugin Management System (Optional)

The Coordinator can host an **optional plugin management UI** that provides:

- **Web-based Admin Panel**: Manage plugins from any browser
- **Survives Backend Failures**: Always accessible, even when backends crash
- **Auto-Recovery**: Automatically disables recently modified plugins when backends fail
- **Real-Time Updates**: SSE-powered live UI showing plugin states
- **Centralized Control**: Single source of truth for all backend instances

**Key benefit**: If a bad plugin causes backend startup to fail, the admin panel (running in the Coordinator) remains accessible, allowing you to disable the problematic plugin and trigger a new deployment.

See [PLUGIN_MANAGEMENT.md](PLUGIN_MANAGEMENT.md) for setup and usage guide.

### Auto-Reload

When `EnableAutoReload = true`:

- `FileSystemWatcher` monitors plugin directory
- 500ms debounce prevents multiple reloads
- On change detection, backend POSTs to `{PIVOT_COORDINATOR_URL}/reload`
- Coordinator initiates blue-green deployment
- New process loads updated plugin code

## Communication

### Coordinator → Proxy (SSE)

Server-Sent Events stream at `/backends/stream`:

```txt
data: [{"port":5001,"address":"http://localhost:5001","status":"healthy"}]

data: [{"port":5001,"address":"http://localhost:5001","status":"healthy"},{"port":5002,"address":"http://localhost:5002","status":"healthy"}]

data: [{"port":5002,"address":"http://localhost:5002","status":"healthy"}]
```

Proxy automatically reconnects if connection drops.

### Backend → Coordinator

Backend discovers Coordinator via `PIVOT_COORDINATOR_URL` environment variable set during process spawn. Used for:

- Auto-reload triggers (`POST {url}/reload`)
- Future: Telemetry, metrics, custom health reporting

## Observability

### Activity Tracing

**Coordinator**:

- `ActivitySource("Pivot.Orchestration")`
- Activities: `ReloadBackends`, `StartBackend`, `HealthCheck`
- Tags: `backend.port`, `reload.success`, `health.attempts`, error details

**Proxy**:

- `ActivitySource("Pivot.Proxy")`
- Activities: `CoordinatorConnection`, `UpdateProxyConfig`
- Events: `ConnectionAttempt`, `Connected`, `StreamEnded`, `BackendConfigured`

### Structured Logging

All components emit structured logs with consistent context:

- Backend port numbers
- Deployment timing
- Health check attempts
- Connection status

## Design Decisions

### Why Separate Processes?

**Alternatives Considered**:

- Embedded orchestration (single process)
- Thread-based isolation
- AppDomain isolation (deprecated)

**Chosen Approach**: Separate processes

- **True Isolation**: Assembly unloading guaranteed
- **Scalability**: Can distribute across machines
- **Reliability**: One backend crash doesn't affect others
- **Simplicity**: OS handles resource cleanup

### Why YARP?

- Microsoft-maintained reverse proxy for .NET
- Dynamic configuration updates without restart
- Built-in health checks and load balancing
- Minimal overhead, high performance

### Why SSE Instead of Polling?

- Real-time updates (< 100ms latency)
- Reduced network overhead
- Simple HTTP-based (no WebSocket complexity)
- Auto-reconnect built into HTTP clients

## Usage Example

### Coordinator (port 5100)

```csharp
var builder = WebApplication.CreateSlimBuilder(args);
builder.AddPivotCoordinator(options => {
    options.ServerProjectPath = "../Server/Server.csproj";
});
var app = builder.Build();
app.MapPivotCoordinator();
app.Run();
```

### Proxy (port 5000)

```csharp
var builder = WebApplication.CreateSlimBuilder(args);
builder.AddPivotProxy(options => {
    options.CoordinatorUrl = "http://localhost:5100";
});
var app = builder.Build();
app.MapPivotProxy();
app.Run();
```

### Backend Server

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.AddPivotBackend(options => {
    options.LoadFromReferencedAssemblies = builder.Environment.IsDevelopment();
    options.EnableAutoReload = builder.Environment.IsDevelopment();
});
var app = builder.Build();
app.MapPivotBackend();
app.MapGet("/", () => "Hello from Backend!");
app.Run();
```

### Plugin

```csharp
using Pivot.Plugin;

public class UsersPlugin : IPlugin
{
    public void Register(WebApplication app)
    {
        app.MapGet("/users", () => new[] { "Alice", "Bob" });
    }
}
```

## Development Workflow

1. **Start Coordinator**: `cd Coordinator && dotnet run`
2. **Start Proxy**: `cd Proxy && dotnet run`
3. **Access App**: Navigate to `http://localhost:5000`
4. **Edit Plugin Code**: Modify plugin files
5. **Auto-Reload**: FileSystemWatcher triggers blue-green deployment
6. **See Changes**: Refresh browser, new code is live (no downtime)

## Production Deployment

1. Build all projects: `dotnet build -c Release`
2. Copy plugin DLLs to Server's `plugins/` directory
3. Start Coordinator (spawns backends automatically)
4. Start Proxy (connects to Coordinator)
5. Update plugins by copying new DLLs to directory
6. Trigger reload: `POST http://localhost:5100/reload`

## Configuration Reference

### PivotCoordinatorOptions

- `ServerProjectPath` - Path to .csproj or .dll
- `InitialPort` - First backend port (default: 5001)
- `HealthCheckMaxAttempts` - Max health check tries (default: 30)
- `HealthCheckIntervalMs` - Delay between checks (default: 500)
- `TrafficDrainDelayMs` - Drain period before shutdown (default: 5000)

### PivotProxyOptions

- `CoordinatorUrl` - Coordinator base URL (e.g., "http://localhost:5100")

### PivotBackendOptions

- `LoadFromReferencedAssemblies` - Scan project references (default: false)
- `PluginDirectory` - Directory to load plugin DLLs from (optional)
- `EnableAutoReload` - Watch plugins and trigger reload (default: false)
- `WatchDebounceMs` - File change debounce delay (default: 500)

## Future Enhancements

- **Metrics Collection**: Expose Prometheus-compatible metrics
- **Multi-Region**: Support for distributed Coordinator instances
- **A/B Testing**: Route specific traffic to specific backend versions
- **Canary Deployments**: Gradual traffic shifting (5% → 50% → 100%)
- **Plugin Isolation**: Per-plugin AssemblyLoadContext for true isolation
- **Configuration Hot-Reload**: Reload appsettings.json without restart
