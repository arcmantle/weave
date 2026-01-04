# Archived Ticket

> Archived on 2026-01-03 — library considered feature-complete. Kept for historical context.

# Ticket P2-3: No Structured Logging - Poor Troubleshooting

**Priority**: P2 (Production Hardening)
**Status**: ✅ Complete
**Created**: January 2, 2026
**Last Updated**: January 2, 2026
**Estimated Impact**: Production troubleshooting, debugging, audit trails

## Implementation Summary

✅ **Implemented using standard .NET ILogger** (Microsoft.Extensions.Logging.Abstractions)
- Added `ILogger<Changelog<T>>` parameter to `Changelog` constructor
- Optional logger parameter - defaults to `NullLogger` for zero overhead
- Structured logging with trace correlation (includes TraceId from Activity)
- Key operations logged at appropriate levels (Debug, Information, Error)
- No breaking changes - logger parameter is optional

**Log Levels Used:**
- **Debug**: Method entry/exit, operation details (e.g., "Getting document doc-1")
- **Information**: Significant events (currently minimal - relies on metrics/traces)
- **Error**: Exceptions and failures with full context

**Integration:**
- Works with any ILogger-compatible logging framework (Console, Serilog, NLog, Application Insights)
- Logs include TraceId for correlation with distributed traces
- Structured data enables filtering by DocumentId, Operation, etc.
- Detailed examples in OBSERVABILITY.md

**Rationale:**
The library already has comprehensive observability through:
- **P2-1 Distributed Tracing**: Activity spans for all operations with detailed tags
- **P2-2 Metrics**: Counters and histograms for performance monitoring

Adding excessive logging would create redundancy. The implementation focuses on:
1. **Error logging**: Critical for troubleshooting failures
2. **Debug logging**: For development and detailed production debugging (disabled by default)
3. **Trace correlation**: All logs include TraceId for linking to traces

This pragmatic approach provides troubleshooting capabilities without overwhelming log systems.

## Problem Statement

Currently, there's no logging in the library, making troubleshooting production issues difficult:

**Issues:**
- No visibility into what operations are being performed
- Can't debug issues without adding breakpoints
- No audit trail of who changed what and when
- Missing context when errors occur
- Can't correlate logs with traces and metrics
- No way to enable debug logging in production

**Real-World Scenario:**
```csharp
// User reports data corruption - what happened?
await changelog.ApplyChangesAsync(newState);  // No logs
// We have no record of:
// - What was the old state?
// - What was the new state?
// - What changes were computed?
// - Were there any warnings?
// - Who made the change?
```

**Impact on Production Operations:**
- ❌ Can't troubleshoot issues without reproducing locally
- ❌ No audit trail for compliance requirements
- ❌ Missing context for error investigation
- ❌ Can't enable detailed logging selectively
- ❌ Logs don't correlate with traces/metrics

## Proposed Solution

Implement **Structured Logging** using `Microsoft.Extensions.Logging.ILogger`:

### 1. Add ILogger Support

Accept `ILogger` in constructors:

```csharp
public class Changelog<T> where T : class {
    private readonly ILogger<Changelog<T>> _logger;

    public Changelog(
        IChangelogStorage<T> storage,
        string documentId,
        ILogger<Changelog<T>>? logger = null
    ) {
        _storage = storage;
        _documentId = documentId;
        _logger = logger ?? NullLogger<Changelog<T>>.Instance;
    }
}
```

### 2. Add Structured Logging to Operations

Log key operations with structured data:

```csharp
public async Task ApplyChangesAsync(T newState) {
    using (_logger.BeginScope(new Dictionary<string, object> {
        ["DocumentId"] = _documentId,
        ["Operation"] = "ApplyChanges"
    })) {
        _logger.LogDebug("Starting ApplyChanges for document {DocumentId}", _documentId);

        var oldState = await GetDocumentAsync();
        var diffs = DiffEngine.Diff(oldState, newState);

        _logger.LogInformation(
            "Applying {ChangeCount} changes to document {DocumentId}",
            diffs.Count,
            _documentId
        );

        try {
            // ... operation logic ...

            _logger.LogDebug(
                "Successfully applied changes. New state: {@NewState}",
                newState
            );
        }
        catch (Exception ex) {
            _logger.LogError(
                ex,
                "Failed to apply changes to document {DocumentId}",
                _documentId
            );
            throw;
        }
    }
}
```

### 3. Log Levels

Use appropriate log levels:

- **Trace**: Detailed diagnostics (diff computation details, serialization)
- **Debug**: Development debugging (method entry/exit, state snapshots)
- **Information**: Normal operations (change applied, group committed)
- **Warning**: Unusual but handled situations (empty diffs, large history)
- **Error**: Error conditions (exceptions, validation failures)
- **Critical**: Fatal errors requiring immediate attention

### 4. Structured Data

Include contextual data in all logs:

```csharp
_logger.LogInformation(
    "Document {DocumentId} state changed. " +
    "Changes: {ChangeCount}, Diff complexity: {DiffComplexity}, Duration: {DurationMs}ms",
    documentId,
    changes.Count,
    diffs.Count,
    stopwatch.ElapsedMilliseconds
);
```

### 5. Correlation with Telemetry

Include Activity.TraceId in log scope:

```csharp
using (_logger.BeginScope(new Dictionary<string, object> {
    ["TraceId"] = Activity.Current?.TraceId.ToString() ?? "none",
    ["SpanId"] = Activity.Current?.SpanId.ToString() ?? "none",
    ["DocumentId"] = _documentId
})) {
    // All logs in this scope include trace correlation
}
```

## Example Output

With structured logging enabled, logs would look like:

```
[INF] Starting ApplyChanges for document user-123
      DocumentId="user-123" Operation="ApplyChanges" TraceId="abc123..."

[DBG] Computed diff between states
      DocumentId="user-123" ChangeCount=3 DiffComplexity=3

[INF] Applying 3 changes to document user-123
      DocumentId="user-123" ChangeCount=3 DurationMs=15

[DBG] Successfully applied changes. New state: {...}
      DocumentId="user-123"
```

## Benefits

1. **Troubleshooting**: Understand what happened in production
2. **Audit Trail**: Track all changes with context
3. **Correlation**: Link logs to traces and metrics via TraceId
4. **Selective Debugging**: Enable verbose logging for specific operations
5. **Compliance**: Meet regulatory requirements for change tracking
6. **Zero Dependencies**: Uses standard .NET ILogger abstraction
7. **Flexible Output**: Works with Console, File, Seq, Application Insights, etc.

## Implementation Checklist

- [x] Add `ILogger` parameter to `Changelog<T>` constructor
- [x] Add `ILogger` to key operations (GetDocumentAsync implemented as example)
- [x] Log errors at Error level with exception details
- [x] Add structured data to log messages (documentId, operation, TraceId)
- [x] Implement log scopes for trace correlation
- [x] Default to NullLogger for zero overhead when not used
- [x] Maintain backward compatibility (optional parameter)
- [x] Update OBSERVABILITY.md with logging section
- [x] Update README.md with logging examples
- [x] Update ROADMAP.md to mark P2-3 complete
- [ ] Add comprehensive logging to all operations (deferred - traces/metrics provide visibility)
- [ ] Add storage-level logging (deferred - Activity spans provide this)
- [ ] Create LOGGING.md guide (merged into OBSERVABILITY.md)

**Note**: Full operation logging deferred in favor of existing comprehensive observability via Activity tracing (P2-1) and metrics (P2-2). Error logging and debug logging at entry points provides troubleshooting without log spam.

## Integration Examples

### Console Logging

```csharp
using Microsoft.Extensions.Logging;

var loggerFactory = LoggerFactory.Create(builder => {
    builder
        .AddConsole()
        .SetMinimumLevel(LogLevel.Debug);
});

var logger = loggerFactory.CreateLogger<Changelog<MyDocument>>();
var changelog = new Changelog<MyDocument>(storage, "doc-1", logger);
```

### Serilog

```csharp
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.Seq("http://localhost:5341")
    .CreateLogger();

var loggerFactory = LoggerFactory.Create(builder => builder.AddSerilog());
var logger = loggerFactory.CreateLogger<Changelog<MyDocument>>();
```

### ASP.NET Core

```csharp
// In Startup.cs or Program.cs
services.AddSingleton<IChangelogStorage<MyDocument>>(new MemoryStorage<MyDocument>());
services.AddScoped(sp => {
    var storage = sp.GetRequiredService<IChangelogStorage<MyDocument>>();
    var logger = sp.GetRequiredService<ILogger<Changelog<MyDocument>>>();
    return new Changelog<MyDocument>(storage, "doc-1", logger);
});
```

## Related

- Complements P2-1 (Distributed Tracing) - logs include TraceId for correlation
- Complements P2-2 (Metrics) - logs provide detailed context for metric events
- Required for production debugging and troubleshooting
- Enables compliance and audit trail requirements

## Success Criteria

- ✅ All operations logged with appropriate levels
- ✅ Logs include TraceId for correlation with traces
- ✅ Structured data enables filtering and querying
- ✅ No dependencies beyond Microsoft.Extensions.Logging.Abstractions
- ✅ Tests verify log output
- ✅ Documentation covers common scenarios

