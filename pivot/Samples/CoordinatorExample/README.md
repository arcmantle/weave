# Coordinator Example

This sample demonstrates how to set up a **Pivot Coordinator** application that manages plugin state and orchestrates backend instances.

## What It Does

The Coordinator is responsible for:
- **Plugin Management**: Web UI at `/` to enable/disable plugins
- **Plugin State**: Database tracking of plugin enabled/disabled state
- **Backend Orchestration**: Blue-green deployments of backend instances
- **Auto-Recovery**: Disables recently modified plugins if backend fails

## Running the Sample

```bash
dotnet run
```

The Coordinator will start at **http://localhost:5000**

## Admin UI

Navigate to **http://localhost:5000** to access the plugin management interface:
- View all installed plugins
- Enable/disable plugins
- Deploy plugins to active directory
- Trigger backend reload
- Browse plugin registry (if Registry is running)

## API Endpoints

- `GET /api/plugins` - List all plugins
- `POST /api/plugins/{name}/toggle` - Enable/disable a plugin
- `POST /api/plugins/{name}/enable` - Enable a plugin
- `POST /api/plugins/{name}/disable` - Disable a plugin
- `POST /api/plugins/deploy` - Deploy enabled plugins
- `POST /api/plugins/install` - Install plugin from registry
- `POST /reload` - Trigger blue-green deployment
- `GET /api/plugins/events` - SSE stream of plugin state updates

## Configuration

Edit `appsettings.json`:

```json
{
  "Urls": "http://localhost:5000",
  "Pivot": {
    "PluginManagement": {
      "PluginRepositoryDirectory": "plugin-repository",
      "ActivePluginsDirectory": "active-plugins",
      "ConnectionString": "Data Source=coordinator.db"
    }
  }
}
```

## Directory Structure

After running, the Coordinator creates:

```
CoordinatorExample/
├── plugin-repository/     # All available plugins (.dll files)
├── active-plugins/        # Enabled plugins (deployed)
└── coordinator.db         # Plugin state database
```

## Typical Workflow

1. Start Coordinator (this application)
2. Start Backend instances (see BackendExample)
3. Start Proxy (see ProxyExample)
4. Open http://localhost:5000 to manage plugins
5. Enable/disable plugins as needed
6. Click "Deploy Plugins" to update active-plugins/
7. Click "Reload Backends" to trigger blue-green deployment
8. Proxy automatically switches traffic to healthy backends

## Integration with Registry

To install plugins from the registry:

1. Start the Registry service
2. In the Coordinator UI, go to "Plugin Registry" tab
3. Enter registry URL (e.g., http://localhost:5100)
4. Browse and install plugins
5. Enable and deploy as usual
