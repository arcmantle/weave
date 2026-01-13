# Developer Guide - Handover System

## Quick Start

### 1. Initial Setup

```bash
# Build the entire solution
dotnet build Handover.sln
```

### 2. Running the System

**Option A: VS Code (Recommended)**

1. Press `F5` or go to Run and Debug
2. Select **"Handover System (Coordinator + Proxy)"**
3. Both Coordinator and Proxy will start simultaneously
4. Browser opens automatically to `http://localhost:5000` (Proxy)

**Option B: Multiple Terminals**

```bash
# Terminal 1 - Start Coordinator
cd Coordinator
dotnet run

# Terminal 2 - Start Proxy
cd Proxy
dotnet run
```

### 3. Accessing the Application

- **User-facing app**: http://localhost:5000 (Proxy - use this for testing)
- **Coordinator API**: http://localhost:5100 (internal management)
- **Backend instance**: http://localhost:5001 (spawned automatically, don't access directly)

## Developer Workflow

### Current Setup (LoadFromReferencedAssemblies)

In Development mode, Server loads plugins from **project references** instead of DLL files. This means:

✅ **Pros:**
- Fast iteration - no file copying
- Intellisense works perfectly
- Debugger can step into plugin code

❌ **Cons:**
- Changes require **full system restart**
- No hot reload during development
- Must rebuild Server project

**Workflow:**
1. Edit plugin code in `Plugins/Users/`
2. Stop Coordinator (Ctrl+C or stop debugging)
3. Rebuild solution: `dotnet build`
4. Restart debugging (F5)

### Recommended: Hot Reload Setup

For true hot reload during development, you have two options:

#### Option 1: Hybrid Approach (Recommended)

Keep `LoadFromReferencedAssemblies = true` for Intellisense, but add a file watcher:

**Step 1**: Add post-build event to Users.csproj:

```xml
<Target Name="CopyToPluginDirectory" AfterTargets="Build">
  <ItemGroup>
    <PluginFiles Include="$(OutputPath)Users.dll" />
  </ItemGroup>
  <Copy SourceFiles="@(PluginFiles)" DestinationFolder="$(SolutionDir)Server\bin\Debug\net9.0\plugins\" />
</Target>
```

**Step 2**: Update Server/Program.cs to watch the plugins directory:

```csharp
builder.AddPivotBackend(options => {
    options.LoadFromReferencedAssemblies = builder.Environment.IsDevelopment();
    options.PluginDirectory = Path.Combine(AppContext.BaseDirectory, "plugins");
    options.EnableAutoReload = builder.Environment.IsDevelopment();
    options.WatchDebounceMs = 1000; // Give build time to complete
});
```

**Workflow:**
1. Edit plugin code in `Plugins/Users/`
2. Save file (or run VS Code task: `Ctrl+Shift+B` → "build-and-reload")
3. Plugin rebuilds automatically
4. File copied to plugins directory
5. FileSystemWatcher detects change
6. Coordinator spawns new backend with updated plugin
7. Zero downtime - users see changes immediately

#### Option 2: Directory-Based Loading

Change to load exclusively from directory (loses project reference benefits):

```csharp
builder.AddPivotBackend(options => {
    options.LoadFromReferencedAssemblies = false; // Disable reference loading
    options.PluginDirectory = Path.Combine(AppContext.BaseDirectory, "plugins");
    options.EnableAutoReload = true;
});
```

Then manually copy plugin DLLs to the plugins directory, or use the post-build event above.

## VS Code Tasks

### Available Tasks (Ctrl+Shift+P → "Tasks: Run Task")

1. **build** - Build entire solution (default: Ctrl+Shift+B)
2. **build-plugins** - Build just the plugins
3. **trigger-reload** - Manually trigger reload via Coordinator API
4. **build-and-reload** - Build plugins + trigger reload (hot reload shortcut)

### Creating a Keyboard Shortcut for Hot Reload

Add to `.vscode/keybindings.json` in your workspace:

```json
[
  {
    "key": "ctrl+shift+r",
    "command": "workbench.action.tasks.runTask",
    "args": "build-and-reload"
  }
]
```

Now `Ctrl+Shift+R` = instant hot reload!

## Debugging

### Debugging the Coordinator or Proxy

1. Set breakpoints in Coordinator/Proxy code
2. Press F5 to start compound launch
3. Breakpoints will be hit as normal

### Debugging a Backend Instance

Since backends are spawned as child processes, debugging requires attaching:

**Option 1: Wait for Debugger** (recommended for investigating startup issues)

Modify `Pivot.Coordinator/Orchestration/BackendOrchestrator.cs` StartBackendAsync:

```csharp
var startInfo = new ProcessStartInfo
{
    FileName = "dotnet",
    // Add this:
    ArgumentList = { "exec", "--debug", dllPath },
    // ... rest of config
};
```

**Option 2: Attach to Running Process**

1. Start system normally (F5)
2. Go to Run and Debug → `.NET Core Attach`
3. Filter for "Server" process
4. Attach debugger

### Debugging Plugins

If using `LoadFromReferencedAssemblies = true`:
- Set breakpoints directly in plugin code
- They'll be hit when backend serves requests
- Full debugging experience

If using directory-based loading:
- Attach to Server process (see above)
- Load symbols for plugin DLL
- Limited debugging (no source mapping)

## Common Scenarios

### Scenario: Plugin Code Changes

**With LoadFromReferencedAssemblies (current setup):**
```bash
# Make changes to Plugins/Users/Endpoints.cs
# Stop debugging (Shift+F5)
dotnet build
# Start debugging (F5)
```

**With Hot Reload (recommended setup):**
```bash
# Make changes to Plugins/Users/Endpoints.cs
# Save file
# Watch console - backend reloads automatically
# Refresh browser - changes live!
```

### Scenario: Coordinator/Proxy Code Changes

```bash
# Make changes to Coordinator/Program.cs or Proxy code
# Hot reload doesn't help here - these control the system
# Stop debugging (Shift+F5)
dotnet build
# Start debugging (F5)
```

### Scenario: Server Code Changes

```bash
# Make changes to Server/Program.cs
# Since Server is spawned by Coordinator, stopping/restarting it is automatic
# Just trigger a reload:
curl -X POST http://localhost:5100/reload
# OR use the "build-and-reload" task
```

### Scenario: Testing Blue-Green Deployment

```bash
# System running, visit http://localhost:5000
# Trigger manual reload:
curl -X POST http://localhost:5100/reload

# Watch Coordinator logs:
# - New backend starts on port 5002
# - Health check passes
# - Proxy adds new backend
# - Old backend (5001) drains
# - Old backend shuts down
# - New backend (5002) is now active

# Verify no downtime - keep refreshing browser during reload
```

## Project Structure

```
server/
├── Coordinator/          # Starts/stops backends, manages lifecycle
│   └── Program.cs        # Main entry (port 5100)
├── Proxy/               # User-facing reverse proxy
│   └── Program.cs       # Main entry (port 5000) - YOUR MAIN URL
├── Server/              # Actual application backend
│   └── Program.cs       # Spawned by Coordinator (port 5001+)
├── Plugins/             # Hot-reloadable plugins
│   └── Users/
│       ├── Plugin.cs    # IPlugin implementation
│       └── Endpoints.cs # Endpoint definitions
├── BuildTasks/          # MSBuild helper tasks
└── Scripts/             # Utility scripts
```

## Environment Variables

The Coordinator automatically sets these when spawning backends:

- `ASPNETCORE_URLS` - Backend port (e.g., `http://localhost:5001`)
- `PIVOT_COORDINATOR_URL` - Coordinator address (e.g., `http://localhost:5100`)
- `ASPNETCORE_ENVIRONMENT` - Development/Production

## Troubleshooting

### Port Already in Use

```bash
# Check what's using ports 5000, 5100, 5001
netstat -ano | findstr "5000 5100 5001"

# Kill specific PID
taskkill /F /PID <PID>

# OR kill all dotnet processes (nuclear option)
taskkill /F /IM dotnet.exe
```

### Backend Won't Start

Check Coordinator logs for:
- `ServerProjectPath` is correct
- Server.csproj exists
- Server builds successfully: `cd Server && dotnet build`

### Proxy Can't Connect to Coordinator

- Ensure Coordinator started first
- Check Coordinator is listening on 5100: `curl http://localhost:5100/backends`
- Check `PivotProxyOptions.CoordinatorUrl` is correct

### Plugin Not Loading

**If using LoadFromReferencedAssemblies:**
- Check Server.csproj has `<ProjectReference>` to plugin
- Ensure plugin implements `IPlugin` interface
- Rebuild solution

**If using directory-based:**
- Check `options.PluginDirectory` path is correct
- Ensure plugin DLL is in that directory
- Check plugin has `Pivot.Plugin` namespace reference

### Hot Reload Not Working

- Check `EnableAutoReload = true`
- Verify `PluginDirectory` is being watched
- Ensure file is actually changing (check file timestamp)
- Increase `WatchDebounceMs` if builds are slow
- Check Coordinator logs for reload trigger

## Recommended VS Code Extensions

- **C# Dev Kit** - Essential for .NET development
- **REST Client** - Test APIs using .http files
- **Error Lens** - Inline error messages
- **GitLens** - Git integration

## Performance Tips

- **First startup is slow** - .NET needs to compile, load assemblies
- **Subsequent reloads are fast** - ~2-3 seconds for hot reload
- **Use Release builds in production** - Much faster startup
- **Consider ReadyToRun** - Pre-JIT compilation for faster startup

## Next Steps

1. **Enable Hot Reload**: Follow "Option 1: Hybrid Approach" above
2. **Create More Plugins**: Copy `Plugins/Users` as a template
3. **Add Integration Tests**: Test blue-green deployment flows
4. **Configure Observability**: Set up OpenTelemetry exporter
5. **Production Deploy**: Build Release, deploy to server

## Production Differences

| Aspect | Development | Production |
|--------|------------|------------|
| Plugin Loading | `LoadFromReferencedAssemblies` | Directory-based |
| Auto Reload | Enabled | Disabled (manual trigger) |
| Coordinator | Runs `dotnet run` | Executes compiled DLLs |
| Ports | Fixed (5000, 5100) | Configurable via environment |
| Logging | Console output | Structured logs to file/service |

## Additional Resources

- [ARCHITECTURE.md](../../pivot/ARCHITECTURE.md) - System architecture deep-dive
- [Pivot.http](Proxy/Proxy.http) - API examples
- [Server.http](Server/Server.http) - Backend API examples
