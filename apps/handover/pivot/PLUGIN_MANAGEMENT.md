# Plugin Management System

The Pivot Coordinator now includes an optional **plugin management system** that provides a web-based admin UI for managing plugins across all backend instances. This system solves the critical problem of backend failure recovery and provides centralized plugin control.

## Features

✅ **Centralized Management**: Admin panel runs in the Coordinator (always available)
✅ **Survives Backend Failures**: Manage plugins even when backends crash
✅ **Database-Backed State**: Plugin states persist across restarts
✅ **Auto-Recovery**: Automatically disable recently modified plugins when backends fail
✅ **Real-Time Updates**: SSE-powered live UI updates
✅ **Zero-Downtime Deployment**: Integrates with blue-green deployments
✅ **Repository Pattern**: Separate plugin storage from deployment

## Architecture

```
┌──────────────────────────────────────┐
│  Coordinator (Always Running)        │
│  ✓ Admin UI at http://localhost:5100 │
│  ✓ Plugin State Database             │
│  ✓ Deployment Manager                │
│  ✓ Auto-Recovery                     │
└───────────┬──────────────────────────┘
            │
            ↓ Deploys & Monitors
┌──────────────────────────────────────┐
│  Backend Instances                   │
│  ✓ Load plugins from active-plugins/ │
│  ✗ Can fail (recoverable)            │
└──────────────────────────────────────┘
```

## Setup

### 1. Enable Plugin Management in Coordinator

```csharp
var builder = WebApplication.CreateSlimBuilder(args);

// Add Coordinator with plugin management
builder.AddPivotCoordinator(options => {
    options.ServerProjectPath = "../Server/Server.csproj";
});

builder.AddPluginManagement(options => {
    options.Enabled = true;
    options.ConnectionString = "Data Source=pivot-plugins.db";
    options.PluginRepositoryDirectory = "../plugin-repository";
    options.ActivePluginsDirectory = "../active-plugins";
    options.AutoDisableOnFailure = true;
    options.RecentlyModifiedWindowMinutes = 5;
});

var app = builder.Build();

// Initialize plugin states from repository
await app.InitializePluginStatesAsync();

// Map endpoints
app.MapPivotCoordinator();
app.MapPluginManagement();

app.Run();
```

### 2. Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `Enabled` | Enable plugin management UI and database | `false` |
| `ConnectionString` | SQLite database connection string | `"Data Source=pivot-plugins.db"` |
| `PluginRepositoryDirectory` | Directory with all available plugins | `null` |
| `ActivePluginsDirectory` | Directory for enabled plugins only | `null` |
| `AutoDisableOnFailure` | Auto-disable recent plugins on backend failure | `true` |
| `RecentlyModifiedWindowMinutes` | Time window for "recent" plugins | `5` |

### 3. Directory Structure

```
YourProject/
├── plugin-repository/           # All available plugins
│   ├── Users.dll
│   ├── Todos.dll
│   ├── Weather.dll
│   └── ...
│
├── active-plugins/              # Only enabled plugins
│   ├── Users.dll                # Deployed (enabled)
│   └── Todos.dll                # Deployed (enabled)
│   (Weather.dll not here)       # Not deployed (disabled)
│
└── Server/
    └── bin/
        └── Deployments/
            └── 20260124-143022/
                ├── Server.dll
                └── plugins/     # Copied from active-plugins/
                    ├── Users.dll
                    └── Todos.dll
```

## Usage

### Admin UI

Access the admin panel at: **http://localhost:5100/**

Features:
- **Plugin Grid**: View all plugins with enabled/disabled status
- **Toggle Switches**: Enable/disable plugins with one click
- **Deploy Button**: Trigger plugin deployment to active directory
- **Reload Button**: Initiate blue-green deployment with new plugins
- **Real-Time Stats**: Live counters for total/enabled/disabled plugins
- **Connection Status**: SSE connection indicator

### API Endpoints

#### Get All Plugins
```http
GET /api/plugins
```
Returns array of plugin states

#### Toggle Plugin
```http
POST /api/plugins/{name}/toggle
```
Toggles plugin between enabled/disabled

#### Enable Plugin
```http
POST /api/plugins/{name}/enable
```
Enables a specific plugin

#### Disable Plugin
```http
POST /api/plugins/{name}/disable
```
Disables a specific plugin

#### Deploy Plugins
```http
POST /api/plugins/deploy
```
Copies enabled plugins from repository to active directory

#### SSE Stream
```http
GET /api/plugins/events
```
Server-Sent Events stream for real-time updates

## Workflow

### Normal Deployment

1. **Modify Plugin State**:
   - User toggles plugin in admin UI
   - State saved to database

2. **Deploy Plugins**:
   - Click "Deploy Plugins" button
   - PluginDeploymentManager copies enabled plugins to `active-plugins/`

3. **Reload Backends**:
   - Click "Reload Backends" button
   - Coordinator triggers blue-green deployment
   - New backend loads from `active-plugins/`
   - Zero downtime switch

### Backend Failure Recovery

**Scenario**: Bad plugin causes backend to crash

1. **Failure Detected**:
   ```
   [ERROR] New backend failed health checks
   [INFO] Attempting auto-recovery
   ```

2. **Auto-Recovery**:
   - System identifies recently modified plugins (last 5 minutes)
   - Automatically disables them
   - Logs which plugins were disabled

3. **Manual Recovery**:
   - Admin accesses Coordinator UI (still running!)
   - Reviews disabled plugins
   - Re-enables safe plugins
   - Triggers new deployment

## Integration with Backends

The backend configuration doesn't need to change! Just configure it to load from the active directory:

```csharp
// In your backend's Program.cs
builder.AddPivotBackend(options =>
{
    options.LoadFromReferencedAssemblies = false;  // Production mode
    options.PluginDirectory = "../active-plugins";  // Load from here
});
```

The Coordinator handles:
- Deploying enabled plugins before spawning backends
- Health monitoring
- Auto-recovery on failure

## Auto-Recovery Details

When a backend fails health checks:

1. **Identify Suspects**:
   ```sql
   SELECT Name FROM Plugins
   WHERE LastModified > (NOW() - 5 minutes)
   AND IsEnabled = true
   ```

2. **Auto-Disable**:
   ```
   [WARN] Auto-disabling recently modified plugins: Weather, NewFeature
   [INFO] Disabled plugins: Weather, NewFeature
   [INFO] Manual reload required to deploy updated configuration
   ```

3. **Log for Review**:
   - Disabled plugins logged to console
   - Admin can review in UI
   - Manual reload recommended

## Database Schema

```sql
CREATE TABLE Plugins (
    Id INTEGER PRIMARY KEY,
    Name TEXT NOT NULL UNIQUE,
    IsEnabled BOOLEAN NOT NULL DEFAULT 1,
    LastModified DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IX_Plugins_Name ON Plugins(Name);
```

## Example: ApiExample Migration

The `Samples/ApiExample` project demonstrates the system. To migrate it to use Coordinator plugin management:

**Before** (Backend hosts admin UI):
- Admin UI in ApiExample
- Database in ApiExample
- ❌ Fails if backend crashes

**After** (Coordinator hosts admin UI):
- Admin UI in Coordinator
- Database in Coordinator
- ✅ Always accessible

## Benefits

### 1. Resilience
- Admin UI survives backend failures
- Always accessible for recovery

### 2. Centralization
- Single source of truth for plugin states
- One admin panel for all backends

### 3. Safety
- Auto-recovery prevents extended outages
- Manual override always available

### 4. Auditability
- Database tracks all state changes
- Timestamp tracking for forensics

### 5. Zero Downtime
- Integrates seamlessly with blue-green deployments
- No service interruption

## Best Practices

1. **Always Use Plugin Repository**:
   - Keep all plugins in `plugin-repository/`
   - Never modify `active-plugins/` manually

2. **Test Plugins Separately**:
   - Create isolated test project
   - Verify plugin loads before adding to repository

3. **Monitor Logs**:
   - Check Coordinator logs for auto-recovery events
   - Review recently modified plugins after failures

4. **Backup Database**:
   - Plugin states are critical
   - Backup `pivot-plugins.db` regularly

5. **Staged Rollout**:
   - Enable one plugin at a time in production
   - Monitor health before enabling next

## Troubleshooting

### Admin UI Not Loading
- Check `options.Enabled = true`
- Verify Coordinator is running
- Check for port conflicts

### Plugins Not Deploying
- Verify repository directory exists
- Check permissions on directories
- Review Coordinator logs

### Auto-Recovery Not Working
- Ensure `AutoDisableOnFailure = true`
- Check time window configuration
- Verify plugins were recently modified

### Backend Still Failing
- Auto-recovery is a first attempt
- May need manual investigation
- Check backend logs for non-plugin issues

## Future Enhancements

- [ ] Plugin versioning support
- [ ] Rollback to previous configurations
- [ ] Plugin dependency management
- [ ] Health metrics per plugin
- [ ] Scheduled deployments
- [ ] Multi-coordinator support (distributed)

## Summary

The plugin management system transforms Pivot into a production-ready platform with:
- **Resilience**: Survive backend failures
- **Visibility**: Real-time plugin monitoring
- **Control**: Centralized management
- **Safety**: Automatic recovery
- **Simplicity**: Optional, easy to enable

Enable it in your Coordinator today!
