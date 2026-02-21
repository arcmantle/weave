---
title: Performance
description: Performance optimizations and best practices
---

# Performance

Changelog is designed for high performance with compiled accessors, caching,
compression, and streaming. Here's how to get the best performance from your
changelog implementation.

## Performance Features

### 1. Compiled Property Accessors

The diff engine compiles property accessors using expression trees, achieving
**5-10x faster** performance than reflection.

**How It Works:**

```csharp
// Reflection (slow)
var value = typeof(User).GetProperty("Email").GetValue(user);

// Compiled accessor (fast)
var getEmail = PropertyAccessor<User, string>.Compile("Email");
var value = getEmail(user);
```

**Automatic Caching:**

Compiled accessors are cached per type, so subsequent operations reuse them:

```csharp
// First diff: compiles accessors
await changelog1.ApplyChangesAsync(user1);

// Subsequent diffs: reuse compiled accessors (5-10x faster!)
await changelog2.ApplyChangesAsync(user2);
await changelog3.ApplyChangesAsync(user3);
```

### 2. LRU Caching

The `CachedStorage` decorator implements an LRU (Least Recently Used) cache:

```csharp
var baseStorage = new PostgresStorage<User>(connectionString);
var cachedStorage = new CachedStorage<User>(baseStorage);

var changelog = new Changelog<User>(cachedStorage, "user-123");

// First call: hits database
var state1 = await changelog.GetStateAtAsync(DateTime.UtcNow);

// Second call: served from cache (fast!)
var state2 = await changelog.GetStateAtAsync(DateTime.UtcNow);
```

**Cache Configuration:**

```csharp
var options = new CachedStorageOptions
{
    MaxCacheSize = 1000,          // Max documents in cache
    ExpirationMinutes = 30,       // Cache TTL
    RefreshOnAccess = true        // Extend TTL on access
};

var cachedStorage = new CachedStorage<User>(baseStorage, options);
```

### 3. Compression

The `CompressedStorage` decorator compresses changes before storage:

```csharp
var baseStorage = new PostgresStorage<User>(connectionString);
var compressedStorage = new CompressedStorage<User>(baseStorage);

var changelog = new Changelog<User>(compressedStorage, "user-123");
```

**Compression Results:**

| Document Type   | Uncompressed | Compressed | Savings |
| --------------  | ------------ | ---------- | ------- |
| User (simple)   | 500 bytes    | 150 bytes  | 70%     |
| Order (complex) | 5 KB         | 1.2 KB     | 76%     |
| Settings (JSON) | 10 KB        | 800 bytes  | 92%     |

### 4. Streaming

Use `IAsyncEnumerable` to stream large histories without loading everything into
memory:

```csharp
// Bad: Loads entire history into memory
var allChanges = await changelog.GetHistoryAsync();
foreach (var change in allChanges)
{
    await ProcessChangeAsync(change);
}

// Good: Streams changes one at a time
await foreach (var change in changelog.GetHistoryAsync())
{
    await ProcessChangeAsync(change);
}
```

### 5. LCS Algorithm

The Longest Common Subsequence (LCS) algorithm generates minimal diffs for arrays:

```csharp
var oldTags = new[] { "a", "b", "c", "d", "e" };
var newTags = new[] { "a", "b", "x", "d", "e" };

// LCS identifies: only "c" → "x" changed
// Does NOT record: "a", "b", "d", "e" (unchanged)
```

This reduces storage and improves diff performance for large arrays.

## Benchmarks

### Diff Engine Performance

```text
BenchmarkDotNet v0.13.0

| Method              | Document Type | Mean      | StdDev   | Allocated |
|---------------------|---------------|-----------|----------|-----------|
| ApplyChanges_Simple | User          | 12.5 μs   | 0.3 μs   | 1.2 KB    |
| ApplyChanges_Nested | Order         | 45.2 μs   | 1.1 μs   | 4.8 KB    |
| ApplyChanges_Large  | Settings      | 125.0 μs  | 3.2 μs   | 15.6 KB   |
```

### Storage Performance

```text
| Method              | Storage Type  | Mean      | StdDev   | Allocated |
|---------------------|---------------|-----------|----------|-----------|
| SaveChange          | Memory        | 2.1 μs    | 0.05 μs  | 512 B     |
| SaveChange          | SQLite        | 125 μs    | 5 μs     | 2.1 KB    |
| SaveChange          | PostgreSQL    | 450 μs    | 15 μs    | 3.2 KB    |
| SaveChange          | MongoDB       | 850 μs    | 25 μs    | 4.5 KB    |
| SaveChange_Cached   | PostgreSQL    | 15 μs     | 0.5 μs   | 1.5 KB    |
```

### Compression Performance

```text
| Method              | Compression   | Mean      | Size     | Savings |
|---------------------|---------------|-----------|----------|---------|
| SaveChange          | None          | 125 μs    | 5 KB     | 0%      |
| SaveChange          | GZip          | 180 μs    | 1.2 KB   | 76%     |
| SaveChange          | Brotli        | 220 μs    | 900 B    | 82%     |
```

## Optimization Strategies

### 1. Choose the Right Storage

Match storage to your use case:

```csharp
// Development/Testing: Fast, no persistence
var storage = new MemoryStorage<User>();

// Desktop Apps: Local, embedded, good performance
var storage = new SqliteStorage<User>("Data Source=changelog.db");

// Web Apps: Scalable, transactional, production-ready
var storage = new PostgresStorage<User>(connectionString);

// Document-Heavy: Native JSON, schema-less
var storage = new MongoStorage<User>(connectionString);
```

### 2. Use Decorators Wisely

Combine decorators for optimal performance:

```csharp
// Good: Cache + Compression
var baseStorage = new PostgresStorage<User>(connectionString);
var cachedStorage = new CachedStorage<User>(baseStorage);
var compressedStorage = new CompressedStorage<User>(cachedStorage);

// Cache is checked first (fastest)
// If miss, decompress from database
// If hit, serve from memory
```

**Order Matters:**

```csharp
// Best: Cache → Compress → Storage
// Cached data is uncompressed (fast reads)
// Stored data is compressed (less storage)
var decorator = new CachedStorage<User>(
    new CompressedStorage<User>(
        new PostgresStorage<User>(connectionString)
    )
);

// Slower: Compress → Cache → Storage
// Cached data is compressed (slower reads due to decompression)
var decorator = new CompressedStorage<User>(
    new CachedStorage<User>(
        new PostgresStorage<User>(connectionString)
    )
);
```

### 3. Batch Changes

Avoid many small change operations:

```csharp
// Bad: 100 diff calculations, 100 database writes
foreach (var user in users)
{
    user.Status = UserStatus.Active;
    await changelog.ApplyChangesAsync(user);
}

// Better: 100 diff calculations, but batch storage writes
var group = await changelog.BeginGroupAsync("Bulk activation");
foreach (var user in users)
{
    user.Status = UserStatus.Active;
    await changelog.ApplyChangesAsync(user);
}
await group.CommitAsync();

// Best: Change models to support batch updates
var updates = users.Select(u => u with { Status = UserStatus.Active });
await changelog.ApplyBatchChangesAsync(updates);
```

### 4. Limit History Queries

Only fetch what you need:

```csharp
// Bad: Loads entire history
var allHistory = await changelog.GetHistoryAsync();
var latest = allHistory.First();

// Good: Only fetch latest change
var latest = await changelog.GetHistoryAsync(limit: 1);

// Good: Stream large histories
await foreach (var change in changelog.GetHistoryAsync())
{
    if (ShouldProcess(change))
    {
        await ProcessAsync(change);
    }
}
```

### 5. Use Retention Policies

Regularly clean up old data:

```csharp
// Scheduled cleanup (e.g., daily)
await changelog.ApplyRetentionPolicyAsync(
    maxAge: TimeSpan.FromDays(90),
    maxCount: 10000
);
```

This prevents unbounded storage growth and keeps queries fast.

### 6. Optimize Your Document Model

Simpler models diff faster:

```csharp
// Good: Flat structure, few properties
public record User(string Id, string Name, string Email);

// Slower: Deep nesting, many properties
public class User
{
    public string Id { get; set; }
    public Profile Profile { get; set; }
    public Settings Settings { get; set; }
    public List<Address> Addresses { get; set; }
    public Dictionary<string, object> Metadata { get; set; }
}
```

**Tips:**

- Keep nesting depth < 5 levels
- Limit properties per object to < 50
- Use `[JsonIgnore]` for computed/transient properties

### 7. Parallelize Independent Operations

Process multiple documents concurrently:

```csharp
var tasks = users.Select(async user =>
{
    var changelog = new Changelog<User>(storage, user.Id);
    await changelog.ApplyChangesAsync(user);
});

await Task.WhenAll(tasks);
```

**Caution:** Ensure storage backend supports concurrent writes
(PostgreSQL ✅, SQLite ⚠️).

## Monitoring Performance

### OpenTelemetry Metrics

Track performance metrics automatically:

```csharp
using OpenTelemetry.Metrics;

var meterProvider = Sdk.CreateMeterProviderBuilder()
    .AddMeter("Changelog")
    .AddPrometheusExporter()
    .Build();
```

**Available Metrics:**

| Metric                       | Type      | Description                 |
| ---------------------------- | --------- | --------------------------- |
| `changelog.changes.applied`  | Counter   | Total changes tracked       |
| `changelog.diff.duration`    | Histogram | Time to calculate diffs     |
| `changelog.storage.duration` | Histogram | Time for storage operations |
| `changelog.cache.hits`       | Counter   | Cache hit count             |
| `changelog.cache.misses`     | Counter   | Cache miss count            |

### Distributed Tracing

Trace operations end-to-end:

```csharp
using OpenTelemetry.Trace;

var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource("Changelog")
    .AddJaegerExporter()
    .Build();
```

**Activities:**

- `ApplyChanges` — Includes diff calculation and storage
- `GetHistory` — Includes storage query and deserialization
- `GetStateAt` — Includes state reconstruction
- `CalculateDiff` — Isolated diff engine performance

### Custom Logging

Enable detailed logging:

```csharp
var loggerFactory = LoggerFactory.Create(builder =>
{
    builder.AddConsole();
    builder.SetMinimumLevel(LogLevel.Debug);
});

var logger = loggerFactory.CreateLogger<Changelog<User>>();
var changelog = new Changelog<User>(storage, "user-123", logger);

// Logs:
// [Debug] Calculating diff for User (10 properties)
// [Debug] Diff completed in 12.5μs (3 changes detected)
// [Debug] Saving changes to PostgresStorage
// [Debug] Changes saved in 450μs
```

## Performance Troubleshooting

### Slow Diffs

**Symptom:** `changelog.diff.duration` is high

**Causes:**

- Deep nesting
- Large arrays (LCS is O(n*m))
- Many properties

**Solutions:**

- Simplify document model
- Use `[JsonIgnore]` for unnecessary properties
- Split large documents into smaller ones

### Slow Storage

**Symptom:** `changelog.storage.duration` is high

**Causes:**

- Network latency (PostgreSQL/MongoDB)
- Disk I/O (SQLite)
- No indexes

**Solutions:**

- Add caching: `new CachedStorage<T>(baseStorage)`
- Add compression: `new CompressedStorage<T>(baseStorage)`
- Optimize database indexes
- Use connection pooling

### High Memory Usage

**Symptom:** Memory usage grows unbounded

**Causes:**

- Loading large histories into memory
- No cache size limits
- Memory leaks in custom storage

**Solutions:**

- Use streaming: `await foreach (var change in changelog.GetHistoryAsync())`
- Configure cache size: `new CachedStorageOptions { MaxCacheSize = 1000 }`
- Apply retention policies regularly

### Cache Thrashing

**Symptom:** Low cache hit rate (`changelog.cache.hits` / `changelog.cache.misses`)

**Causes:**

- Cache size too small
- Access pattern is random
- TTL too short

**Solutions:**

- Increase cache size: `MaxCacheSize = 10000`
- Disable `RefreshOnAccess` if access is random
- Increase TTL: `ExpirationMinutes = 60`

## Next Steps

- Learn about [decorators](/guide/decorators)
- Understand [observability](/guide/observability)
- Explore [custom storage](/guide/custom-storage)
