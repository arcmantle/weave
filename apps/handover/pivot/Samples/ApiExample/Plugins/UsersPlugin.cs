using Microsoft.AspNetCore.Builder;
using Pivot.Plugin;

namespace ApiExample.Plugins;

/// <summary>
/// User model
/// </summary>
public class User
{
	public int Id { get; set; }
	public required string Username { get; set; }
	public required string Email { get; set; }
	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Plugin providing user management API
/// </summary>
public class UsersPlugin : IPlugin
{
	private static readonly List<User> _users = new()
	{
		new User { Id = 1, Username = "admin", Email = "admin@example.com" },
		new User { Id = 2, Username = "user", Email = "user@example.com" }
	};
	private static int _nextId = 3;

	public string Name => "Users";

	public void Initialize(WebApplicationBuilder builder)
	{
		// No services needed for this simple example
	}

	public void Configure(WebApplication app)
	{
		var users = app.MapGroup("/api/users")
			.WithTags("Users")
			.WithOpenApi();

		users.MapGet("/", () => _users)
			.WithName("GetUsers")
			.WithSummary("Get all users")
			.WithDescription("Returns all registered users");

		users.MapGet("/{id}", (int id) =>
		{
			var user = _users.FirstOrDefault(u => u.Id == id);
			return user != null ? Results.Ok(user) : Results.NotFound();
		})
		.WithName("GetUserById")
		.WithSummary("Get a specific user by ID")
		.WithDescription("Returns a single user by their ID");

		users.MapPost("/", (User user) =>
		{
			user.Id = _nextId++;
			user.CreatedAt = DateTime.UtcNow;
			_users.Add(user);
			return Results.Created($"/api/users/{user.Id}", user);
		})
		.WithName("CreateUser")
		.WithSummary("Create a new user")
		.WithDescription("Registers a new user in the system");

		users.MapPut("/{id}", (int id, User updatedUser) =>
		{
			var user = _users.FirstOrDefault(u => u.Id == id);
			if (user == null)
				return Results.NotFound();

			user.Username = updatedUser.Username;
			user.Email = updatedUser.Email;
			return Results.Ok(user);
		})
		.WithName("UpdateUser")
		.WithSummary("Update an existing user")
		.WithDescription("Updates a user's information");

		users.MapDelete("/{id}", (int id) =>
		{
			var user = _users.FirstOrDefault(u => u.Id == id);
			if (user == null)
				return Results.NotFound();

			_users.Remove(user);
			return Results.NoContent();
		})
		.WithName("DeleteUser")
		.WithSummary("Delete a user")
		.WithDescription("Removes a user from the system");
	}
}
