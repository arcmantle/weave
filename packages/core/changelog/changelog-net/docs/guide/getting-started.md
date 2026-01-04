---
title: Getting Started with Changelog
description: Learn how to use Changelog to track document changes in your .NET application
---

# Getting Started

Changelog is a .NET library for tracking changes to your domain models over
time. It provides intelligent diff computation, flexible storage backends, and
powerful querying capabilities.

## What is Changelog?

Changelog helps you:

- ✅ **Track all changes** to your documents with detailed history
- ✅ **Group related changes** together like Git commits
- ✅ **Query history** by time range, user, or change type
- ✅ **Use as a side-car** alongside your existing database
- ✅ **Choose your storage** - SQLite, PostgreSQL, MongoDB, or in-memory
- ✅ **Optimize performance** with caching, compression, and streaming

## Installation

Install the core package and your preferred storage provider:

::: code-group

```bash [SQLite]
dotnet add package Changelog.Core
dotnet add package Changelog.Sqlite
```

```bash [PostgreSQL]
dotnet add package Changelog.Core
dotnet add package Changelog.PostgreSQL
```

```bash [MongoDB]
dotnet add package Changelog.Core
dotnet add package Changelog.MongoDB
```

:::

## Your First Changelog

Let's create a simple example tracking changes to a `User` model:

### 1. Define Your Model

```csharp
public class User
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
    public string Role { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

### 2. Create a Changelog Instance

```csharp
using Changelog;
using Changelog.Storage;

// Choose a storage provider
var storage = new SqliteStorage<User>("Data Source=changelog.db");

// Create a changelog for a specific document
var changelog = new Changelog<User>(
    storage,
    documentId: "user-123"
);
```

### 3. Track Changes

#### Option A: Let Changelog Load Old State (Primary Storage Pattern)

```csharp
// Changelog loads the old state from its own storage
var user = await changelog.GetDocumentAsync();

if (user == null)
{
    user = new User { Id = "user-123", Name = "Alice" };
}

user.Email = "alice@example.com";
user.Role = "admin";

await changelog.ApplyChangesAsync(user);
```

#### Option B: Provide Old State Explicitly (Side-car Pattern)

```csharp
// Load from YOUR database
var oldUser = await userRepository.GetByIdAsync("user-123");

// Make changes
var updatedUser = oldUser with {
    Email = "alice@example.com",
    Role = "admin"
};

// Track changes (doesn't need to load from changelog storage)
await changelog.ApplyChangesAsync(oldUser, updatedUser);

// Save to YOUR database
await userRepository.UpdateAsync(updatedUser);
```

### 4. Query History

```csharp
// Get recent changes
var history = await changelog.GetHistoryAsync(new QueryOptions
{
    Since = DateTimeOffset.UtcNow.AddDays(-7).ToUnixTimeMilliseconds(),
    Limit = 50
});

foreach (var change in history)
{
    Console.WriteLine($"Path: {string.Join(".", change.Path)}");
    Console.WriteLine($"Old: {change.OldValue} → New: {change.NewValue}");
    Console.WriteLine($"Time: {DateTimeOffset.FromUnixTimeMilliseconds(change.Timestamp)}");
    Console.WriteLine();
}
```

## Change Groups

Group related changes together like Git commits:

```csharp
// Start a group
var groupId = await changelog.BeginGroupAsync(new Dictionary<string, object>
{
    ["author"] = "admin@example.com",
    ["message"] = "Promoted user to admin role",
    ["ipAddress"] = "192.168.1.100"
});

// Make multiple changes
user.Role = "admin";
user.Permissions = new[] { "read", "write", "delete" };
user.LastModified = DateTime.UtcNow;

await changelog.ApplyChangesAsync(user);

// Commit the group (atomic)
await changelog.CommitGroupAsync();
```

All changes will be grouped together with the metadata you provided.

## Streaming Large Results

For large history queries, use streaming to avoid loading everything into memory:

```csharp
await foreach (var change in changelog.GetHistoryStreamAsync(new QueryOptions
{
    Since = veryOldTimestamp,
    Limit = 10000
}))
{
    // Process one change at a time
    ProcessChange(change);
}
```

## What Changed?

Changelog automatically detects changes using a high-performance diff engine:

```csharp
// Before
var oldUser = new User
{
    Name = "Alice",
    Email = "alice@old.com",
    Role = "user",
    Permissions = new[] { "read" }
};

// After
var newUser = new User
{
    Name = "Alice",
    Email = "alice@new.com",  // Changed
    Role = "admin",            // Changed
    Permissions = new[] { "read", "write", "delete" } // Array changed
};

await changelog.ApplyChangesAsync(oldUser, newUser);

// Changelog stores:
// - Path: ["Email"], Old: "alice@old.com", New: "alice@new.com"
// - Path: ["Role"], Old: "user", New: "admin"
// - Path: ["Permissions", "1"], New: "write" (Added)
// - Path: ["Permissions", "2"], New: "delete" (Added)
```

## Next Steps

- Learn about [storage providers](/storage/) and their features
- Understand [change groups](/guide/change-groups) for atomic operations
- Explore [performance optimizations](/guide/performance) with decorators
- Set up [observability](/guide/observability) with OpenTelemetry
