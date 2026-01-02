# Ticket P2-2: No Metrics - Poor Production Monitoring

**Priority**: P2 (Production Hardening)
**Status**: ✅ Complete
**Created**: January 2, 2026
**Last Updated**: January 2, 2026
**Estimated Impact**: Production monitoring, performance analysis, capacity planning

## Implementation Summary

✅ **Implemented using standard .NET Metrics API** (no external dependencies)
- Uses `System.Diagnostics.Metrics.Meter` for metrics collection
- Compatible with OpenTelemetry, Prometheus, and other monitoring systems
- All public methods instrumented with counters and histograms
- Detailed operation tags for filtering and aggregation
- Zero external package dependencies

**Metrics Instruments:**
- **Counters**: `changelog.operation.count`, `changelog.change.count`, `changelog.error.count`
- **Histograms**: `changelog.operation.duration`, `changelog.history.size`, `changelog.diff.complexity`

**Instrumented Operations:**
- ✅ `GetDocumentAsync` - Operation count, duration, errors
- ✅ `SetDocumentAsync` - Operation count, duration, errors
- ✅ `ApplyChangesAsync` - Operation count, duration, change count, diff complexity, errors
- ✅ `GetHistoryAsync` - Operation count, duration, history size, errors
- ✅ `BeginGroupAsync` - Operation count, duration, errors
- ✅ `CommitGroupAsync` - Operation count, duration, change count, errors
- ✅ `RollbackGroupAsync` - Operation count, duration, errors
- ✅ `GetGroupChangesAsync` - Operation count, duration, history size, errors
- ✅ Streaming operations instrumented for partial metrics

**Metric Tags:**
- `operation` - Operation name (get_document, apply_changes, etc.)
- `document_id` - Document identifier
- `error.type` - Exception type name on errors

**Integration:**
- Works with OpenTelemetry exporters (Prometheus, Console, OTLP, etc.)
- Detailed examples in [OBSERVABILITY.md](../OBSERVABILITY.md)
- See README.md observability section for quick start

## Problem Statement

Currently, there's no way to measure and monitor the library's runtime behavior:

**Issues:**
- No visibility into operation performance (P50/P95/P99 latencies)
- Can't track error rates or success rates
- No insights into resource usage (storage size, change counts)
- Can't identify performance degradation over time
- Missing data for capacity planning and scaling decisions
- No alerts when operations exceed thresholds

**Real-World Scenario:**
```csharp
// Production dashboard shows nothing:
// - How many operations/sec?
// - What's the average latency?
// - How much storage are we using?
// - What's the error rate?
// We're flying blind!

await changelog.ApplyChangesAsync(doc);  // Was this fast or slow?
var history = await changelog.GetHistoryAsync();  // How many changes were returned?
```

**Impact on Production Operations:**
- ❌ Can't detect performance regressions
- ❌ No alerting on high error rates
- ❌ Can't build SLO/SLA dashboards
- ❌ Difficult to justify scaling decisions
- ❌ No data for performance optimization

## Proposed Solution

Implement **Metrics** using standard .NET `System.Diagnostics.Metrics`:

### 1. Create Meter for Metrics Collection

```csharp
using System.Diagnostics.Metrics;

namespace Changelog;

internal static class ChangelogMetrics {
    private static readonly Meter Meter = new("Changelog.Library", "1.0.0");

    // Counters
    public static readonly Counter<long> OperationCount =
        Meter.CreateCounter<long>("changelog.operation.count", "operations",
            "Total number of changelog operations");

    public static readonly Counter<long> ChangeCount =
        Meter.CreateCounter<long>("changelog.change.count", "changes",
            "Total number of changes recorded");

    public static readonly Counter<long> ErrorCount =
        Meter.CreateCounter<long>("changelog.error.count", "errors",
            "Total number of errors");

    // Histograms (for latency percentiles)
    public static readonly Histogram<double> OperationDuration =
        Meter.CreateHistogram<double>("changelog.operation.duration", "ms",
            "Duration of changelog operations");

    public static readonly Histogram<long> HistorySize =
        Meter.CreateHistogram<long>("changelog.history.size", "changes",
            "Number of changes returned in history queries");

    // Gauges (current values)
    public static readonly ObservableGauge<long> ActiveDocuments =
        Meter.CreateObservableGauge<long>("changelog.documents.active", "documents",
            "Number of active documents being tracked");
}
```

### 2. Instrument Operations

Add metrics collection to all public methods:

**Example: ApplyChangesAsync**
```csharp
public async Task ApplyChangesAsync(T newState) {
    var stopwatch = Stopwatch.StartNew();
    var tags = new TagList {
        { "operation", "apply_changes" },
        { "document_id", _documentId }
    };

    try {
        // ... existing logic ...

        ChangelogMetrics.ChangeCount.Add(changes.Count, tags);
        ChangelogMetrics.OperationCount.Add(1, tags);

        stopwatch.Stop();
        ChangelogMetrics.OperationDuration.Record(stopwatch.ElapsedMilliseconds, tags);
    }
    catch (Exception ex) {
        tags.Add("error.type", ex.GetType().Name);
        ChangelogMetrics.ErrorCount.Add(1, tags);
        throw;
    }
}
```

### 3. Metric Categories

**Counters (monotonically increasing):**
- `changelog.operation.count` - Total operations (by operation type)
- `changelog.change.count` - Total changes recorded
- `changelog.error.count` - Total errors (by error type)
- `changelog.group.count` - Total groups created
- `changelog.query.count` - Total queries executed

**Histograms (distributions for percentiles):**
- `changelog.operation.duration` - Operation latency (P50/P95/P99)
- `changelog.history.size` - Changes returned per query
- `changelog.diff.complexity` - Number of diffs per operation
- `changelog.storage.size` - Storage size in bytes (per document)

**Gauges (current values):**
- `changelog.documents.active` - Documents currently tracked
- `changelog.cache.size` - Current cache size (if caching added)

### 4. Tags/Dimensions

All metrics include contextual tags:
- `operation`: get_document, apply_changes, get_history, etc.
- `document_id`: Document identifier (optional, for debugging)
- `error.type`: Exception type (for error metrics)
- `group_id`: Group identifier (where applicable)

## Implementation Plan

### Step 1: Create Metrics Infrastructure
- [ ] Create `ChangelogMetrics.cs` with Meter and instruments
- [ ] Define all counters, histograms, and gauges
- [ ] Add helper methods for common tag sets

### Step 2: Instrument Core Operations
- [ ] `GetDocumentAsync()` - latency, error rate
- [ ] `SetDocumentAsync()` - latency, error rate
- [ ] `ApplyChangesAsync()` - latency, change count, error rate
- [ ] `BeginGroupAsync()` / `CommitGroupAsync()` - group count
- [ ] `GetHistoryAsync()` - latency, result size
- [ ] `GetHistoryStreamAsync()` - latency, result size
- [ ] `GetGroupChangesAsync()` - latency, result size
- [ ] `GetGroupsAsync()` - latency, result size

### Step 3: Instrument DiffEngine
- [ ] `Diff()` - latency, diff complexity (number of diffs)

### Step 4: Add Tests
- [ ] Test counter increments
- [ ] Test histogram recordings
- [ ] Test tag correctness
- [ ] Test error metrics
- [ ] Test metrics work without listeners (no-op)

### Step 5: Documentation
- [ ] Document available metrics
- [ ] Provide example Prometheus/Grafana configs
- [ ] Show how to consume metrics in .NET apps

## Success Criteria

- ✅ All public operations emit latency metrics
- ✅ Error rates tracked by error type
- ✅ Change counts and sizes tracked
- ✅ Tests verify metrics correctness
- ✅ Zero performance overhead when no listener attached
- ✅ Works with Prometheus, Application Insights, and other exporters

## Testing Strategy

```csharp
[Fact]
public async Task ApplyChangesAsync_RecordsMetrics() {
    // Arrange
    var meterListener = new MeterListener();
    var operationCounts = new Dictionary<string, long>();
    var durations = new List<double>();

    meterListener.InstrumentPublished = (instrument, listener) => {
        if (instrument.Meter.Name == "Changelog.Library") {
            listener.EnableMeasurementEvents(instrument);
        }
    };

    meterListener.SetMeasurementEventCallback<long>((instrument, measurement, tags, state) => {
        if (instrument.Name == "changelog.operation.count") {
            var operation = tags.First(t => t.Key == "operation").Value;
            operationCounts[operation] = measurement;
        }
    });

    meterListener.SetMeasurementEventCallback<double>((instrument, measurement, tags, state) => {
        if (instrument.Name == "changelog.operation.duration") {
            durations.Add(measurement);
        }
    });

    meterListener.Start();

    try {
        var storage = new MemoryStorage<TestDoc>();
        var changelog = new Changelog<TestDoc>(storage, "doc1");

        // Act
        await changelog.ApplyChangesAsync(new TestDoc { Name = "Test" });

        // Assert
        operationCounts.Should().ContainKey("apply_changes");
        operationCounts["apply_changes"].Should().Be(1);
        durations.Should().NotBeEmpty();
        durations[0].Should().BeGreaterThan(0);
    }
    finally {
        meterListener.Dispose();
    }
}
```

## OpenTelemetry Integration

Metrics work seamlessly with OpenTelemetry:

```csharp
// In your application startup
builder.Services.AddOpenTelemetry()
    .WithMetrics(metrics => {
        metrics
            .AddMeter("Changelog.Library")  // ← Subscribe to our metrics
            .AddPrometheusExporter();       // ← Export to Prometheus
    });
```

## Prometheus Example

Metrics will be exported in Prometheus format:

```prometheus
# HELP changelog_operation_count Total number of changelog operations
# TYPE changelog_operation_count counter
changelog_operation_count{operation="apply_changes",document_id="doc1"} 142

# HELP changelog_operation_duration Duration of changelog operations
# TYPE changelog_operation_duration histogram
changelog_operation_duration_bucket{operation="apply_changes",le="10"} 95
changelog_operation_duration_bucket{operation="apply_changes",le="50"} 138
changelog_operation_duration_bucket{operation="apply_changes",le="100"} 142
changelog_operation_duration_sum{operation="apply_changes"} 3240
changelog_operation_duration_count{operation="apply_changes"} 142

# HELP changelog_error_count Total number of errors
# TYPE changelog_error_count counter
changelog_error_count{operation="apply_changes",error_type="ArgumentNullException"} 2
```

## Benefits

1. **Production Monitoring**: Real-time visibility into library performance
2. **Performance Analysis**: Identify slow operations and bottlenecks
3. **Capacity Planning**: Data-driven decisions on scaling
4. **Alerting**: Set up alerts on error rates or latency spikes
5. **SLO/SLA Tracking**: Measure against service level objectives
6. **Zero Dependencies**: Uses built-in .NET Metrics API
7. **APM Integration**: Works with any metrics backend (Prometheus, DataDog, New Relic, etc.)

## Implementation Checklist

- [x] Create `ChangelogMetrics` class with `Meter` and instruments
- [x] Instrument `GetDocumentAsync` with metrics
- [x] Instrument `SetDocumentAsync` with metrics
- [x] Instrument `ApplyChangesAsync` with metrics (change count, diff complexity)
- [x] Instrument `GetHistoryAsync` with metrics (history size)
- [x] Instrument `BeginGroupAsync` with metrics
- [x] Instrument `CommitGroupAsync` with metrics
- [x] Instrument `RollbackGroupAsync` with metrics
- [x] Instrument `GetGroupChangesAsync` with metrics
- [x] Instrument `GetGroupsAsync` with metrics
- [x] Instrument streaming methods with metrics
- [x] Instrument `TrimHistoryAsync` and `ApplyRetentionPolicyAsync` with metrics
- [x] Instrument `ClearAsync` with metrics
- [x] Add error tracking to all operations
- [x] Create metrics test suite
- [x] Update README.md metrics section (covered in P2-1 observability)
- [x] Verify metrics collection with OpenTelemetry
- [x] Update ROADMAP.md to mark P2-2 complete

## Related

- Complements P2-1 (Distributed Tracing) for full observability
- Required for P2-6 (Health Checks) - metrics feed health status
- Enables future work on performance optimization
