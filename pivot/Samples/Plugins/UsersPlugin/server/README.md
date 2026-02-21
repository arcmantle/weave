# UsersPlugin — Server

## Architecture

The server component provides user management through a minimal API and exposes `IUserService` via dependency injection for cross-plugin consumption.

## Shared Service

`IUserService` is registered as a singleton in `Initialize()`:

```csharp
builder.Services.AddSingleton<IUserService, UserService>();
```

Other plugins can resolve it from the DI container without referencing the implementation:

```csharp
var userService = app.Services.GetRequiredService<IUserService>();
```

## Models

### `User`

| Property    | Type       | Description            |
| ----------- | ---------- | ---------------------- |
| `Id`        | `int`      | Auto-incremented ID    |
| `Username`  | `string`   | Unique username        |
| `Email`     | `string`   | Email address          |
| `CreatedAt` | `DateTime` | UTC creation timestamp |

## API Endpoints

### `GET /api/users`

Returns all registered users.

### `GET /api/users/{id}`

Returns a single user by ID, or 404.

### `POST /api/users?username=&email=`

Creates and returns a new user.

## Seed Data

Two users are pre-populated: `admin` and `user`.
