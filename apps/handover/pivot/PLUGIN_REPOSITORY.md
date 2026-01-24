# Plugin Repository System

## Overview

The Pivot framework supports a **plugin repository** architecture that separates plugin storage from plugin deployment. This enables dynamic plugin management in production environments where only enabled plugins are deployed to running instances.

## Architecture

### Directory Structure

```
Project/
├── plugin-repository/           # Source of truth - all available plugins
│   ├── Users.dll
│   ├── Users.pdb
│   ├── Todos.dll
│   ├── Todos.pdb
│   ├── Weather.dll
│   └── Weather.pdb
│
├── active-plugins/              # Deployed plugins (only enabled ones)
│   ├── Users.dll                # ✓ Enabled
│   ├── Users.pdb
│   ├── Todos.dll                # ✓ Enabled
│   └── Todos.pdb
│   (Weather.dll not present)    # ✗ Disabled - not deployed
│
└── bin/
    └── Deployments/
        └── 20260124-143022/     # Blue-green deployment
            ├── Server.dll
            └── plugins/         # Plugins copied here during deployment
                ├── Users.dll
                ├── Users.pdb
                ├── Todos.dll
                └── Todos.pdb
```

## Components

### 1. Plugin State Provider

Interface for tracking which plugins are enabled:

```csharp
public interface IPluginStateProvider
{
    Task<bool> IsPluginEnabledAsync(string pluginName);
    Task<IReadOnlyCollection<string>> GetEnabledPluginsAsync();
}
```

**Implementation example** (using database):

```csharp
public class DatabasePluginStateProvider : IPluginStateProvider
{
    private readonly IServiceProvider _serviceProvider;

    public DatabasePluginStateProvider(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task<bool> IsPluginEnabledAsync(string pluginName)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

        var plugin = await db.Plugins.FirstOrDefaultAsync(p => p.Name == pluginName);
        return plugin?.IsEnabled ?? false;
    }

    public async Task<IReadOnlyCollection<string>> GetEnabledPluginsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PluginDbContext>();

        return await db.Plugins
            .Where(p => p.IsEnabled)
            .Select(p => p.Name)
            .ToListAsync();
    }
}
```

### 2. Plugin Deployment Manager

Handles copying plugins from repository to active directory:

```csharp
var deploymentManager = new PluginDeploymentManager(logger);
await deploymentManager.DeployEnabledPluginsAsync(
    repositoryDir: "plugin-repository",
    targetDir: "active-plugins",
    stateProvider: pluginStateProvider
);
```

This:
1. Clears the `active-plugins` directory
2. Queries the state provider for enabled plugins
3. Copies only enabled plugin DLLs (and related files) from `plugin-repository` to `active-plugins`

### 3. Backend Configuration

In your application's `Program.cs`:

```csharp
// Register your custom plugin state provider
builder.Services.AddSingleton<IPluginStateProvider, DatabasePluginStateProvider>();

// Configure Pivot backend
builder.AddPivotBackend(options =>
{
    // Development: Load from referenced assemblies
    options.LoadFromReferencedAssemblies = builder.Environment.IsDevelopment();

    // Production: Load from directory
    options.PluginRepositoryDirectory = "plugin-repository";
    options.PluginDirectory = "active-plugins";
    options.EnableAutoReload = builder.Environment.IsDevelopment();
});
```

## Workflow

### Development Workflow

In development mode, plugins are loaded from referenced assemblies:

1. Add plugin projects as project references
2. Implement `IPlugin` interface
3. Plugins are automatically discovered and loaded
4. No file management needed

### Production Workflow

In production mode, plugins are loaded from directories:

1. **Initial Setup**:
   - Build all plugin projects
   - Copy plugin DLLs to `plugin-repository/`
   - Configure plugin states in your database

2. **Plugin Deployment**:
   ```bash
   # Toggle a plugin's state
   curl -X POST http://localhost:5200/api/plugins/Weather/toggle

   # Deploy enabled plugins
   curl -X POST http://localhost:5200/api/plugins/deploy
   ```

3. **Application Restart**:
   - Trigger a blue-green deployment (via Coordinator)
   - New backend instance loads from `active-plugins/`
   - Only enabled plugins are available

4. **Zero-Downtime Deployment**:
   - Coordinator spawns new backend with updated plugins
   - Health check passes
   - Proxy routes traffic to new backend
   - Old backend is shut down

## Integration with Coordinator

The `BackendOrchestrator` can be enhanced to use the plugin repository system:

```csharp
private async Task<string?> BuildServerAsync()
{
    // ... existing build logic ...

    // Deploy enabled plugins before creating deployment directory
    var deploymentManager = new PluginDeploymentManager(_logger);
    var stateProvider = GetPluginStateProvider(); // Your implementation

    var repositoryDir = Path.Combine(projectDir, "..", "plugin-repository");
    var activePluginsDir = Path.Combine(projectDir, "active-plugins");

    await deploymentManager.DeployEnabledPluginsAsync(
        repositoryDir,
        activePluginsDir,
        stateProvider
    );

    // Copy plugins from active-plugins to deployment
    CopyPluginDlls(activePluginsDir, deploymentDir);

    return deploymentDir;
}

private void CopyPluginDlls(string activePluginsDir, string outputDir)
{
    if (!Directory.Exists(activePluginsDir))
        return;

    var targetPluginsDir = Path.Combine(outputDir, "plugins");
    Directory.CreateDirectory(targetPluginsDir);

    // Copy all files from active-plugins to deployment
    foreach (var file in Directory.GetFiles(activePluginsDir))
    {
        var fileName = Path.GetFileName(file);
        var targetPath = Path.Combine(targetPluginsDir, fileName);
        File.Copy(file, targetPath, overwrite: true);
    }
}
```

## Benefits

1. **Separation of Concerns**: Plugin repository is the source of truth, separate from active deployment
2. **Dynamic Management**: Enable/disable plugins without modifying the repository
3. **Zero Downtime**: Blue-green deployments ensure continuous availability
4. **Audit Trail**: Database tracks plugin state changes over time
5. **Selective Deployment**: Only enabled plugins consume resources
6. **Easy Rollback**: Disable problematic plugins without redeployment

## Example: ApiExample Project

The `Samples/ApiExample` project demonstrates this architecture:

- Database-backed plugin state (`DatabasePluginStateProvider`)
- Plugin toggle endpoint
- Plugin deployment endpoint
- Real-time UI updates via SSE
- Integration with Pivot framework

Run the example:
```bash
cd apps/handover/pivot/Samples/ApiExample
dotnet run
```

Access:
- Admin UI: http://localhost:5200/
- Swagger: http://localhost:5200/swagger
- Toggle plugins and observe real-time updates

## Future Enhancements

1. **Automatic Deployment**: Trigger blue-green deployment when plugins are toggled
2. **Plugin Versioning**: Track and deploy specific plugin versions
3. **Rollback Support**: Revert to previous plugin configurations
4. **Health Monitoring**: Monitor plugin-specific health metrics
5. **Dependency Management**: Handle plugin dependencies automatically
