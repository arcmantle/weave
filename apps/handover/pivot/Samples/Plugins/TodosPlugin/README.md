# TodosPlugin

A sample Pivot plugin providing a todo list API that demonstrates **cross-plugin dependencies** by consuming `IUserService` from the UsersPlugin.

## Endpoints

| Method | Path                       | Description                                       |
| ------ | -------------------------- | ------------------------------------------------- |
| `GET`  | `/api/todos`               | List all todo items                               |
| `GET`  | `/api/todos/{id}`          | Get a specific todo by ID                         |
| `POST` | `/api/todos`               | Create a new todo, optionally assigned to a user  |
| `GET`  | `/api/todos/user/{userId}` | Get all todos for a specific user                 |

## Cross-Plugin Dependency

This plugin depends on **UsersPlugin** `^1.0.0` and consumes its `IUserService`:

- When creating a todo with `assignedToUserId`, it validates the user exists via `IUserService.GetUserById()`
- The `/api/todos/user/{userId}` endpoint demonstrates fetching user data alongside todos

```json
{
  "pluginDependencies": {
    "UsersPlugin": "^1.0.0"
  }
}
```

## Build Pattern: `Private="false"`

TodosPlugin references UsersPlugin with `Private="false"` in its `.csproj`:

```xml
<ProjectReference Include="../UsersPlugin/UsersPlugin.csproj" Private="false" />
```

This gives full IntelliSense and type-checking at compile time **without bundling** UsersPlugin.dll into the output — the host loads both plugins independently.

## Package Dependencies

- **Newtonsoft.Json** `12.0.3`
- **Dapper** `2.0.0`
