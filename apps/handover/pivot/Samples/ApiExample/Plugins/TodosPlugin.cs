using Microsoft.AspNetCore.Builder;
using Pivot.Plugin;

namespace ApiExample.Plugins;

/// <summary>
/// Simple todo item model
/// </summary>
public class TodoItem
{
	public int Id { get; set; }
	public required string Title { get; set; }
	public bool IsCompleted { get; set; }
	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Plugin providing a simple todo list API
/// </summary>
public class TodosPlugin : IPlugin
{
	private static readonly List<TodoItem> _todos = new();
	private static int _nextId = 1;

	public string Name => "Todos";

	public void Initialize(WebApplicationBuilder builder)
	{
		// No services needed for this simple example
	}

	public void Configure(WebApplication app)
	{
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

		todos.MapPost("/", (TodoItem todo) =>
		{
			todo.Id = _nextId++;
			todo.CreatedAt = DateTime.UtcNow;
			_todos.Add(todo);
			return Results.Created($"/api/todos/{todo.Id}", todo);
		})
		.WithName("CreateTodo")
		.WithSummary("Create a new todo")
		.WithDescription("Adds a new todo item to the list");

		todos.MapPut("/{id}", (int id, TodoItem updatedTodo) =>
		{
			var todo = _todos.FirstOrDefault(t => t.Id == id);
			if (todo == null)
				return Results.NotFound();

			todo.Title = updatedTodo.Title;
			todo.IsCompleted = updatedTodo.IsCompleted;
			return Results.Ok(todo);
		})
		.WithName("UpdateTodo")
		.WithSummary("Update an existing todo")
		.WithDescription("Updates the title and completion status of a todo");

		todos.MapDelete("/{id}", (int id) =>
		{
			var todo = _todos.FirstOrDefault(t => t.Id == id);
			if (todo == null)
				return Results.NotFound();

			_todos.Remove(todo);
			return Results.NoContent();
		})
		.WithName("DeleteTodo")
		.WithSummary("Delete a todo")
		.WithDescription("Removes a todo item from the list");
	}
}
