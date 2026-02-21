# ApiExample - Development Guide

## Quick Start for Local Development

### Running Standalone (No Coordinator)

The ApiExample can run completely standalone for easier development:

```bash
cd apps/handover/pivot/Samples/ApiExample
dotnet run
```

**What you get:**
- Application runs on `http://localhost:5200`
- Hot reload enabled (watches for file changes)
- Full debugging support
- Swagger UI at `/swagger`
- Plugin management UI at `/`

**No need to:**
- ❌ Run Coordinator
- ❌ Run Proxy
- ❌ Manually copy plugin files
- ❌ Restart for plugin changes (in dev mode)

---

## Development Modes

### Current Setup: Inline Plugins

Plugins are `.cs` files in `Plugins/` folder:
- `TodosPlugin.cs`
- `UsersPlugin.cs`
- `WeatherPlugin.cs`

**Benefits:**
- ✅ Simplest setup
- ✅ Single project
- ✅ Automatic IntelliSense
- ✅ No project reference management

**To add a plugin:**
1. Create `Plugins/MyPlugin.cs`
2. Implement `IPlugin` interface
3. Run - it's automatically discovered

---

### Advanced: Separate Plugin Projects

For larger plugins or sharing between projects:

#### Step 1: Create Plugin Project

```bash
cd apps/handover/pivot/Plugins
dotnet new classlib -n MyAdvancedPlugin
```

#### Step 2: Add Pivot.Core Reference

In `MyAdvancedPlugin.csproj`:
```xml
<ItemGroup>
  <ProjectReference Include="../Pivot.Core/Pivot.Core.csproj" />
</ItemGroup>
```

#### Step 3: Enable IntelliSense in ApiExample

Create `ApiExample.Local.props` (this file is gitignored):
```xml
<Project>
  <ItemGroup>
    <ProjectReference Include="..\..\Plugins\MyAdvancedPlugin\MyAdvancedPlugin.csproj" />
  </ItemGroup>
</Project>
```

#### Step 4: Run Normally

```bash
dotnet run
```

The plugin is automatically:
- Built when ApiExample builds
- Copied to `bin/` folder
- Loaded by `LoadFromReferencedAssemblies`

---

## Debugging Workflow

### Debugging Plugins

1. Set breakpoint in plugin code (e.g., `TodosPlugin.cs`)
2. Press F5 or `dotnet run`
3. Make API request (e.g., `GET /api/todos`)
4. Breakpoint hits ✅

### Hot Reload

**File watching is enabled in development:**

1. Edit plugin code
2. Save file
3. ApiExample detects change and reloads
4. New code active (no restart needed)

**Note:** Some changes require restart:
- Adding new dependencies
- Changing `IPlugin` implementation structure
- Adding new service registrations

---

## Testing Plugin Enable/Disable

### Via UI

1. Navigate to `http://localhost:5200`
2. Use toggle switches to enable/disable plugins
3. Plugin endpoints appear/disappear in Swagger

### Via API

```bash
# Toggle plugin
curl -X POST http://localhost:5200/api/plugins/Todos/toggle

# Check status
curl http://localhost:5200/api/plugins
```

---

## Production Deployment

When you're ready to deploy:

### Step 1: Build for Release

```bash
dotnet publish -c Release
```

### Step 2: Run in Production Mode

Set environment variable:
```bash
export ASPNETCORE_ENVIRONMENT=Production
dotnet ApiExample.dll
```

**Behavior changes:**
- `LoadFromReferencedAssemblies = false`
- Plugins loaded from `plugins/` directory
- No hot reload (stability)
- Plugin deployment via repository pattern

---

## FAQ

**Q: Why does my Local.props file not exist?**
A: It's gitignored and optional. Create it only if you use separate plugin projects.

**Q: Can I use Coordinator in development?**
A: Yes, but it's more complex. See main Pivot documentation for full stack setup.

**Q: How do I share plugins between multiple backends?**
A: Use separate plugin projects and reference them via `.Local.props` in each backend.

**Q: My plugin changes aren't reloading?**
A: Check that `EnableAutoReload = true` and you're in Development mode. Some changes require restart.

---

## Troubleshooting

### Plugins Not Loading

1. Check `Program.cs` - ensure `LoadFromReferencedAssemblies = builder.Environment.IsDevelopment()`
2. Verify environment: `dotnet run --environment Development`
3. Check plugin implements `IPlugin` correctly
4. Look for errors in console output

### No IntelliSense for Plugin Types

1. If using inline plugins: should work automatically
2. If using separate projects: ensure `.Local.props` exists and references plugin project
3. Reload IDE (sometimes needed after adding references)

### Database Locked Errors

SQLite database is in use. Either:
- Stop running instance
- Delete `plugins.db` (state will reset)
