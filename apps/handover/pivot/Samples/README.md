# Pivot Framework - Sample Applications

This folder contains example applications demonstrating how to use the Pivot framework to build a distributed plugin-based system.

## Architecture Overview

The Pivot framework provides three main components as **libraries** that you integrate into your own applications:

```
┌─────────────────┐
│   Your Proxy    │  ← Uses Pivot.Proxy library
│  (port 8080)    │
└────────┬────────┘
         │ Routes traffic to healthy backends
         ↓
┌─────────────────┐
│ Your Coordinator│  ← Uses Pivot.Coordinator library
│  (port 5000)    │     - Manages plugins
└────────┬────────┘     - Orchestrates backends
         │              - Provides admin UI
         │
         ↓ Spawns and manages
┌─────────────────┐
│  Your Backend   │  ← Uses Pivot.Core library
│  (port 5001+)   │     - Loads plugins
└─────────────────┘     - Serves APIs
```

## Sample Projects

### 1. [CoordinatorExample](CoordinatorExample/) - Plugin Management & Orchestration
**Purpose**: Demonstrates how to build a Coordinator application

**What it does**:
- Provides web UI at http://localhost:5000 for plugin management
- Manages plugin enable/disable state in SQLite database
- Orchestrates backend instances with blue-green deployment
- Triggers backend reloads when plugins change
- Integrates with Pivot.Registry for plugin installation

**Key Features**:
- Admin UI for plugin management
- Database-backed plugin state
- Backend lifecycle management
- SSE events for real-time updates

**Run it**:
```bash
cd CoordinatorExample
dotnet run
# Navigate to http://localhost:5000
```

### 2. [ProxyExample](ProxyExample/) - Load Balancer & Gateway
**Purpose**: Demonstrates how to build a Proxy application

**What it does**:
- Routes all API traffic to healthy backend instances
- Performs continuous health checks
- Automatically switches traffic during deployments
- Queries Coordinator for backend discovery

**Key Features**:
- YARP reverse proxy integration
- Health-based routing
- Zero-downtime deployments
- Auto-discovery of backends

**Run it**:
```bash
cd ProxyExample
dotnet run
# Make requests to http://localhost:8080
```

### 3. [ApiExample](ApiExample/) - Backend Server
**Purpose**: Demonstrates how to build a Backend application (renamed from ApiExample for clarity)

**What it does**:
- Loads plugin DLLs from directory
- Resolves plugin dependencies
- Hosts APIs defined by plugins
- Auto-reloads on plugin changes (dev mode)

**Key Features**:
- Dynamic plugin loading
- Dependency resolution
- Hot reload support
- Health endpoint for proxy

**Run it**:
```bash
cd ApiExample
dotnet run
# Backend starts on http://localhost:5010
```

### 4. [Plugins](Plugins/) - Sample Plugin Implementations
Example plugins demonstrating the plugin interface:
- **WeatherPlugin**: Sample weather forecast API
- **TodosPlugin**: Simple todo list API
- **UsersPlugin**: User management API

## Complete System Walkthrough

### Step 1: Start the Coordinator
```bash
cd CoordinatorExample
dotnet run
```
- Admin UI available at http://localhost:5000
- Manages plugin state and backend instances

### Step 2: Start the Proxy
```bash
cd ProxyExample
dotnet run
```
- API gateway available at http://localhost:8080
- Routes to healthy backends

### Step 3: Backend Auto-Start (via Coordinator)
The Coordinator automatically spawns backend instances! No manual start needed.

### Step 4: Manage Plugins via UI
1. Navigate to http://localhost:5000
2. See installed plugins
3. Enable/disable plugins
4. Click "Deploy Plugins" to copy to active directory
5. Click "Reload Backends" to trigger deployment

### Step 5: Make API Requests
```bash
# Requests go through proxy → backend
curl http://localhost:8080/api/weather
curl http://localhost:8080/api/todos
```

### Step 6: Install from Registry (Optional)
If Pivot.Registry is running:
1. Go to "Plugin Registry" tab in Coordinator UI
2. Enter registry URL: http://localhost:5100
3. Browse and install plugins
4. Enable and deploy as usual

## Development Workflows

### Plugin Development Workflow
1. Create plugin project implementing `IPlugin`
2. Add project reference to Backend project
3. Set `LoadFromReferencedAssemblies = true` in Backend
4. Full IntelliSense and debugging support
5. When ready for production, build plugin DLL and copy to `plugins/` directory

### Plugin Distribution Workflow
1. Build plugin as DLL with manifest.json
2. Package as .pivotpkg (zip with /client/ and /server/)
3. Publish to Pivot.Registry
4. Install via Coordinator UI
5. Enable and deploy

### Blue-Green Deployment Workflow
1. Update plugin in `plugin-repository/`
2. Coordinator marks it as recently modified
3. Click "Deploy Plugins" in UI
4. Click "Reload Backends"
5. Coordinator spawns new backend with updated plugins
6. New backend starts, loads plugins
7. Proxy health-checks new backend
8. Proxy switches traffic to new backend
9. Coordinator shuts down old backend
10. If new backend fails, Coordinator disables recently modified plugins and retries

## Port Configuration

Default ports used by samples:

| Component   | Port | URL |
|-------------|------|-----|
| Coordinator | 5000 | http://localhost:5000 |
| Proxy       | 8080 | http://localhost:8080 |
| Backend 1   | 5001 | http://localhost:5001 |
| Backend 2   | 5002 | http://localhost:5002 |
| Registry    | 5100 | http://localhost:5100 |

## Plugin Package Format (.pivotpkg)

Pivot plugins are distributed as `.pivotpkg` files (ZIP archives):

```
my-plugin.pivotpkg
├── client/
│   ├── components/
│   ├── styles/
│   └── index.js
├── server/
│   ├── MyPlugin.dll
│   └── plugin.json
└── README.md (optional)
```

## Creating Your Own Applications

### Your Coordinator App
```csharp
var builder = WebApplication.CreateBuilder(args);
builder.AddPluginManagement(options => {
    options.PluginRepositoryDirectory = "plugin-repository";
    options.ActivePluginsDirectory = "active-plugins";
});
var app = builder.Build();
app.MapPluginManagement();
await app.InitializePluginStatesAsync();
app.Run();
```

### Your Proxy App
```csharp
var builder = WebApplication.CreateBuilder(args);
builder.AddPivotProxy(options => {
    options.CoordinatorUrl = "http://localhost:5000";
});
var app = builder.Build();
app.MapPivotProxy();
app.Run();
```

### Your Backend App
```csharp
var builder = WebApplication.CreateBuilder(args);
builder.AddPivotBackend(options => {
    options.PluginDirectory = "plugins";
    options.EnableAutoReload = true;
});
var app = builder.Build();
app.MapPivotBackend();
app.Run();
```

## See Also

- [Pivot.Registry](../Pivot.Registry/README.md) - Plugin repository service
- [Main README](../README.md) - Pivot framework overview
- [QUICK_START.md](../QUICK_START.md) - 5-minute getting started guide
