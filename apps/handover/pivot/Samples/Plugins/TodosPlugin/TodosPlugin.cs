using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Pivot.Plugin;
using UsersPlugin;

namespace TodosPlugin;

/// <summary>
/// Simple todo item model
/// </summary>
public class TodoItem
{
	public int Id { get; set; }
	public required string Title { get; set; }
	public bool IsCompleted { get; set; }
	public int? AssignedToUserId { get; set; }  // Link to user from UsersPlugin
	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Plugin providing a simple todo list API that depends on UsersPlugin
/// </summary>
public class TodosPlugin : IPlugin
{
	private static readonly List<TodoItem> _todos = new();
	private static int _nextId = 1;

	public string Name => "Todos";

	public void Initialize(WebApplicationBuilder builder)
	{
		// This plugin doesn't provide any services, but consumes IUserService from UsersPlugin
	}

	public void Configure(WebApplication app)
	{
		// Consume IUserService provided by UsersPlugin
		var userService = app.Services.GetRequiredService<IUserService>();

		var todos = app.MapGroup("/api/todos")
			.WithTags("Todos")
			.WithOpenApi();

		todos.MapGet("/", () => _todos)
			.WithName("GetTodos")
			.WithSummary("Get all todos")
			.WithDescription("Returns all todo items in the list");

		todos.MapGet("/{id}", (int id) =>
		{
			var todo = _todos.FirstOrDefault(t => t.Id == id);
			return todo != null ? Results.Ok(todo) : Results.NotFound();
		})
		.WithName("GetTodoById")
		.WithSummary("Get a specific todo by ID")
		.WithDescription("Returns a single todo item by its ID");

		todos.MapPost("/", (string title, int? assignedToUserId) =>
		{
			// Validate that user exists if assignedToUserId is provided
			if (assignedToUserId.HasValue)
			{
				var user = userService.GetUserById(assignedToUserId.Value);
				if (user == null)
					return Results.BadRequest(new { error = "User not found" });
			}

			var todo = new TodoItem
			{
				Id = _nextId++,
				Title = title,
				AssignedToUserId = assignedToUserId,
				CreatedAt = DateTime.UtcNow
			};
			_todos.Add(todo);
			return Results.Created($"/api/todos/{todo.Id}", todo);
		})
		.WithName("CreateTodo")
		.WithSummary("Create a new todo")
		.WithDescription("Adds a new todo item to the list, optionally assigned to a user");

		todos.MapGet("/user/{userId}", (int userId) =>
		{
			// Demonstrate cross-plugin functionality: get todos for a specific user
			var user = userService.GetUserById(userId);
			if (user == null)
				return Results.NotFound(new { error = "User not found" });

			var userTodos = _todos.Where(t => t.AssignedToUserId == userId).ToList();
			return Results.Ok(new { user, todos = userTodos });
		})
		.WithName("GetTodosByUser")
		.WithSummary("Get all todos for a specific user")
		.WithDescription("Returns all todos assigned to a user (demonstrates plugin-to-plugin communication)");
	}
}
