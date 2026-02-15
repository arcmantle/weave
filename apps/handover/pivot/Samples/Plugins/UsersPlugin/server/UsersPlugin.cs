using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Pivot.Plugin;

namespace UsersPlugin;

/// <summary>
/// User model
/// </summary>
public class User {
	public int Id { get; set; }
	public required string Username { get; set; }
	public required string Email { get; set; }
	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Service interface exposed by UsersPlugin for other plugins to consume
/// </summary>
public interface IUserService {
	User? GetUserById(int id);
	IEnumerable<User> GetAllUsers();
	User CreateUser(string username, string email);
}

/// <summary>
/// Implementation of user service
/// </summary>
public class UserService : IUserService {
	private static readonly List<User> _users = new()
	{
		new User { Id = 1, Username = "admin", Email = "admin@example.com" },
		new User { Id = 2, Username = "user", Email = "user@example.com" }
	};

	private static int _nextId = 3;

	public User? GetUserById(int id) => _users.FirstOrDefault(u => u.Id == id);

	public IEnumerable<User> GetAllUsers() => _users;

	public User CreateUser(string username, string email) {
		var user = new User { Id = _nextId++, Username = username, Email = email };
		_users.Add(user);
		return user;
	}
}

/// <summary>
/// Plugin providing user management API
/// </summary>
public class UsersPlugin : IPlugin {
	public string Name => "Users";

	public void Initialize(WebApplicationBuilder builder) {
		// Register IUserService so other plugins can consume it
		builder.Services.AddSingleton<IUserService, UserService>();
	}

	public void Configure(WebApplication app) {
		var userService = app.Services.GetRequiredService<IUserService>();

		var users = app.MapGroup("/api/users")
			.WithTags("Users");

		users.MapGet("/", () => userService.GetAllUsers())
			.WithName("GetUsers")
			.WithSummary("Get all users")
			.WithDescription("Returns all registered users");

		users.MapGet("/{id}", (int id) => {
			var user = userService.GetUserById(id);
			return user != null ? Results.Ok(user) : Results.NotFound();
		})
		.WithName("GetUserById")
		.WithSummary("Get a specific user by ID")
		.WithDescription("Returns a single user by their ID");

		users.MapPost("/", (string username, string email) => {
			var user = userService.CreateUser(username, email);
			return Results.Created($"/api/users/{user.Id}", user);
		})
		.WithName("CreateUser")
		.WithSummary("Create a new user")
		.WithDescription("Registers a new user in the system");
	}
}
