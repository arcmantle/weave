# Weave.Changelog

A C# .NET library for tracking and managing changes to objects over time. This is a port of the TypeScript `@weave/changelog` library.

## Features

- **Automatic diff computation** between old and new states
- **Persistent change history** with flexible storage backends
- **Change grouping** (similar to git commits) for logical batching of related changes
- **Fine-grained change records** with paths to specific properties
- **Transaction support** with rollback capabilities
- **Circular reference detection** prevents stack overflow on cyclic object graphs
- **Built-in observability** with distributed tracing, metrics, and structured logging

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

## Multi-Document Transactions

Coordinate atomic changes across multiple documents:

```csharp
// Begin a transaction
await using var txn = await storage.BeginTransactionAsync();

// Create changelog instances within the transaction
var account1 = txn.CreateChangelog<Account>("account-1");
var account2 = txn.CreateChangelog<Account>("account-2");

// Make changes to multiple documents
var stateA = await account1.GetDocumentAsync();
var stateB = await account2.GetDocumentAsync();

stateA.Balance -= 100;  // Debit
stateB.Balance += 100;  // Credit

await account1.ApplyChangesAsync(stateA);
await account2.ApplyChangesAsync(stateB);

// Commit atomically - both succeed or both fail
await txn.CommitAsync();

// Or rollback everything
// await txn.RollbackAsync();
```

**Note**: Transactions automatically rollback on dispose if not explicitly committed.

## Health Checks

Monitor storage backend health for operational readiness:

```csharp
var storage = new SqliteStorage<Document>("Data Source=mydb.sqlite");

// Check storage health
var health = await storage.CheckHealthAsync();

Console.WriteLine($"Status: {health.Status}");  // Healthy, Degraded, or Unhealthy
Console.WriteLine($"Description: {health.Description}");
Console.WriteLine($"Latency: {health.Duration.TotalMilliseconds}ms");

if (health.Data != null) {
    Console.WriteLine($"Tables: {health.Data["tableCount"]}");
    Console.WriteLine($"Documents: {health.Data["stateCount"]}");
}
```

**ASP.NET Core Integration:**
```csharp
// Program.cs
builder.Services.AddSingleton<IChangelogStorage<MyDoc>>(
    new SqliteStorage<MyDoc>("Data Source=app.db"));

builder.Services.AddHealthChecks()
    .AddCheck("changelog", async () => {
        var storage = app.Services.GetRequiredService<IChangelogStorage<MyDoc>>();
        var result = await storage.CheckHealthAsync();

        return result.Status switch {
            HealthStatus.Healthy => HealthCheckResult.Healthy(result.Description, result.Data),
            HealthStatus.Degraded => HealthCheckResult.Degraded(result.Description, result.Data),
            _ => HealthCheckResult.Unhealthy(result.Description, result.Exception, result.Data)
        };
    });

app.MapHealthChecks("/health");
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
- **SqliteStorage**: SQLite-based persistent storage
- **PostgresStorage**: PostgreSQL-based persistent storage
- **MongoStorage**: MongoDB-based persistent storage
- **CachedStorage**: Decorator that adds caching layer
- **CompressedStorage**: Decorator that compresses change data

You can implement your own storage backend by implementing the `IChangelogStorage<T>` interface.

### Provider Examples

Below are minimal, copy/pasteable examples for the three built-in database providers.

> Note: these providers perform schema/index initialization during construction (they will touch the database when you `new ...Storage<T>(...)`).

Connection string examples:

| Provider | Example |
|---|---|
| SQLite | `Data Source=app.db` |
| Postgres | `Host=localhost;Port=5432;Database=changelog;Username=postgres;Password=postgres` |
| MongoDB | `mongodb://localhost:27017` |

MongoDB notes:

- You can specify the database in the URI (e.g. `mongodb://localhost:27017/changelog`) or via `new MongoStorageOptions { DatabaseName = "changelog" }`.
- `BeginTransactionAsync()` requires a replica set or sharded cluster (and typically a URI with `?replicaSet=...`).

#### SQLite (`SqliteStorage<T>`)

Basic usage:

```csharp
using Changelog;
using Changelog.Storage;

var storage = new SqliteStorage<MyDocument>("Data Source=app.db");
var changelog = new Changelog<MyDocument>(storage, "doc-1");

await changelog.SetDocumentAsync(new MyDocument { /* ... */ });
await changelog.ApplyChangesAsync(new MyDocument { /* ... */ });
```

Customize table names (defaults are `States`, `Changes`, `Groups`):

```csharp
using Changelog.Storage;

var storage = new SqliteStorage<MyDocument>(
    "Data Source=app.db",
    new SqliteStorageOptions {
        TablePrefix = "myapp_",
        // Or specify individual tables:
        // StatesTable = "MyStates",
        // ChangesTable = "MyChanges",
        // GroupsTable = "MyGroups",
    }
);
```

#### PostgreSQL (`PostgresStorage<T>`)

Basic usage:

```csharp
using Changelog;
using Changelog.Storage;

var storage = new PostgresStorage<MyDocument>(
    "Host=localhost;Port=5432;Database=changelog;Username=postgres;Password=postgres"
);

var changelog = new Changelog<MyDocument>(storage, "doc-1");
await changelog.SetDocumentAsync(new MyDocument { /* ... */ });
```

Customize schema/table naming (defaults are schema `public` and tables `States`, `Changes`, `Groups`):

```csharp
using Changelog.Storage;

var storage = new PostgresStorage<MyDocument>(
    "Host=localhost;Database=changelog;Username=postgres;Password=postgres",
    new PostgresStorageOptions {
        Schema = "weave",
        TablePrefix = "changelog_",
        // Or specify individual tables:
        // StatesTable = "States_v2",
        // ChangesTable = "Changes_v2",
        // GroupsTable = "Groups_v2",
    }
);
```

Multi-document transactions are supported:

```csharp
await using var txn = await storage.BeginTransactionAsync();

var a = txn.CreateChangelog<MyDocument>("doc-a");
var b = txn.CreateChangelog<MyDocument>("doc-b");

await a.ApplyChangesAsync(new MyDocument { /* ... */ });
await b.ApplyChangesAsync(new MyDocument { /* ... */ });

await txn.CommitAsync();
```

#### MongoDB (`MongoStorage<T>`)

Basic usage:

```csharp
using Changelog;
using Changelog.Storage;

// Database can be specified in the URL:
var storage = new MongoStorage<MyDocument>("mongodb://localhost:27017/changelog");
var changelog = new Changelog<MyDocument>(storage, "doc-1");

await changelog.SetDocumentAsync(new MyDocument { /* ... */ });
```

Customize database/collection naming (defaults are database `changelog` (if not provided in the URL) and collections `states`, `changes`, `groups`):

```csharp
using Changelog.Storage;

var storage = new MongoStorage<MyDocument>(
    "mongodb://localhost:27017",
    new MongoStorageOptions {
        DatabaseName = "myapp",
        CollectionPrefix = "changelog_",
        // Or specify individual collections:
        // StatesCollection = "States",
        // ChangesCollection = "Changes",
        // GroupsCollection = "Groups",
    }
);
```

Multi-document transactions:

- MongoDB transactions require a replica set or sharded cluster.
- If the server does not support transactions, `BeginTransactionAsync()` throws `NotSupportedException`.

```csharp
await using var txn = await storage.BeginTransactionAsync();

var a = txn.CreateChangelog<MyDocument>("doc-a");
var b = txn.CreateChangelog<MyDocument>("doc-b");

await a.ApplyChangesAsync(new MyDocument { /* ... */ });
await b.ApplyChangesAsync(new MyDocument { /* ... */ });

await txn.CommitAsync();
```

## Observability

The Changelog library includes built-in observability using .NET's standard APIs:
- **Distributed Tracing** via `System.Diagnostics.Activity`
- **Metrics** via `System.Diagnostics.Metrics`
- **Structured Logging** via `Microsoft.Extensions.Logging.ILogger` (optional)

This provides minimal-dependency observability that works with OpenTelemetry, Application Insights, and other APM tools.

### Distributed Tracing

All public methods and storage operations are automatically instrumented with `Activity` spans:

```csharp
using OpenTelemetry;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

// Configure OpenTelemetry to collect traces
var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("MyApp"))
    .AddSource("Changelog.Library")  // Subscribe to Changelog traces
    .AddConsoleExporter()  // Or Jaeger, Zipkin, etc.
    .Build();

// Use the library normally - tracing happens automatically
var changelog = new Changelog<MyDocument>(storage, "doc-1");
await changelog.ApplyChangesAsync(newState);  // This operation is traced!
```

### Metrics

Key performance metrics are exposed via `System.Diagnostics.Metrics`:

```csharp
using OpenTelemetry;
using OpenTelemetry.Metrics;

// Configure OpenTelemetry to collect metrics
var meterProvider = Sdk.CreateMeterProviderBuilder()
    .AddMeter("Changelog.Library")  // Subscribe to Changelog metrics
    .AddConsoleExporter()
    .Build();

// Metrics collected automatically:
// - changelog.operation.count (counter)
// - changelog.operation.duration (histogram)
// - changelog.change.count (counter)
// - changelog.error.count (counter)
// - changelog.history.size (histogram)
// - changelog.diff.complexity (histogram)
```

### Structured Logging

Optional logging support via `ILogger<Changelog<T>>`:

```csharp
using Microsoft.Extensions.Logging;

// Create logger
var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
var logger = loggerFactory.CreateLogger<Changelog<MyDocument>>();

// Pass to Changelog (optional parameter)
var changelog = new Changelog<MyDocument>(storage, "doc-1", logger);

// Logs include TraceId for correlation with traces
await changelog.GetDocumentAsync();  // Logs at Debug level with structured data
```

Logs automatically include `TraceId` for correlation with distributed traces. Default is `NullLogger` for zero overhead.

### Available Trace Spans

- `Changelog.ApplyChanges` - Change application with diff computation
- `Changelog.GetDocument` - Document retrieval
- `Changelog.GetHistory` - History query
- `Changelog.StreamHistory` - Streaming history query
- `DiffEngine.Diff` - Diff computation
- `{Storage}.LoadState` - Storage read operations
- `{Storage}.SaveState` - Storage write operations
- `{Storage}.AppendChanges` - Change persistence
- `{Storage}.GetChanges` - Change retrieval

### Trace Tags/Attributes

All spans include relevant tags:

- `document_id` - Document identifier
- `operation` - Operation name
- `storage.type` - Storage backend type (memory, sqlite, postgres, mongo, cached, compressed)
- `db.system` - Database system (for SqliteStorage)
- `cache.hit` - Cache hit/miss (for CachedStorage)
- `compression.type` - Compression algorithm (for CompressedStorage)
- `diff.type` - Diff operation type
- `change.count` - Number of changes
- `error` - Error flag on failures

For more details, see [OBSERVABILITY.md](OBSERVABILITY.md).

## License

MIT
