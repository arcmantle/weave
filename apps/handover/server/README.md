# Handover - Plugin-Based Hot-Reload Architecture

A zero-downtime backend system with plugin extensibility using a coordinator-proxy pattern.

## Architecture Overview

```
[Load Balancer] (optional)
     ├─> [Proxy Instance 1] ───┐
     ├─> [Proxy Instance 2] ───┼─> Listen to Coordinator via SSE
     └─> [Proxy Instance 3] ───┘

[Coordinator] (single instance)
     ├─> Manages Backend Pool
     ├─> Handles Reload Requests
     └─> Broadcasts Updates via SSE

[Backend Instances] (managed by Coordinator)
     ├─> Backend on port 5001 (active)
     └─> Backend on port 5002 (during reload)
```

## Components

### 1. **Coordinator** (Port 5100)
- Manages backend instance lifecycle
- Exposes REST API + Server-Sent Events for coordination
- Handles zero-downtime reloads

**Endpoints:**
- `GET /backends` - Get current backend list
- `GET /backends/stream` - SSE stream of backend updates
- `POST /reload` - Trigger plugin reload
- `GET /health` - Health check

### 2. **Proxy** (Port 5000+)
- Horizontally scalable reverse proxy using YARP
- Connects to Coordinator via SSE for real-time config updates
- Automatically routes traffic to healthy backends

### 3. **Server** (Port 5001+)
- Your application with plugin support
- Loads plugins dynamically on startup
- Provides `/health` and `/shutdown` endpoints

### 4. **Plugins**
- Drop-in feature modules implementing `IPlugin`
- Can register services and configure endpoints
- Loaded from `/plugins` directory in production

## Running the System

### Development Mode

1. **Start Coordinator:**
```bash
cd Coordinator
dotnet run
# Runs on http://localhost:5100
```

2. **Start Proxy:**
```bash
cd Proxy
dotnet run
# Runs on http://localhost:5000
```

The Coordinator will automatically start the first backend instance.

### Triggering a Plugin Reload

```bash
# Add/update plugins in Server/bin/Debug/net9.0/plugins/
curl -X POST http://localhost:5100/reload
```

The Coordinator will:
1. Start new backend on next available port
2. Wait for health checks to pass
3. Add new backend to pool (proxies auto-update via SSE)
4. Wait 10 seconds for request draining
5. Remove old backend from pool
6. Gracefully shutdown old backend

### Load Balanced Deployment

Run multiple proxy instances:

```bash
# Terminal 1
cd Proxy
dotnet run --urls=http://localhost:5000

# Terminal 2
cd Proxy
dotnet run --urls=http://localhost:5001

# Terminal 3
cd Proxy
dotnet run --urls=http://localhost:5002
```

All proxies will:
- Connect to the Coordinator
- Receive real-time backend updates via SSE
- Automatically route to healthy backends
- Perform active health checks

Point your load balancer to all proxy instances.

## Configuration

### Coordinator (appsettings.json)
```json
{
  "BackendConfig": {
    "InitialPort": 5001,
    "HealthCheckMaxAttempts": 30,
    "HealthCheckIntervalMs": 500,
    "ShutdownDrainTimeMs": 10000
  }
}
```

### Proxy (appsettings.json)
```json
{
  "CoordinatorUrl": "http://localhost:5100"
}
```

## How It Works

### Zero-Downtime Reload Flow

1. **Before Reload:**
   - Proxy routes to Backend A (port 5001)

2. **POST /reload triggered:**
   - Coordinator starts Backend B (port 5002)
   - Waits for Backend B health checks

3. **Both backends active:**
   - Proxy receives SSE update with both backends
   - Proxy routes to both backends (load balanced)

4. **After drain period:**
   - Coordinator removes Backend A from pool
   - Proxy receives SSE update (only Backend B)
   - Coordinator shuts down Backend A

5. **Reload complete:**
   - Proxy routes to Backend B only
   - Ready for next reload

### Server-Sent Events (SSE)

Proxies maintain a persistent HTTP connection to `/backends/stream`:

```
# Coordinator sends:
data: [{"address":"http://localhost:5001","port":5001,"startedAt":"...","status":"healthy"}]

data: [{"address":"http://localhost:5001","port":5001,...},{"address":"http://localhost:5002","port":5002,...}]

data: [{"address":"http://localhost:5002","port":5002,...}]
```

Proxies instantly update YARP configuration on each event.

## Plugin Development

Create a new plugin project:

```bash
cd Plugins
dotnet new classlib -n MyFeature
dotnet add MyFeature reference ../Core
```

Implement the plugin:

```csharp
using Core.Plugin;

public class MyFeaturePlugin : IPlugin {
    public string Name => "MyFeature";

    public void Initialize(WebApplicationBuilder builder) {
        // Register services
        builder.Services.AddScoped<IMyService, MyService>();
    }

    public void Configure(WebApplication app) {
        // Configure endpoints
        app.MapGet("/my-feature", () => "Hello from MyFeature!");
    }
}
```

Deploy the plugin:

```bash
# Build plugin
dotnet build Plugins/MyFeature -c Release

# Copy to plugins directory (production)
cp Plugins/MyFeature/bin/Release/net9.0/MyFeature.dll Server/bin/Release/net9.0/plugins/

# Trigger reload
curl -X POST http://localhost:5100/reload
```

## Benefits

✅ **No External Dependencies** - No Redis, no container orchestration required
✅ **Horizontally Scalable** - Add proxy instances without coordination
✅ **Real-Time Updates** - SSE provides instant config updates (no polling)
✅ **Zero Downtime** - Traffic never drops during plugin reloads
✅ **Plugin Isolation** - Each reload starts fresh, no stale state
✅ **Simple Deployment** - Drop DLLs in folder, POST to reload

## Production Considerations

- Run Coordinator as a systemd service or Windows Service
- Use a load balancer (nginx, HAProxy) in front of multiple proxies
- Coordinator is the only service that needs to be highly available
- Consider adding coordinator standby replica with health check promotion
- Monitor the Coordinator `/health` endpoint
- Set up log aggregation for distributed proxy logs
