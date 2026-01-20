# Pivot API Example

A comprehensive sample application demonstrating the Pivot plugin framework with dynamic plugin management, Swagger API documentation, and a real-time admin interface.

## Features

- ✨ **Dynamic Plugin System**: Enable/disable plugins at runtime
- 📚 **Swagger/OpenAPI Documentation**: Interactive API explorer at `/swagger`
- 🎨 **Modern Admin UI**: Real-time plugin management interface
- 🔄 **Live Updates**: Server-Sent Events (SSE) for real-time state synchronization
- 💾 **SQLite Persistence**: Plugin states persisted across restarts
- 🔌 **Example Plugins**:
  - **Todos Plugin**: CRUD operations for todo items
  - **Weather Plugin**: Weather forecast API endpoints
  - **Users Plugin**: User management API

## Getting Started

### Prerequisites

- .NET 9.0 SDK

### Running the Application

```bash
cd apps/handover/pivot/Samples/ApiExample
dotnet run
```

The application will start on `http://localhost:5200`.

## Endpoints

### Admin Interface
- **GET /** - Plugin management dashboard with real-time updates

### API Endpoints
- **GET /swagger** - Swagger UI for API documentation
- **GET /api/plugins** - List all plugins and their states
- **POST /api/plugins/{name}/toggle** - Enable/disable a specific plugin
- **GET /api/plugins/events** - SSE stream for real-time plugin state updates

### Plugin Endpoints (when enabled)

#### Todos Plugin
- **GET /api/todos** - Get all todos
- **GET /api/todos/{id}** - Get a specific todo
- **POST /api/todos** - Create a new todo
- **PUT /api/todos/{id}** - Update a todo
- **DELETE /api/todos/{id}** - Delete a todo

#### Weather Plugin
- **GET /api/weather/forecast** - Get 5-day weather forecast
- **GET /api/weather/current** - Get current weather

#### Users Plugin
- **GET /api/users** - Get all users
- **GET /api/users/{id}** - Get a specific user
- **POST /api/users** - Create a new user
- **PUT /api/users/{id}** - Update a user
- **DELETE /api/users/{id}** - Delete a user

## How It Works

### Plugin Loading

Plugins are automatically discovered from referenced assemblies using the Pivot framework's `PluginLoader`. Each plugin implements the `IPlugin` interface:

```csharp
public interface IPlugin
{
    string Name { get; }
    void Initialize(WebApplicationBuilder builder);  // Service registration
    void Configure(WebApplication app);              // Endpoint configuration
}
```

### Plugin State Management

Plugin states (enabled/disabled) are stored in a SQLite database and synchronized on application startup. When you toggle a plugin:

1. The state is updated in the database
2. All connected SSE clients receive the updated state
3. The admin UI updates in real-time

Note: Currently, endpoint routing happens at startup. Disabling a plugin updates the UI but doesn't remove the endpoints until app restart. This could be enhanced with middleware to check plugin state before routing.

### Real-Time Updates

The admin interface uses Server-Sent Events (SSE) to receive real-time updates:

```javascript
const eventSource = new EventSource('/api/plugins/events');
eventSource.onmessage = (event) => {
    const plugins = JSON.parse(event.data);
    updateUI(plugins);
};
```

## Project Structure

```
ApiExample/
├── Data/
│   ├── PluginDbContext.cs        # EF Core database context
│   └── PluginState.cs             # Plugin state entity
├── Services/
│   ├── IPluginManager.cs          # Plugin manager interface
│   └── PluginManager.cs           # Plugin state management & SSE
├── Plugins/
│   ├── TodosPlugin.cs             # Todo API plugin
│   ├── WeatherPlugin.cs           # Weather API plugin
│   └── UsersPlugin.cs             # User management plugin
├── Pages/
│   ├── Index.cshtml               # Admin UI view
│   └── Index.cshtml.cs            # Admin UI page model
├── wwwroot/
│   ├── css/admin.css              # Custom styling
│   └── js/admin.js                # SSE client & interactions
├── Migrations/                     # EF Core migrations
├── Program.cs                      # Application entry point
└── ApiExample.csproj              # Project file
```

## Technologies Used

- **ASP.NET Core 9.0** - Web framework
- **Entity Framework Core** - Database ORM
- **SQLite** - Embedded database
- **Swashbuckle** - OpenAPI/Swagger documentation
- **Razor Pages** - Server-side rendering
- **Server-Sent Events (SSE)** - Real-time updates
- **Pivot Framework** - Plugin system

## Extending the Application

### Creating a New Plugin

1. Create a new class implementing `IPlugin`:

```csharp
public class MyPlugin : IPlugin
{
    public string Name => "MyPlugin";

    public void Initialize(WebApplicationBuilder builder)
    {
        // Register services
        builder.Services.AddScoped<IMyService, MyService>();
    }

    public void Configure(WebApplication app)
    {
        // Register endpoints
        app.MapGet("/api/myplugin", () => "Hello from MyPlugin")
            .WithTags("MyPlugin")
            .WithOpenApi();
    }
}
```

2. The plugin will automatically be:
   - Discovered on startup
   - Registered in the database
   - Visible in the admin UI
   - Documented in Swagger

## Notes

- The database file `plugins.db` is created automatically on first run
- Plugin states persist across application restarts
- The application uses in-memory storage for plugin data (todos, users, etc.)
- Hot reload is enabled in development mode for code changes

## License

This is a sample application for demonstration purposes.
