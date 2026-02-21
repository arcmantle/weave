# Plugin-to-Plugin Dependencies Example

This demonstrates how plugins can depend on each other while maintaining independent builds and deployments.

## Architecture

**UsersPlugin** (Provider):
- Exposes `IUserService` via dependency injection
- Other plugins can consume this service
- Independent deployment

**TodosPlugin** (Consumer):
- Depends on `IUserService` from UsersPlugin
- Uses `Private="false"` for IntelliSense without bundling
- Validates todo assignments against users

## Key Pattern: `Private="false"`

```xml
<!-- TodosPlugin.csproj -->
<ItemGroup>
  <ProjectReference Include="../UsersPlugin/UsersPlugin.csproj" Private="false" />
</ItemGroup>
```

**What this does**:
- ✅ **IntelliSense works** - Full autocomplete, navigation, documentation
- ✅ **Compilation succeeds** - Types are available at compile time
- ❌ **Doesn't bundle UsersPlugin.dll** - Won't copy to output directory
- ✅ **Independent deployment** - Each plugin builds separately

## Build Output

```
TodosPlugin/bin/Debug/net9.0/
├── TodosPlugin.dll          ← Only TodosPlugin
├── Pivot.Core.dll           ← Shared framework
└── (No UsersPlugin.dll!)    ← Not bundled!

UsersPlugin/bin/Debug/net9.0/
├── UsersPlugin.dll
└── Pivot.Core.dll
```

## Runtime Behavior

The **host** is responsible for:
1. Loading both plugins
2. Loading in dependency order (UsersPlugin before TodosPlugin)
3. Both plugins share the same DI container

```csharp
// UsersPlugin registers service
builder.Services.AddSingleton<IUserService, UserService>();

// TodosPlugin consumes it
var userService = app.Services.GetRequiredService<IUserService>();
```

## API Demonstration

**Create a user** (UsersPlugin):
```bash
POST /api/users?username=john&email=john@example.com
```

**Create a todo assigned to that user** (TodosPlugin):
```bash
POST /api/todos?title=Buy%20milk&assignedToUserId=3
```

**Get todos for a user** (cross-plugin):
```bash
GET /api/todos/user/3
```

This validates the user exists using `IUserService` from UsersPlugin!

## Production Deployment

```
production/
└── plugins/
    ├── UsersPlugin/
    │   └── UsersPlugin.dll
    └── TodosPlugin/
        └── TodosPlugin.dll
```

Both plugins deployed independently. Host loads UsersPlugin first, then TodosPlugin can resolve `IUserService` from DI.

## Future: Plugin Manifests

For automatic dependency resolution:

```json
// TodosPlugin/plugin.json
{
  "name": "TodosPlugin",
  "version": "1.0.0",
  "pluginDependencies": {
    "UsersPlugin": "^1.0.0"
  }
}
```

The host would use this to determine load order automatically.
