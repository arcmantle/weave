# Weave.Changelog

A C# .NET library for tracking and managing changes to objects over time. This is a port of the TypeScript `@weave/changelog` library.

## Features

- **Automatic diff computation** between old and new states
- **Persistent change history** with flexible storage backends
- **Change grouping** (similar to git commits) for logical batching of related changes
- **Fine-grained change records** with paths to specific properties
- **Transaction support** with rollback capabilities

## Installation

Add the project reference to your `.csproj` file:

```xml
<ItemGroup>
  <ProjectReference Include="path/to/Changelog.csproj" />
</ItemGroup>
```

## Quick Start

```csharp
using Changelog;
using Changelog.Storage;

// Create a storage backend
var storage = new MemoryStorage<MyDocument>();

// Create a changelog instance for a specific document
var changelog = new Changelog<MyDocument>(storage, "document-1");

// Set initial state
await changelog.SetDocumentAsync(new MyDocument
{
    Title = "My Document",
    Content = "Hello world"
});

// Make changes - the library automatically computes the diff
await changelog.ApplyChangesAsync(new MyDocument
{
    Title = "My Document",
    Content = "Hello world! Updated content."
});

// Get the change history
var history = await changelog.GetHistoryAsync();
foreach (var change in history)
{
    Console.WriteLine($"Changed: {string.Join(".", change.Path)}");
    Console.WriteLine($"From: {change.OldValue} To: {change.NewValue}");
}
```

## Grouping Changes

Group multiple changes together with metadata:

```csharp
// Start a new change group
var groupId = await changelog.BeginGroupAsync(new Dictionary<string, object>
{
    ["author"] = "user@example.com",
    ["message"] = "Update document metadata"
});

// Make multiple changes
await changelog.ApplyChangesAsync(newState1);
await changelog.ApplyChangesAsync(newState2);

// Commit the group
await changelog.CommitGroupAsync();

// Or rollback if needed
// await changelog.RollbackGroupAsync();
```

## Advanced Usage

### Querying History

```csharp
// Get changes since a specific timestamp
var recentChanges = await changelog.GetHistoryAsync(new QueryOptions
{
    Since = DateTimeOffset.UtcNow.AddHours(-1).ToUnixTimeMilliseconds()
});

// Get changes for a specific group
var groupChanges = await changelog.GetHistoryAsync(new QueryOptions
{
    GroupId = "g1"
});

// Limit number of results
var latest = await changelog.GetHistoryAsync(new QueryOptions
{
    Limit = 10
});
```

### Custom Diff Computation

```csharp
var oldDoc = new { count = 0, name = "test" };
var newDoc = new { count = 5, name = "test" };

// Compute the diff
var differences = DiffEngine.Diff(oldDoc, newDoc);

// Apply the diff to another object
var result = DiffEngine.ApplyDiff(oldDoc, differences);
```

## Storage Backends

Currently available:
- **MemoryStorage**: In-memory storage for testing and simple use cases

You can implement your own storage backend by implementing the `IChangelogStorage<T>` interface.

## License

MIT
