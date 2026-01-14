# Pivot Framework - Go Implementation

A zero-downtime hot-reload framework for Go applications with plugin support. Enables blue-green deployments with automatic backend lifecycle management.

## Quick Start

**Want to see it in action?** Check out the [sample application](./sample/README.md) that demonstrates using Pivot as a third-party dependency.

```bash
cd packages/pivot-go/sample
./build.sh
./bin/coordinator  # Terminal 1
./bin/proxy        # Terminal 2
# Visit http://localhost:5000
```

## Overview

Pivot is a distributed system with three main components:

1. **Coordinator** - Manages backend lifecycle, spawns processes, and performs health checks
2. **Proxy** - Reverse proxy that routes traffic to healthy backends
3. **Server** - Your application that loads plugins dynamically

## Architecture

```
USER TRAFFIC
     ↓
PROXY (port 5000)
     ↓
     ├─→ Backend Instance 1 (port 5001)
     └─→ Backend Instance 2 (port 5002)
     ↑
COORDINATOR (port 5100)
```

The Coordinator manages backend instances, performing health checks and notifying the Proxy via Server-Sent Events (SSE) when backends are added or removed. The Proxy routes incoming traffic to healthy backends using round-robin load balancing.

## Features

- **Zero-Downtime Deployments**: Blue-green deployment strategy ensures no dropped requests
- **Dynamic Plugin Loading**: Load Go plugins at runtime using `.so` files
- **Auto-Reload**: File watcher triggers automatic reload on plugin changes
- **Process Isolation**: Each backend runs as a separate process
- **Health Checking**: Automatic health checks ensure only healthy backends receive traffic
- **SSE Streaming**: Real-time backend state updates to proxies

## Building

### Prerequisites

- Go 1.21 or later

### Build All Components

```bash
cd packages/pivot-go

# Build coordinator
go build -o bin/coordinator ./coordinator

# Build proxy
go build -o bin/proxy ./proxy

# Build server
go build -o bin/server ./server

# Build example plugin
go build -buildmode=plugin -o plugins/hello.so ./examples/hello-plugin
```

### Quick Build Script

```bash
./build.sh
```

## Running

### Start the System

1. **Start Coordinator** (manages backends):
```bash
./bin/coordinator
```

2. **Start Proxy** (receives traffic):
```bash
./bin/proxy
```

The Coordinator will automatically start the first backend instance.

3. **Access the Application**:
```bash
curl http://localhost:5000/
curl http://localhost:5000/hello
curl http://localhost:5000/users
```

### Configuration

#### Coordinator

Environment variables:
- `SERVER_BINARY_PATH`: Path to server binary (default: `../server/server`)
- `INITIAL_PORT`: First backend port (default: `5001`)
- `HEALTH_CHECK_MAX_ATTEMPTS`: Max health check attempts (default: `30`)
- `HEALTH_CHECK_INTERVAL_MS`: Delay between health checks (default: `500`)
- `TRAFFIC_DRAIN_DELAY_MS`: Wait time before shutting down old backend (default: `5000`)
- `PORT`: Coordinator listen port (default: `5100`)

#### Proxy

Environment variables:
- `COORDINATOR_URL`: Coordinator URL (default: `http://localhost:5100`)
- `PORT`: Proxy listen port (default: `5000`)

#### Server

Command line flags:
- `--port`: Port to listen on (default: `5001`)

Environment variables:
- `PLUGIN_DIRECTORY`: Directory to load plugins from (default: `./plugins`)
- `ENABLE_AUTO_RELOAD`: Watch plugins and trigger reload (default: `false`)
- `PIVOT_COORDINATOR_URL`: Set automatically by Coordinator

## Creating Plugins

Plugins must implement the `core.Plugin` interface:

```go
package main

import (
    "net/http"
    "github.com/arcmantle/weave/packages/pivot-go/core"
)

type MyPlugin struct{}

// Required constructor function
func NewPlugin() core.Plugin {
    return &MyPlugin{}
}

func (p *MyPlugin) Name() string {
    return "MyPlugin"
}

func (p *MyPlugin) Initialize() error {
    // Initialization logic
    return nil
}

func (p *MyPlugin) Register(mux *http.ServeMux) {
    mux.HandleFunc("/my-route", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("Hello from MyPlugin!"))
    })
}
```

Build as a plugin:
```bash
go build -buildmode=plugin -o plugins/myplugin.so ./path/to/myplugin
```

## Hot Reload

### Trigger Reload via API

```bash
curl -X POST http://localhost:5100/reload
```

### Auto-Reload in Development

Set `ENABLE_AUTO_RELOAD=true` when starting the server. The file watcher will automatically trigger a reload when plugin files change.

## Blue-Green Deployment Flow

1. **New Backend Startup**: Coordinator spawns new backend on next available port
2. **Health Check**: Coordinator polls `/health` endpoint until backend is ready
3. **Traffic Transition**: Coordinator notifies Proxy to add new backend to pool
4. **Drain Period**: Wait for in-flight requests to complete
5. **Old Backend Shutdown**: Coordinator removes old backend and terminates process

Result: Zero user-facing downtime, seamless plugin reload.

## API Endpoints

### Coordinator

- `GET /backends` - Returns current list of healthy backends
- `GET /backends/stream` - SSE stream of backend changes
- `POST /reload` - Triggers blue-green deployment
- `GET /health` - Health check endpoint

### Proxy

- `GET /health` - Health check endpoint
- `/*` - Proxies all other requests to backends

### Server

- `GET /health` - Health check endpoint
- `/*` - Application routes (defined by plugins)

## Development Workflow

1. Start Coordinator: `./bin/coordinator`
2. Start Proxy: `./bin/proxy`
3. Access app: `http://localhost:5000`
4. Modify plugin code
5. Rebuild plugin: `go build -buildmode=plugin -o plugins/hello.so ./examples/hello-plugin`
6. Trigger reload: `curl -X POST http://localhost:5100/reload`
7. See changes: Refresh browser

## Sample Application

A complete sample application is included in the `sample/` directory. It demonstrates:

- Using Pivot as a third-party package dependency
- Building custom coordinator, proxy, and server applications
- Creating real-world plugins (e.g., Users API)
- Hot-reload functionality
- Production-ready structure

**See [sample/README.md](./sample/README.md) for full documentation.**

Quick start:
```bash
cd sample
./build.sh
./bin/coordinator  # Terminal 1
./bin/proxy        # Terminal 2
curl http://localhost:5000/api/users
```

## Differences from C# Version

- **Plugin System**: Go uses `.so` shared objects instead of .NET assemblies
- **Build Process**: Plugins must be compiled with `-buildmode=plugin`
- **Type System**: Go's simpler type system compared to C# reflection
- **Concurrency**: Uses goroutines and channels instead of async/await
- **No YARP**: Uses standard library `httputil.ReverseProxy` instead

## Troubleshooting

### Plugin Not Loading

- Ensure plugin is built with `-buildmode=plugin`
- Check that `NewPlugin()` function exists and returns `core.Plugin`
- Verify plugin file has `.so` extension
- Check server logs for specific errors

### Backend Health Check Failing

- Ensure server is listening on correct port
- Check firewall/network settings
- Increase `HEALTH_CHECK_MAX_ATTEMPTS` if server startup is slow

### Proxy Can't Connect to Coordinator

- Verify coordinator is running on expected port
- Check `COORDINATOR_URL` environment variable
- Review proxy logs for connection errors

## License

Same as parent repository.
