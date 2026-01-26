# Backend Example (ApiExample)

This sample demonstrates how to set up a **Pivot Backend** application that loads plugins and serves APIs.

## What It Does

The Backend is responsible for:

- **Plugin Loading**: Dynamically loads plugin DLLs
- **Dependency Resolution**: Resolves plugin dependencies
- **API Hosting**: Serves endpoints defined by plugins
- **Hot Reload**: Reloads when plugin directory changes (dev mode)

## Running the Sample

```bash
dotnet run
```

The Backend will start at **<http://localhost:5010>** (or as configured)

## How It Works

1. Backend scans `plugins/` directory for plugin DLLs
2. Reads `plugin.json` manifests
3. Resolves dependencies (topological sort)
4. Loads plugins in correct order
5. Calls `Initialize()` and `Configure()` on each plugin
6. Plugins register their services and endpoints

## Configuration

Edit `appsettings.json` or configure in code:

```json
{
  "Urls": "http://localhost:5010"
}
```

Program.cs:

```csharp
builder.AddPivotBackend(options => {
    // Development: Load from referenced assemblies
    options.LoadFromReferencedAssemblies = builder.Environment.IsDevelopment();

    // Production: Load from directory
    options.PluginDirectory = "plugins";

    // Enable auto-reload in development
    options.EnableAutoReload = builder.Environment.IsDevelopment();
});
```

## Plugin Directory Structure

```
Backend/
├── plugins/
│   ├── WeatherPlugin.dll
│   ├── plugin.json          # WeatherPlugin manifest
│   ├── TodosPlugin.dll
│   └── plugin.json          # TodosPlugin manifest
└── Program.cs
```

## Typical Workflow

### Development Mode (IntelliSense + Debugging)

1. Reference plugin projects in Backend.csproj
2. Set `LoadFromReferencedAssemblies = true`
3. Plugins load from bin/ with full debugging support

### Production Mode (Hot Reload)

1. Copy plugin DLLs to `plugins/` directory
2. Set `LoadFromReferencedAssemblies = false`
3. Backend auto-reloads when plugins change
4. Coordinator manages blue-green deployment

## Coordinated Deployment

When running with Coordinator:

1. Coordinator spawns Backend instances
2. Backend loads plugins from `active-plugins/`
3. When plugins change, Backend POSTs to `/reload` on Coordinator
4. Coordinator triggers blue-green deployment
5. New Backend starts with updated plugins
6. Proxy switches traffic, zero downtime

## Health Endpoint

Backend automatically provides `/health`:

```bash
curl http://localhost:5010/health
```

Used by Proxy for health checking.

## See Also

- [CoordinatorExample](../CoordinatorExample/README.md) - Manages plugins and backends
- [ProxyExample](../ProxyExample/README.md) - Routes traffic to backends
- [Plugin Samples](../Plugins/README.md) - Example plugin implementations

A simple standalone sample demonstrating the Pivot plugin framework with Swagger API documentation.

## Features

- 🔌 **Simple Plugin System**: Three example plugins showing different API patterns
- 📚 **Swagger/OpenAPI Documentation**: Interactive API explorer at `/swagger`
- 🔄 **Hot Reload**: File watching in development mode
- 🎯 **Standalone**: No Coordinator or Proxy needed for development

## Example Plugins

- **Todos Plugin**: CRUD operations for todo items (`/api/todos`)
- **Weather Plugin**: Weather forecast API endpoints (`/api/weather`)
- **Users Plugin**: User management API (`/api/users`)

## Quick Start

### Prerequisites

- .NET 9.0 SDK

### Running

```bash
cd apps/handover/pivot/Samples/ApiExample
dotnet run
```

Application starts on `http://localhost:5200`

**Access Swagger:** `http://localhost:5200/swagger`

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for:

- Working with inline plugins (current setup)
- Creating separate plugin projects
- Using Local.props for IntelliSense
- Debugging workflows
- Production deployment

## API Endpoints

### Todos Plugin

- `GET /api/todos` - Get all todos
- `GET /api/todos/{id}` - Get a specific todo
- `POST /api/todos` - Create a new todo
- `PUT /api/todos/{id}` - Update a todo
- `DELETE /api/todos/{id}` - Delete a todo

### Weather Plugin

- `GET /api/weather/forecast` - Get 5-day weather forecast
- `GET /api/weather/current` - Get current weather

### Users Plugin

- `GET /api/users` - Get all users
- `GET /api/users/{id}` - Get a specific user
- `POST /api/users` - Create a new user
- `PUT /api/users/{id}` - Update a user
- `DELETE /api/users/{id}` - Delete a user

## How It Works

### Plugin System

Each plugin implements `IPlugin`:

```csharp
public interface IPlugin
{
    string Name { get; }
    void Initialize(WebApplicationBuilder builder);  // Service registration
    void Configure(WebApplication app);              // Endpoint configuration
}
```

### Loading Modes

**Development (default):**

- Loads from `bin/` directory (compiled assemblies)
- Enables hot reload with file watching
- Full IntelliSense and debugging

**Production:**

- Loads from `plugins/` directory
- Can enable/disable plugins without restart
- Set `ASPNETCORE_ENVIRONMENT=Production`

## Project Structure

```
ApiExample/
├── Program.cs              # Application startup
├── Plugins/                # Inline plugin implementations
│   ├── TodosPlugin.cs
│   ├── UsersPlugin.cs
│   └── WeatherPlugin.cs
└── ApiExample.Local.props  # Optional: for separate plugin projects (gitignored)
```

## Next Steps

- **Add your own plugin**: Create new `.cs` file in `Plugins/` folder
- **Separate projects**: See [DEVELOPMENT.md](DEVELOPMENT.md) for advanced setup
- **Full stack**: See main Pivot docs for Coordinator/Proxy integration
