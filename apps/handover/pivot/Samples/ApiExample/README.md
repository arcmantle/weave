# Pivot API Example

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
