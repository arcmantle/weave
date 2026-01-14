# Sample Pivot Application

This is a sample application demonstrating how to use the Pivot framework as a third-party dependency.

## Overview

This sample application shows how to:
- Use Pivot as an external package dependency
- Create a custom coordinator, proxy, and server
- Build and load custom plugins
- Implement a real-world API with the plugin system

## Architecture

The sample uses Pivot framework to create a distributed system:

```
Sample Coordinator (port 5100)
     ↓
     → Manages backend lifecycle
     → Uses: github.com/arcmantle/weave/packages/pivot-go/coordinator/orchestration

Sample Proxy (port 5000)
     ↓
     → Routes traffic to backends
     → Uses: github.com/arcmantle/weave/packages/pivot-go/core

Sample Server (dynamic ports: 5001, 5002, ...)
     ↓
     → Loads plugins dynamically
     → Uses: github.com/arcmantle/weave/packages/pivot-go/core
```

## Building

```bash
# Install dependencies
go mod tidy

# Build all components
./build.sh
```

This will create:
- `bin/coordinator` - Backend lifecycle manager
- `bin/proxy` - Reverse proxy
- `bin/server` - Application server
- `plugins/users.so` - Sample users plugin

## Running

### Terminal 1: Start Coordinator
```bash
./bin/coordinator
```

The coordinator will:
- Start on port 5100
- Spawn the first server instance on port 5001
- Wait for it to become healthy
- Stream backend updates via SSE

### Terminal 2: Start Proxy
```bash
./bin/proxy
```

The proxy will:
- Start on port 5000
- Connect to coordinator's SSE stream
- Route traffic to healthy backends

### Access the Application

Open your browser or use curl:

```bash
# Welcome message
curl http://localhost:5000/

# List all users (from plugin)
curl http://localhost:5000/api/users

# Get specific user
curl http://localhost:5000/api/users/1

# Plugin statistics
curl http://localhost:5000/api/stats

# Check health
curl http://localhost:5000/health
```

## Hot Reload Demo

### Modify and Rebuild Plugin

1. Edit `plugins/users-plugin/plugin.go`
2. Rebuild: `go build -buildmode=plugin -o plugins/users.so ./plugins/users-plugin`
3. Trigger reload: `curl -X POST http://localhost:5100/reload`
4. Watch the logs - you'll see:
   - New server starting on port 5002
   - Health checks
   - Traffic switching
   - Old server shutting down
5. Access the app again - changes are live!

### Auto-Reload (Development Mode)

The coordinator can detect plugin changes and auto-reload:

```bash
# Enable auto-reload when starting coordinator
ENABLE_AUTO_RELOAD=true ./bin/coordinator
```

Now when you rebuild a plugin, the system automatically reloads.

## Plugin Development

Create a new plugin by implementing the `core.Plugin` interface:

```go
package main

import (
    "net/http"
    "github.com/arcmantle/weave/packages/pivot-go/core"
)

type MyPlugin struct{}

func NewPlugin() core.Plugin {
    return &MyPlugin{}
}

func (p *MyPlugin) Name() string {
    return "MyPlugin"
}

func (p *MyPlugin) Initialize() error {
    return nil
}

func (p *MyPlugin) Register(mux *http.ServeMux) {
    mux.HandleFunc("/my-endpoint", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("Hello from MyPlugin!"))
    })
}
```

Build as plugin:
```bash
go build -buildmode=plugin -o plugins/myplugin.so ./path/to/plugin
```

## Dependencies

The sample application depends on the Pivot framework:

```go
require github.com/arcmantle/weave/packages/pivot-go v0.0.0
```

Using a `replace` directive for local development:
```go
replace github.com/arcmantle/weave/packages/pivot-go => ../
```

In production, you would remove the replace directive and use a versioned dependency.

## Monitoring

### Check Backends
```bash
curl http://localhost:5100/backends
```

### Stream Backend Changes
```bash
curl http://localhost:5100/backends/stream
```

### Trigger Manual Reload
```bash
curl -X POST http://localhost:5100/reload
```

## Project Structure

```
sample/
├── coordinator/       # Coordinator using Pivot orchestration
│   └── main.go
├── proxy/            # Proxy using Pivot core
│   └── main.go
├── server/           # Server using Pivot plugin loader
│   └── main.go
├── plugins/          # Custom plugins
│   └── users-plugin/
│       └── plugin.go
├── bin/              # Built binaries (gitignored)
├── go.mod            # Dependencies (uses Pivot framework)
├── build.sh          # Build script
└── README.md         # This file
```

## Key Features Demonstrated

1. **Third-Party Dependency**: Uses Pivot as an external package
2. **Plugin System**: UsersPlugin shows real API implementation
3. **Blue-Green Deployment**: Manual or automatic reload
4. **SSE Streaming**: Real-time backend updates
5. **Health Checking**: Automatic backend health monitoring
6. **Process Isolation**: Each backend runs independently

## Next Steps

- Add more plugins (e.g., authentication, logging)
- Implement database connections in plugins
- Add metrics and monitoring
- Deploy to production with proper versioning
- Add tests for plugins
