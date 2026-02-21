# Proxy Example

This sample demonstrates how to set up a **Pivot Proxy** application that routes traffic to backend instances using YARP reverse proxy.

## What It Does

The Proxy is responsible for:
- **Load Balancing**: Routes requests to healthy backend instances
- **Health Checking**: Continuously monitors backend health
- **Zero-Downtime**: Switches traffic during blue-green deployments
- **Auto-Discovery**: Gets backend list from Coordinator

## Running the Sample

```bash
dotnet run
```

The Proxy will start at **http://localhost:8080**

## How It Works

1. Proxy queries Coordinator at `http://localhost:5000` for active backends
2. Configures YARP reverse proxy to route to those backends
3. Continuously health-checks backends
4. Routes traffic only to healthy backends
5. During deployment, switches traffic seamlessly to new backend

## Making Requests

All API requests go through the proxy:

```bash
# Request goes to proxy, which routes to healthy backend
curl http://localhost:8080/api/some-endpoint

# Swagger UI (from backend)
open http://localhost:8080/swagger
```

## Configuration

Edit `appsettings.json`:

```json
{
  "Urls": "http://localhost:8080",
  "Pivot": {
    "Proxy": {
      "CoordinatorUrl": "http://localhost:5000",
      "HealthCheckIntervalSeconds": 5,
      "HealthCheckPath": "/health"
    }
  }
}
```

## Typical Workflow

1. Start Coordinator (manages backends and plugins)
2. Coordinator spawns Backend instances
3. Start Proxy (this application)
4. Make requests to Proxy on port 8080
5. Proxy routes to healthy backends
6. When Coordinator deploys new backend, Proxy switches traffic automatically

## Architecture

```
Client
  ↓ (http://localhost:8080)
Proxy (this app)
  ↓ (queries backends)
Coordinator
  ↓ (manages)
Backend Instances (5001, 5002, etc.)
```

## Health Checks

Proxy checks backend health at configurable intervals:
- Sends GET to `/health` endpoint
- Marks backend as healthy/unhealthy
- Routes traffic only to healthy instances

## Blue-Green Deployment

When Coordinator triggers reload:
1. Coordinator starts new backend (green)
2. New backend loads updated plugins
3. Proxy detects new healthy backend
4. Proxy switches traffic to new backend
5. Coordinator shuts down old backend (blue)
6. Zero downtime for end users
