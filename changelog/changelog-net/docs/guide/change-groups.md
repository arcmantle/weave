---
title: Change Groups
description: Group related changes together
---

# Change Groups

Change groups let you logically group multiple related changes under a single
transaction-like scope with metadata. This is useful for audit trails,
debugging, and understanding the context of changes.

## What Are Change Groups?

A change group represents a set of related changes with:

- **Group ID** — Unique identifier for the group
- **Label** — Human-readable description
- **Metadata** — Optional additional context (user ID, reason, etc.)
- **Timestamp** — When the group was created
- **Committed** — Whether the group was successfully completed

## Basic Usage

### Create a Change Group

```csharp
var group = await changelog.BeginGroupAsync("Update user profile");

try
{
    // Make multiple changes
    user.Name = "Alice Smith";
    await changelog.ApplyChangesAsync(user);

    user.Email = "alice.smith@example.com";
    await changelog.ApplyChangesAsync(user);

    // Mark group as committed
    await group.CommitAsync();
}
catch (Exception ex)
{
    _logger.LogError(ex, "Profile update failed");
    // Group remains uncommitted but changes are still tracked
    throw;
}
```

### Access Group ID

```csharp
var group = await changelog.BeginGroupAsync("Bulk update");

Console.WriteLine($"Group ID: {group.Id}");

await changelog.ApplyChangesAsync(user);
await group.CommitAsync();
```

## Change Group Metadata

Add custom metadata to provide context:

```csharp
var group = await changelog.BeginGroupAsync("Admin action", new
{
    AdminUserId = currentUser.Id,
    AdminName = currentUser.Name,
    Reason = "Compliance review",
    IpAddress = request.RemoteIpAddress.ToString()
});

user.Status = UserStatus.Suspended;
await changelog.ApplyChangesAsync(user);

await group.CommitAsync();
```

Metadata is stored with each change in the group and can be queried later:

```csharp
var history = await changelog.GetHistoryAsync();

foreach (var change in history.Where(c => c.GroupId != null))
{
    var metadata = JsonSerializer.Deserialize<AdminActionMetadata>(
        change.Metadata
    );

    Console.WriteLine($"Action by {metadata.AdminName}: {metadata.Reason}");
}
```

## Commit vs Uncommitted Groups

### Committed Groups

Committed groups indicate successful completion:

```csharp
var group = await changelog.BeginGroupAsync("Import data");

foreach (var record in records)
{
    await changelog.ApplyChangesAsync(record);
}

await group.CommitAsync(); // Mark as successfully completed
```

Query committed groups:

```csharp
var history = await changelog.GetHistoryAsync();
var committedChanges = history.Where(c =>
    c.GroupId != null && c.GroupCommitted == true
);
```

### Uncommitted Groups

If you don't call `CommitAsync`, the group remains uncommitted (but changes are
still tracked):

```csharp
var group = await changelog.BeginGroupAsync("Experimental changes");

await changelog.ApplyChangesAsync(user);

// Oops, something went wrong - don't commit
// Changes are still in history but marked as uncommitted
```

This is useful for:

- **Debugging** — Identify incomplete operations
- **Rollback detection** — Find changes from failed transactions
- **Audit trails** — Track both successful and failed operations

## Nested Groups

Groups can be nested (though only the outermost group ID is stored):

```csharp
var outerGroup = await changelog.BeginGroupAsync("Migration");

var innerGroup = await changelog.BeginGroupAsync("Import users");
await changelog.ApplyChangesAsync(user1);
await changelog.ApplyChangesAsync(user2);
await innerGroup.CommitAsync();

var innerGroup2 = await changelog.BeginGroupAsync("Import products");
await changelog.ApplyChangesAsync(product1);
await innerGroup2.CommitAsync();

await outerGroup.CommitAsync();
```

## Common Patterns

### Audit Log Pattern

Track who made changes and why:

```csharp
public async Task UpdateUserAsync(string userId, UpdateUserDto dto, string adminId)
{
    var user = await _repository.GetByIdAsync(userId);
    var admin = await _repository.GetByIdAsync(adminId);

    var group = await _changelog.BeginGroupAsync("User update", new
    {
        AdminId = adminId,
        AdminName = admin.Name,
        Reason = dto.Reason,
        Timestamp = DateTime.UtcNow
    });

    try
    {
        user.Email = dto.Email;
        user.Name = dto.Name;

        await _changelog.ApplyChangesAsync(user);
        await _repository.UpdateAsync(user);
        await group.CommitAsync();
    }
    catch
    {
        // Group remains uncommitted
        throw;
    }
}
```

### Batch Operations

Group related bulk changes:

```csharp
var group = await changelog.BeginGroupAsync($"Import batch {batchId}");

try
{
    foreach (var record in batch)
    {
        await changelog.ApplyChangesAsync(record);
    }

    await group.CommitAsync();
    _logger.LogInformation("Batch {BatchId} imported successfully", batchId);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Batch {BatchId} import failed", batchId);
    throw;
}
```

### Rollback Detection

Identify failed operations:

```csharp
var history = await changelog.GetHistoryAsync();

var failedGroups = history
    .Where(c => c.GroupId != null && c.GroupCommitted == false)
    .GroupBy(c => c.GroupId)
    .Select(g => new
    {
        GroupId = g.Key,
        Label = g.First().GroupLabel,
        ChangeCount = g.Count(),
        Timestamp = g.First().Timestamp
    });

foreach (var failed in failedGroups)
{
    _logger.LogWarning(
        "Uncommitted group: {Label} ({ChangeCount} changes at {Timestamp})",
        failed.Label,
        failed.ChangeCount,
        failed.Timestamp
    );
}
```

## Querying by Group

### Get All Changes in a Group

```csharp
var group = await changelog.BeginGroupAsync("Profile update");

await changelog.ApplyChangesAsync(user);
await changelog.ApplyChangesAsync(user);
await group.CommitAsync();

var history = await changelog.GetHistoryAsync();
var groupChanges = history.Where(c => c.GroupId == group.Id);

Console.WriteLine($"Group '{group.Label}' has {groupChanges.Count()} changes");
```

### Get Recent Groups

```csharp
var history = await changelog.GetHistoryAsync(limit: 100);

var recentGroups = history
    .Where(c => c.GroupId != null)
    .GroupBy(c => c.GroupId)
    .Select(g => new
    {
        GroupId = g.Key,
        Label = g.First().GroupLabel,
        Committed = g.First().GroupCommitted,
        ChangeCount = g.Count(),
        Timestamp = g.First().Timestamp
    })
    .OrderByDescending(g => g.Timestamp)
    .Take(10);
```

## Transaction Scope

Change groups work with `IChangelogTransaction`:

```csharp
var transaction = await changelog.BeginGroupAsync("Multi-step update");

try
{
    var storage = transaction.GetStorage();

    // Access underlying storage during group
    await changelog.ApplyChangesAsync(user);

    await transaction.CommitAsync();
}
catch
{
    // Storage operations in group context
    throw;
}
```

## Performance Considerations

### Group Overhead

Change groups add minimal overhead:

- **Storage** — Group ID, label, metadata stored with each change
- **CPU** — No additional diff calculations
- **Memory** — Group object held until committed/disposed

### Best Practices

#### 1. Use Descriptive Labels

```csharp
// Good: Specific and searchable
var group = await changelog.BeginGroupAsync("User registration: alice@example.com");

// Bad: Vague
var group = await changelog.BeginGroupAsync("Update");
```

#### 2. Add Relevant Metadata

```csharp
// Good: Useful audit information
var group = await changelog.BeginGroupAsync("Compliance update", new
{
    AdminId = adminId,
    Reason = "GDPR request",
    TicketNumber = "LEGAL-1234"
});

// Bad: Redundant information
var group = await changelog.BeginGroupAsync("Update", new
{
    Timestamp = DateTime.UtcNow // Already tracked automatically
});
```

#### 3. Always Commit or Dispose

```csharp
// Good: Explicit commit
await using var group = await changelog.BeginGroupAsync("Update");
await changelog.ApplyChangesAsync(user);
await group.CommitAsync();

// Good: Using statement ensures cleanup
await using (var group = await changelog.BeginGroupAsync("Update"))
{
    await changelog.ApplyChangesAsync(user);
    await group.CommitAsync();
}
```

#### 4. Limit Group Size

```csharp
// Good: Reasonably sized groups
const int batchSize = 1000;
for (int i = 0; i < records.Length; i += batchSize)
{
    var group = await changelog.BeginGroupAsync($"Batch {i / batchSize}");

    foreach (var record in records.Skip(i).Take(batchSize))
    {
        await changelog.ApplyChangesAsync(record);
    }

    await group.CommitAsync();
}

// Bad: One massive group with millions of changes
var group = await changelog.BeginGroupAsync("Import everything");
foreach (var record in millionsOfRecords)
{
    await changelog.ApplyChangesAsync(record);
}
await group.CommitAsync();
```

## Observability

Change groups are tracked in OpenTelemetry spans:

```csharp
// Activity: ChangeGroup
// Tags:
//   - group_id
//   - group_label
//   - committed
//   - change_count
```

Monitor group commit rates and failure patterns:

```csharp
var failureRate = uncommittedGroups / totalGroups;
if (failureRate > 0.05) // 5% threshold
{
    _logger.LogWarning("High group failure rate: {Rate:P}", failureRate);
}
```

## Next Steps

- Learn about [change history](/guide/change-history)
- Explore [retention policies](/guide/retention-policies)
- See [patterns](/guide/patterns/sidecar) for real-world examples
