# TodosPlugin — Server

## Architecture

The server component provides a todo list API that demonstrates **cross-plugin dependency resolution**. It consumes `IUserService` from UsersPlugin to validate user assignments.

## Dependency on UsersPlugin

TodosPlugin declares a plugin dependency in `plugin.json`:

```json
{ "pluginDependencies": { "UsersPlugin": "^1.0.0" } }
```

At build time, the `.csproj` uses `Private="false"` to get IntelliSense without bundling:

```xml
<ProjectReference Include="../../UsersPlugin/server/UsersPlugin.csproj" Private="false" />
```

At runtime, the host loads UsersPlugin first (based on the dependency graph), making `IUserService` available in the DI container.

## Models

### `TodoItem`

| Property           | Type       | Description             |
| ------------------ | ---------- | ----------------------- |
| `Id`               | `int`      | Auto-incremented ID     |
| `Title`            | `string`   | Todo title              |
| `IsCompleted`      | `bool`     | Completion status       |
| `AssignedToUserId` | `int?`     | Optional link to a user |
| `CreatedAt`        | `DateTime` | UTC creation timestamp  |

## API Endpoints

### `GET /api/todos`

Returns all todo items.

### `GET /api/todos/{id}`

Returns a single todo by ID, or 404.

### `POST /api/todos?title=&assignedToUserId=`

Creates a new todo. If `assignedToUserId` is provided, validates the user exists via `IUserService`.

### `GET /api/todos/user/{userId}`

Returns the user (from UsersPlugin) and their assigned todos. Demonstrates cross-plugin data composition.
