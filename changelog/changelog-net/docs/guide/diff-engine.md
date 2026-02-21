---
title: Diff Engine
description: How the intelligent diff engine tracks changes
---

# Diff Engine

Changelog's diff engine analyzes two versions of your document and generates a
precise list of what changed. It works with any .NET type using compiled
property accessors for high performance.

## How It Works

### Basic Diffing

When you call `ApplyChangesAsync`, the diff engine:

1. **Analyzes the type** — Uses reflection and builds compiled accessors
   (cached for reuse)
2. **Compares properties** — Recursively compares old vs new values
3. **Generates changes** — Creates a list of property paths and new values
4. **Stores the diff** — Saves only what changed, not the entire document

```csharp
var oldUser = new User { Name = "Alice", Email = "alice@example.com" };
var newUser = new User { Name = "Alice Smith", Email = "alice@example.com" };

await changelog.ApplyChangesAsync(oldUser, newUser);

// Stored change:
// {
//   "path": "Name",
//   "oldValue": "Alice",
//   "newValue": "Alice Smith"
// }
```

### Nested Objects

The diff engine recursively compares nested objects:

```csharp
public class User
{
    public string Name { get; set; }
    public Address Address { get; set; }
}

public class Address
{
    public string Street { get; set; }
    public string City { get; set; }
}

var oldUser = new User
{
    Name = "Alice",
    Address = new Address { Street = "123 Main St", City = "Portland" }
};

var newUser = new User
{
    Name = "Alice",
    Address = new Address { Street = "456 Oak Ave", City = "Portland" }
};

await changelog.ApplyChangesAsync(oldUser, newUser);

// Stored change:
// {
//   "path": "Address.Street",
//   "oldValue": "123 Main St",
//   "newValue": "456 Oak Ave"
// }
```

### Collections and Arrays

Arrays and lists use the **Longest Common Subsequence (LCS)** algorithm to
generate minimal diffs:

```csharp
var oldDoc = new
{
    Tags = new[] { "important", "urgent", "reviewed" }
};

var newDoc = new
{
    Tags = new[] { "important", "archived", "reviewed" }
};

await changelog.ApplyChangesAsync(oldDoc, newDoc);

// Stored change:
// {
//   "path": "Tags[1]",
//   "oldValue": "urgent",
//   "newValue": "archived"
// }
```

The LCS algorithm identifies:

- **Unchanged items** (important, reviewed) — not recorded
- **Modified items** (urgent → archived) — recorded as change
- **Added items** — recorded as insertions
- **Deleted items** — recorded as removals

### Dictionaries

Dictionary changes track key additions, removals, and value changes:

```csharp
var oldDoc = new Dictionary<string, object>
{
    ["name"] = "Alice",
    ["email"] = "alice@example.com",
    ["role"] = "user"
};

var newDoc = new Dictionary<string, object>
{
    ["name"] = "Alice",
    ["email"] = "alice.smith@example.com",
    ["department"] = "Engineering"
    // "role" removed
};

await changelog.ApplyChangesAsync(oldDoc, newDoc);

// Stored changes:
// [
//   { "path": "email", "oldValue": "alice@example.com",
//     "newValue": "alice.smith@example.com" },
//   { "path": "role", "oldValue": "user", "newValue": null },
//   { "path": "department", "oldValue": null, "newValue": "Engineering" }
// ]
```

## Property Accessors

### Compiled Expression Trees

For maximum performance, the diff engine compiles property accessors using
expression trees:

```csharp
// Generated accessor (conceptual):
Func<User, string> getEmail = (User user) => user.Email;
Action<User, string> setEmail = (User user, string value) => user.Email = value;
```

This is **5-10x faster** than reflection and runs at near-native speed.

### Accessor Caching

Compiled accessors are cached per type, so subsequent diff operations reuse them:

```csharp
// First diff compiles accessors
await changelog1.ApplyChangesAsync(user1);

// Second diff reuses compiled accessors (fast!)
await changelog2.ApplyChangesAsync(user2);
```

## Change Types

The diff engine generates these change types:

### Property Change

```json
{
  "path": "Email",
  "oldValue": "alice@example.com",
  "newValue": "alice.smith@example.com"
}
```

### Array Element Change

```json
{
  "path": "Tags[1]",
  "oldValue": "urgent",
  "newValue": "archived"
}
```

### Array Insertion

```json
{
  "path": "Tags[2]",
  "oldValue": null,
  "newValue": "new-tag"
}
```

### Array Deletion

```json
{
  "path": "Tags[1]",
  "oldValue": "removed-tag",
  "newValue": null
}
```

### Nested Property Change

```json
{
  "path": "Address.City",
  "oldValue": "Portland",
  "newValue": "Seattle"
}
```

## Advanced Scenarios

### Complex Types

The diff engine works with records, structs, and classes:

```csharp
public record User(string Name, string Email, Address Address);
public record Address(string Street, string City);

var oldUser = new User("Alice", "alice@example.com", new Address("123 Main", "Portland"));
var newUser = oldUser with { Email = "alice.smith@example.com" };

await changelog.ApplyChangesAsync(oldUser, newUser);
```

### Nullable Types

Null values are handled correctly:

```csharp
var oldUser = new User { Name = "Alice", Email = null };
var newUser = new User { Name = "Alice", Email = "alice@example.com" };

await changelog.ApplyChangesAsync(oldUser, newUser);

// Change:
// {
//   "path": "Email",
//   "oldValue": null,
//   "newValue": "alice@example.com"
// }
```

### Custom Serialization

The diff engine uses JSON serialization for storage, so types must be serializable:

```csharp
public class User
{
    public string Name { get; set; }

    [JsonIgnore] // Ignored by diff engine
    public string TemporaryValue { get; set; }
}
```

## Performance Considerations

### What's Fast

- **Simple properties** — Direct compiled access
- **Shallow objects** — Fewer properties to compare
- **Small collections** — LCS is O(n*m) but optimized for small arrays

### What's Slower

- **Deep nesting** — Recursive comparisons take time
- **Large arrays** — LCS complexity grows quadratically
- **Many properties** — More comparisons required

### Optimization Tips

#### 1. Limit Nesting Depth

```csharp
// Good: Shallow structure
public class User
{
    public string Name { get; set; }
    public string Email { get; set; }
}

// Slower: Deep nesting
public class User
{
    public Profile Profile { get; set; }
}
public class Profile
{
    public PersonalInfo PersonalInfo { get; set; }
}
public class PersonalInfo
{
    public Name Name { get; set; }
}
```

#### 2. Use Records for Immutability

```csharp
// Records generate efficient equality comparisons
public record User(string Name, string Email);

var newUser = oldUser with { Email = "newemail@example.com" };
```

#### 3. Avoid Unnecessary Properties

```csharp
public class User
{
    public string Name { get; set; }

    [JsonIgnore] // Don't track this
    public DateTime LastModified { get; set; }
}
```

#### 4. Batch Updates

```csharp
// Bad: Many small diffs
user.Name = "Alice";
await changelog.ApplyChangesAsync(user);
user.Email = "alice@example.com";
await changelog.ApplyChangesAsync(user);

// Good: One diff with both changes
user.Name = "Alice";
user.Email = "alice@example.com";
await changelog.ApplyChangesAsync(user);
```

## Metrics and Observability

The diff engine emits OpenTelemetry metrics:

### Diff Duration

Tracks how long diff calculations take:

```csharp
// Metric: changelog.diff.duration (histogram)
// Tags: document_type, property_count
```

Monitor this to identify performance bottlenecks with specific types.

### Change Count

Tracks how many changes were detected:

```csharp
// Metric: changelog.changes.applied (counter)
// Tags: document_type, change_count
```

## Debugging Diffs

### Enable Logging

```csharp
using Microsoft.Extensions.Logging;

var loggerFactory = LoggerFactory.Create(builder =>
{
    builder.AddConsole();
    builder.SetMinimumLevel(LogLevel.Debug);
});

var logger = loggerFactory.CreateLogger<Changelog<User>>();
var changelog = new Changelog<User>(storage, "user-123", logger);

await changelog.ApplyChangesAsync(user);
// Logs: Calculated diff with 3 changes in 2.5ms
```

### Inspect Generated Changes

```csharp
var history = await changelog.GetHistoryAsync(limit: 1);
var latestChange = history[0];

foreach (var change in latestChange.Changes)
{
    Console.WriteLine($"{change.Path}: {change.OldValue} → {change.NewValue}");
}
```

## Next Steps

- Learn about [change groups](/guide/change-groups)
- Understand [change history](/guide/change-history)
- Explore [performance tuning](/guide/performance)
