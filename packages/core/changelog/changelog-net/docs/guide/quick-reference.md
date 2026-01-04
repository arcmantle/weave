---
title: Quick Reference
description: Quick reference for common Changelog operations
---

# Quick Reference

Common operations and code snippets for Changelog.

## Basic Operations

### Track a Change

```csharp
var changelog = new Changelog<User>(storage, "user-123");
var user = new User { Name = "Alice", Email = "alice@example.com" };

// First save
await changelog.ApplyChangesAsync(user);

// Update
user.Email = "alice.smith@example.com";
await changelog.ApplyChangesAsync(user);
```

### Track with Old/New State

```csharp
var oldUser = await repository.GetByIdAsync(userId);
var newUser = oldUser with { Email = "newemail@example.com" };

await changelog.ApplyChangesAsync(oldUser, newUser);
await repository.UpdateAsync(newUser);
```

### Get Change History

```csharp
// Get all changes
var allChanges = await changelog.GetHistoryAsync();

// Get latest 10 changes
var recent = await changelog.GetHistoryAsync(limit: 10);

// Stream changes for large histories
await foreach (var change in changelog.GetHistoryAsync())
{
    Console.WriteLine($"{change.Timestamp}: {change.Changes.Count} changes");
}
```

### Restore Previous State

```csharp
// Get state at a specific time
var stateAtTime = await changelog.GetStateAtAsync(DateTime.UtcNow.AddDays(-7));

// Get state from specific change
var history = await changelog.GetHistoryAsync(limit: 1);
var previousState = history[0].State;
```

## Change Groups

### Group Related Changes

```csharp
var group = await changelog.BeginGroupAsync("Update profile");

try
{
    user.Name = "Alice Smith";
    await changelog.ApplyChangesAsync(user);

    user.Email = "alice.smith@example.com";
    await changelog.ApplyChangesAsync(user);

    await group.CommitAsync();
}
catch
{
    // Changes are still tracked even if not committed
    throw;
}
```

### Query by Group

```csharp
var history = await changelog.GetHistoryAsync();
var profileUpdates = history.Where(c => c.GroupId == group.Id);
```

## Storage Providers

### Memory Storage

```csharp
var storage = new MemoryStorage<User>();
var changelog = new Changelog<User>(storage, "doc-1");
```

### SQLite Storage

```csharp
var storage = new SqliteStorage<User>("Data Source=changelog.db");
var changelog = new Changelog<User>(storage, "doc-1");
```

### PostgreSQL Storage

```csharp
var options = new PostgresStorageOptions
{
    Schema = "changelog",
    TablePrefix = "app_"
};

var storage = new PostgresStorage<User>(
    "Host=localhost;Database=myapp",
    options
);

var changelog = new Changelog<User>(storage, "doc-1");
```

### MongoDB Storage

```csharp
var storage = new MongoStorage<User>(
    "mongodb://localhost:27017",
    databaseName: "myapp"
);

var changelog = new Changelog<User>(storage, "doc-1");
```

## Decorators

### Add Caching

```csharp
var baseStorage = new PostgresStorage<User>(connectionString);
var cachedStorage = new CachedStorage<User>(baseStorage);

var changelog = new Changelog<User>(cachedStorage, "doc-1");
```

### Add Compression

```csharp
var baseStorage = new PostgresStorage<User>(connectionString);
var compressedStorage = new CompressedStorage<User>(baseStorage);

var changelog = new Changelog<User>(compressedStorage, "doc-1");
```

### Combine Decorators

```csharp
var baseStorage = new PostgresStorage<User>(connectionString);
var cachedStorage = new CachedStorage<User>(baseStorage);
var compressedStorage = new CompressedStorage<User>(cachedStorage);

var changelog = new Changelog<User>(compressedStorage, "doc-1");
```

## Retention Policies

### Auto-Delete Old Changes

```csharp
// Delete changes older than 90 days
await changelog.ApplyRetentionPolicyAsync(maxAge: TimeSpan.FromDays(90));

// Keep only last 1000 changes
await changelog.ApplyRetentionPolicyAsync(maxCount: 1000);

// Combine both
await changelog.ApplyRetentionPolicyAsync(
    maxAge: TimeSpan.FromDays(90),
    maxCount: 1000
);
```

## Async Patterns

### Parallel Change Tracking

```csharp
var tasks = users.Select(async user =>
{
    var changelog = new Changelog<User>(storage, user.Id);
    await changelog.ApplyChangesAsync(user);
});

await Task.WhenAll(tasks);
```

### Stream Large Histories

```csharp
await foreach (var change in changelog.GetHistoryAsync())
{
    if (SomeCondition(change))
    {
        // Process without loading entire history into memory
        await ProcessChangeAsync(change);
    }
}
```

## Error Handling

### Basic Try-Catch

```csharp
try
{
    await changelog.ApplyChangesAsync(user);
}
catch (ChangelogStorageException ex)
{
    _logger.LogError(ex, "Failed to save changes for user {UserId}", userId);
    throw;
}
```

### With Transactions

```csharp
var group = await changelog.BeginGroupAsync("Critical update");

try
{
    await changelog.ApplyChangesAsync(user);
    await group.CommitAsync();
}
catch (Exception ex)
{
    _logger.LogError(ex, "Change group failed");
    // Group is not committed, but changes are still tracked
    throw;
}
```

## Observability

### OpenTelemetry Metrics

```csharp
using var meterProvider = Sdk.CreateMeterProviderBuilder()
    .AddMeter("Changelog")
    .AddConsoleExporter()
    .Build();

// Metrics are automatically tracked:
// - changelog.changes.applied (counter)
// - changelog.diff.duration (histogram)
// - changelog.storage.duration (histogram)
```

### Distributed Tracing

```csharp
using var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource("Changelog")
    .AddConsoleExporter()
    .Build();

// Activities are automatically created:
// - ApplyChanges
// - GetHistory
// - GetStateAt
// - CalculateDiff
```

## Custom Types

### Complex Objects

```csharp
public class Order
{
    public string Id { get; set; }
    public List<OrderItem> Items { get; set; }
    public Address ShippingAddress { get; set; }
    public decimal Total { get; set; }
}

// All nested properties are tracked
var changelog = new Changelog<Order>(storage, "order-123");
await changelog.ApplyChangesAsync(order);
```

### Collections

```csharp
// Arrays, Lists, Dictionaries are all supported
var doc = new Dictionary<string, object>
{
    ["tags"] = new[] { "important", "urgent" },
    ["metadata"] = new Dictionary<string, string>
    {
        ["author"] = "Alice",
        ["version"] = "1.0"
    }
};

await changelog.ApplyChangesAsync(doc);
```

## Performance Tips

### Use Compiled Accessors

```csharp
// Automatically used - 5-10x faster than reflection
// No configuration needed
```

### Enable Caching

```csharp
// Cache frequently accessed documents
var cachedStorage = new CachedStorage<User>(baseStorage);
```

### Use Compression

```csharp
// Reduce storage size for large documents
var compressedStorage = new CompressedStorage<User>(baseStorage);
```

### Stream History

```csharp
// Don't load everything into memory
await foreach (var change in changelog.GetHistoryAsync())
{
    await ProcessAsync(change);
}
```

## Common Patterns

### Side-Car Pattern

```csharp
// Your main database
var user = await userRepository.GetByIdAsync(userId);

// Make changes
user.Email = "newemail@example.com";

// Track in side-car
var changelog = new Changelog<User>(storage, userId);
await changelog.ApplyChangesAsync(oldUser, user);

// Save to main database
await userRepository.UpdateAsync(user);
```

### Primary Storage Pattern

```csharp
// Changelog is your database
var changelog = new Changelog<User>(storage, userId);

// Save new state
await changelog.ApplyChangesAsync(user);

// Retrieve current state
var history = await changelog.GetHistoryAsync(limit: 1);
var currentUser = history[0].State;
```

### Audit Log Pattern

```csharp
var group = await changelog.BeginGroupAsync("Admin action", new
{
    AdminId = adminUserId,
    Reason = "Compliance update"
});

user.Status = UserStatus.Suspended;
await changelog.ApplyChangesAsync(user);

await group.CommitAsync();
```
