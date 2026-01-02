# Ticket P2-1: No Distributed Tracing - Poor Debuggability

**Priority**: P2 (Production Hardening)
**Status**: ✅ Complete
**Created**: January 2, 2026
**Last Updated**: January 2, 2026
**Estimated Impact**: End-to-end observability, improved debugging, production troubleshooting

## Problem Statement

Currently, there's no visibility into what's happening inside the Changelog library during operations:

**Issues:**
- No way to trace operations across storage layers
- Can't measure performance of individual operations in production
- Difficult to debug issues in production environments
- No correlation between client requests and library operations
- Can't identify bottlenecks in multi-layer stacks (Changelog → Decorator → Storage)
- Missing context when errors occur deep in the call stack

**Real-World Scenario:**
```csharp
// User reports slow saves - where's the bottleneck?
await changelog.ApplyChangesAsync(doc);  // How long did this take?
// Is it:
// - DiffEngine computation?
// - Compression in CompressedStorage?
// - Database write in SqliteStorage?
// - Network latency?
// We have no visibility!
```

**Impact on Production Operations:**
- ❌ Can't diagnose performance issues
- ❌ Can't trace requests across microservices
- ❌ Can't build performance dashboards
- ❌ Difficult to identify root cause of errors
- ❌ No correlation between logs and operations

## Implementation Summary

✅ **Implemented using standard .NET Activity API** (no external dependencies)
- Uses `System.Diagnostics.ActivitySource` for distributed tracing
- Compatible with OpenTelemetry, Application Insights, and other APM tools
- All public methods instrumented with activities
- Exception recording via `Activity.AddEvent`
- Streaming methods handle instrumentation with yield return
- 10 comprehensive telemetry tests (all passing)
- Zero external package dependencies

## Original Proposed Solution

Implement **OpenTelemetry** instrumentation throughout the library:

### 1. Add ActivitySource for Tracing

Create a centralized `ActivitySource` for all library operations:

```csharp
using System.Diagnostics;

namespace Changelog;

internal static class ChangelogTelemetry {
    internal static readonly ActivitySource ActivitySource = new(
        "Changelog.Library",
        "1.0.0"
    );

    internal const string OperationKey = "changelog.operation";
    internal const string DocumentIdKey = "changelog.document_id";
    internal const string StorageTypeKey = "changelog.storage.type";
    internal const string ChangeCountKey = "changelog.change.count";
    internal const string GroupIdKey = "changelog.group.id";
}
```

### 2. Instrument Key Operations

Add tracing to critical paths:

#### Changelog.cs - Public API Layer
```csharp
public async Task ApplyChangesAsync(T newDocument) {
    using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
        "ApplyChanges",
        ActivityKind.Internal
    );

    activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
    activity?.SetTag(ChangelogTelemetry.OperationKey, "apply_changes");

    try {
        // ... existing logic ...

        activity?.SetTag(ChangelogTelemetry.ChangeCountKey, changes.Count);
        activity?.SetStatus(ActivityStatusCode.Ok);
    }
    catch (Exception ex) {
        activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
        activity?.RecordException(ex);
        throw;
    }
}

public async Task<T?> GetDocumentAsync() {
    using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
        "GetDocument",
        ActivityKind.Internal
    );

    activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
    // ... existing logic ...
}

public async Task<List<ChangeRecord>> GetHistoryAsync(ChangeQueryOptions? options = null) {
    using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
        "GetHistory",
        ActivityKind.Internal
    );

    activity?.SetTag(ChangelogTelemetry.DocumentIdKey, _documentId);
    activity?.SetTag("changelog.query.skip", options?.Skip ?? 0);
    activity?.SetTag("changelog.query.limit", options?.Limit ?? 0);
    // ... existing logic ...
}
```

#### Storage Layer - Database/Cache Operations
```csharp
// SqliteStorage.cs
public async Task SaveChangesAsync(string documentId, List<ChangeRecord> changes) {
    using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
        "SqliteStorage.SaveChanges",
        ActivityKind.Client
    );

    activity?.SetTag(ChangelogTelemetry.DocumentIdKey, documentId);
    activity?.SetTag(ChangelogTelemetry.StorageTypeKey, "sqlite");
    activity?.SetTag(ChangelogTelemetry.ChangeCountKey, changes.Count);
    activity?.SetTag("db.system", "sqlite");
    activity?.SetTag("db.name", _connectionString);

    // ... existing logic ...
}

// CachedStorage.cs
public async Task<T?> GetDocumentAsync(string documentId) {
    using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
        "CachedStorage.GetDocument",
        ActivityKind.Internal
    );

    activity?.SetTag(ChangelogTelemetry.DocumentIdKey, documentId);
    activity?.SetTag(ChangelogTelemetry.StorageTypeKey, "cached");

    bool cacheHit = _cache.TryGetValue(documentId, out var cached);
    activity?.SetTag("cache.hit", cacheHit);

    if (cacheHit) {
        activity?.AddEvent(new ActivityEvent("CacheHit"));
        return cached;
    }

    activity?.AddEvent(new ActivityEvent("CacheMiss"));
    // ... fetch from inner storage ...
}
```

#### DiffEngine.cs - Computation
```csharp
public static List<DiffRecord> Diff<T>(T? oldValue, T? newValue) {
    using var activity = ChangelogTelemetry.ActivitySource.StartActivity(
        "DiffEngine.Diff",
        ActivityKind.Internal
    );

    activity?.SetTag("diff.type", typeof(T).Name);

    var diffs = // ... existing logic ...

    activity?.SetTag("diff.count", diffs.Count);
    return diffs;
}
```

### 3. Exception Tracking

Standard exception recording:

```csharp
catch (Exception ex) {
    activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
    activity?.RecordException(ex);
    throw;
}
```

### 4. Consumer Integration

Users can subscribe to traces:

```csharp
// Application startup - configure OpenTelemetry
using OpenTelemetry;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddSource("Changelog.Library")  // Subscribe to our ActivitySource
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddConsoleExporter()            // Dev: Console
        .AddOtlpExporter());             // Prod: Jaeger/Zipkin/etc

var app = builder.Build();

// Now all Changelog operations are traced!
var changelog = new Changelog<MyDoc>(storage, "doc1");
await changelog.ApplyChangesAsync(newDoc);  // Traced automatically
```

### 5. Trace Hierarchy Example

```
HTTP Request: POST /api/documents/123
└─ Changelog.ApplyChanges (documentId=doc1)
   ├─ DiffEngine.Diff (type=MyDocument, count=3)
   ├─ CompressedStorage.SaveChanges (compression=gzip)
   │  └─ CachedStorage.SaveChanges (cache.invalidate=true)
   │     └─ SqliteStorage.SaveChanges (db.system=sqlite, rows=3)
   └─ Duration: 45ms
```

## Benefits

### 1. Production Debugging
- See exact call flow for any request
- Identify performance bottlenecks
- Correlation across microservices

### 2. Performance Analysis
- P50/P95/P99 latency tracking
- Identify slow operations
- Cache hit rate monitoring

### 3. Error Investigation
- Full context when errors occur
- Stack trace correlation
- Exception patterns

### 4. Dashboard Integration
- Grafana/Kibana dashboards
- Real-time monitoring
- Alerting on anomalies

## Implementation Approach

### Phase 1: Core Instrumentation
1. Add `System.Diagnostics.DiagnosticSource` package (built-in .NET)
2. Create `ChangelogTelemetry` class with `ActivitySource`
3. Instrument `Changelog.cs` public methods
4. Instrument storage layer operations

### Phase 2: Deep Instrumentation
5. Instrument `DiffEngine.cs`
6. Instrument decorator classes
7. Add custom events for cache hits/misses
8. Add tags for query parameters

### Phase 3: Testing
9. Create telemetry tests
10. Verify trace hierarchy
11. Test exception recording
12. Validate tag values

### Phase 4: Documentation
13. Add consumer setup guide
14. Document available tags/events
15. Provide example queries
16. Create troubleshooting guide

## OpenTelemetry Semantic Conventions

Follow standard conventions where applicable:

**Database Operations:**
- `db.system` = "sqlite" | "memory"
- `db.operation` = "save" | "get" | "delete"
- `db.statement` = SQL query (optional, be careful with PII)

**Custom Tags:**
- `changelog.document_id` = Document identifier
- `changelog.operation` = Operation name
- `changelog.change.count` = Number of changes
- `changelog.group.id` = Group identifier
- `changelog.storage.type` = Storage type
- `cache.hit` = true | false

## Testing Strategy

### 1. Activity Creation Tests
```csharp
[Fact]
public async Task ApplyChangesAsync_CreatesActivity() {
    // Arrange
    var listener = new ActivityListener {
        ShouldListenTo = source => source.Name == "Changelog.Library",
        Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllData,
        ActivityStarted = activity => { /* collect */ },
        ActivityStopped = activity => { /* verify */ }
    };
    ActivitySource.AddActivityListener(listener);

    // Act
    await changelog.ApplyChangesAsync(newDoc);

    // Assert
    // Verify activity was created with correct tags
}
```

### 2. Tag Validation Tests
```csharp
[Fact]
public async Task GetHistoryAsync_SetsCorrectTags() {
    Activity? capturedActivity = null;
    var listener = /* setup listener to capture activity */;

    await changelog.GetHistoryAsync(new ChangeQueryOptions { Skip = 10, Limit = 20 });

    capturedActivity.Should().NotBeNull();
    capturedActivity!.Tags.Should().Contain(
        new KeyValuePair<string, string?>("changelog.query.skip", "10"));
    capturedActivity.Tags.Should().Contain(
        new KeyValuePair<string, string?>("changelog.query.limit", "20"));
}
```

### 3. Exception Recording Tests
```csharp
[Fact]
public async Task SaveChangesAsync_RecordsException() {
    // Arrange - setup storage to throw
    Activity? capturedActivity = null;

    // Act & Assert
    await Assert.ThrowsAsync<Exception>(() => changelog.ApplyChangesAsync(doc));

    capturedActivity!.Status.Should().Be(ActivityStatusCode.Error);
    capturedActivity.Events.Should().ContainSingle(e => e.Name == "exception");
}
```

### 4. Trace Hierarchy Tests
```csharp
[Fact]
public async Task ApplyChanges_CreatesHierarchy() {
    var activities = new List<Activity>();
    // Capture all activities

    await changelog.ApplyChangesAsync(newDoc);

    // Verify parent-child relationships
    var applyChanges = activities.Single(a => a.OperationName == "ApplyChanges");
    var saveChanges = activities.Single(a => a.OperationName.Contains("SaveChanges"));

    saveChanges.Parent.Should().Be(applyChanges);
}
```

## Non-Goals

- ❌ Metrics collection (that's P2-2)
- ❌ Structured logging (that's P2-3)
- ❌ Custom exporters (use OpenTelemetry standard exporters)
- ❌ Sampling logic (let consumer configure)

## Dependencies

**NuGet Packages:**
- None! `System.Diagnostics.DiagnosticSource` is built into .NET

**Consumer Dependencies (optional):**
- `OpenTelemetry` - For trace collection
- `OpenTelemetry.Exporter.Console` - Dev debugging
- `OpenTelemetry.Exporter.OpenTelemetryProtocol` - Production (Jaeger, Zipkin, etc.)

## Migration Path

**100% Backward Compatible:**
- Activities are only created if a listener is configured
- Zero overhead if OpenTelemetry is not configured
- No breaking changes to existing APIs
- Optional feature - works without consumer setup

## Performance Impact

**Minimal:**
- Activity creation: ~50ns when no listeners
- Activity creation: ~500ns with listeners
- No heap allocations when disabled
- Negligible impact on throughput

## Documentation Additions

### README.md - New Section

```markdown
## Observability

The Changelog library includes built-in OpenTelemetry tracing for production observability.

### Setup

```csharp
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddSource("Changelog.Library")
        .AddOtlpExporter());
```

### Available Traces

- `ApplyChanges` - Document update operations
- `GetDocument` - Document retrieval
- `GetHistory` - Change history queries
- `GetGroups` - Group queries
- `SaveChanges` - Storage operations
- `Diff` - Diff computation

### Tags

- `changelog.document_id` - Document being operated on
- `changelog.operation` - Operation type
- `changelog.change.count` - Number of changes
- `cache.hit` - Cache hit/miss indicator

### Example: Jaeger Integration

```csharp
services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddSource("Changelog.Library")
        .AddJaegerExporter(options => {
            options.AgentHost = "localhost";
            options.AgentPort = 6831;
        }));
```
```

## Success Metrics

- ✅ All public APIs instrumented
- ✅ All storage operations traced
- ✅ Exceptions recorded with context
- ✅ Zero overhead when disabled
- ✅ Test coverage for telemetry
- ✅ Consumer documentation complete

## Implementation Checklist

- [x] Create `ChangelogTelemetry` class with `ActivitySource`
- [x] Instrument `Changelog.cs` public methods (ApplyChanges, GetDocument, GetHistory, etc.)
- [x] Instrument `SqliteStorage.cs` operations
- [x] Instrument `MemoryStorage.cs` operations
- [x] Instrument `CachedStorage.cs` with cache hit/miss events
- [x] Instrument `CompressedStorage.cs` operations
- [x] Instrument `DiffEngine.Diff()` method
- [x] Add exception recording throughout
- [x] Create telemetry test suite (10 tests)
- [x] Update README.md with observability section
- [x] Create OBSERVABILITY.md guide
- [x] Verify zero overhead when disabled (tests pass without listeners)
- [ ] Test with Jaeger/Zipkin/Console exporters (optional - examples provided in OBSERVABILITY.md)
- [x] Update ROADMAP.md to mark P2-1 complete

## Implementation Log

_Starting implementation..._
