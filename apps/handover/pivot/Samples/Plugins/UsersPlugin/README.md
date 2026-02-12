# UsersPlugin

A sample Pivot plugin providing user management with a shared `IUserService` for cross-plugin consumption.

## Endpoints

| Method | Path              | Description               |
| ------ | ----------------- | ------------------------- |
| `GET`  | `/api/users`      | List all registered users |
| `GET`  | `/api/users/{id}` | Get a user by their ID    |
| `POST` | `/api/users`      | Create a new user         |

## Shared Service: `IUserService`

This plugin registers `IUserService` into the DI container so other plugins can consume it:

```csharp
public interface IUserService {
    User? GetUserById(int id);
    IEnumerable<User> GetAllUsers();
    User CreateUser(string username, string email);
}
```

### Consuming from another plugin

```csharp
public void Configure(WebApplication app) {
    var userService = app.Services.GetRequiredService<IUserService>();
    var user = userService.GetUserById(1);
}
```

## Default Users

The plugin ships with two default users:

| ID | Username | Email                 |
| -- | -------- | --------------------- |
| 1  | `admin`  | `admin@example.com`   |
| 2  | `user`   | `user@example.com`    |

## Dependencies

No plugin or package dependencies — this is a foundational plugin.
