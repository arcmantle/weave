# Observability Guide

This guide explains how to monitor, trace, and measure the Changelog library in production using .NET's built-in observability APIs.

## Overview

The Changelog library uses:
- **`System.Diagnostics.Activity`** for distributed tracing
- **`System.Diagnostics.Metrics`** for performance metrics

These are **zero-dependency** .NET APIs that work with OpenTelemetry, Application Insights, AWS X-Ray, and other APM tools.

## Table of Contents

- [Quick Start](#quick-start)
- [Distributed Tracing](#distributed-tracing)
- [Metrics](#metrics)
- [Integration Examples](#integration-examples)
- [Production Best Practices](#production-best-practices)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Console Logging (Development)

The simplest way to see what's happening:

```csharp
using OpenTelemetry;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Metrics;

// Set up tracing
var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("MyApp"))
    .AddSource("Changelog.Library")
    .AddConsoleExporter()
    .Build();

// Set up metrics
var meterProvider = Sdk.CreateMeterProviderBuilder()
    .AddMeter("Changelog.Library")
    .AddConsoleExporter()
    .Build();

// Use the library - traces and metrics are automatically collected
var changelog = new Changelog<MyDocument>(storage, "doc-1");
await changelog.ApplyChangesAsync(newDocument);

// Clean up
tracerProvider?.Dispose();
meterProvider?.Dispose();
```

### Required NuGet Packages

For OpenTelemetry integration:

```xml
<ItemGroup>
  <PackageReference Include="OpenTelemetry" Version="1.9.0" />
  <PackageReference Include="OpenTelemetry.Exporter.Console" Version="1.9.0" />
  <PackageReference Include="OpenTelemetry.Extensions.Hosting" Version="1.9.0" />
</ItemGroup>
```

## Distributed Tracing

### What Gets Traced

Every operation in the library creates an `Activity` span:

**Core Operations:**
- `Changelog.ApplyChanges` - Applying changes to documents
- `Changelog.GetDocument` - Retrieving current document state
- `Changelog.GetHistory` - Querying change history
- `Changelog.SetDocument` - Setting document state
- `Changelog.StreamHistory` - Streaming history query

**Storage Operations:**
- `{Storage}.LoadState` - Loading document state
- `{Storage}.SaveState` - Saving document state
- `{Storage}.AppendChanges` - Appending changes
- `{Storage}.GetChanges` - Retrieving changes

**Internal Operations:**
- `DiffEngine.Diff` - Computing differences between states

### Trace Hierarchy Example

```
Changelog.ApplyChanges (10.5ms)
├── DiffEngine.Diff (2.1ms)
├── CompressedStorage.AppendChanges (8.2ms)
│   └── CachedStorage.AppendChanges (8.1ms)
│       └── SqliteStorage.AppendChanges (7.9ms)
└── CompressedStorage.SaveState (0.2ms)
    └── CachedStorage.SaveState (0.1ms)
```

### Trace Attributes

All spans include standard tags:

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `document_id` | string | Document identifier | `"user-123"` |
| `operation` | string | Operation name | `"ApplyChanges"` |
| `change.count` | int | Number of changes | `3` |

**Storage-specific attributes:**

| Attribute | Type | Storage | Description |
|-----------|------|---------|-------------|
| `storage.type` | string | All | Storage backend type |
| `db.system` | string | SQLite | Database system name |
| `cache.hit` | bool | Cached | Cache hit/miss indicator |
| `compression.type` | string | Compressed | Compression algorithm |

**Diff-specific attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| `diff.type` | string | Type of diff operation |
| `diff.count` | int | Number of differences found |

### Exception Recording

Exceptions are automatically recorded in spans:

```csharp
// Exceptions are captured as Activity events
activity?.AddEvent(new ActivityEvent(
    "exception",
    tags: new ActivityTagsCollection
    {
        ["exception.type"] = ex.GetType().FullName,
        ["exception.message"] = ex.Message,
        ["exception.stacktrace"] = ex.StackTrace
    }
));
```

## Metrics

### Available Metrics

#### Counters

**`changelog.operation.count`** - Total number of operations
- Tags: `operation`, `status` (success/error)
- Use for: Operation throughput, error rates

**`changelog.change.count`** - Total number of changes processed
- Tags: `operation`
- Use for: Change volume tracking

**`changelog.error.count`** - Total number of errors
- Tags: `operation`, `error.type`
- Use for: Error monitoring, alerting

#### Histograms

**`changelog.operation.duration`** - Operation duration in milliseconds
- Tags: `operation`
- Use for: Performance monitoring, SLA tracking
- Unit: milliseconds

**`changelog.history.size`** - Number of history records returned
- Tags: none
- Use for: Query size monitoring

**`changelog.diff.complexity`** - Number of changes in a diff
- Tags: none
- Use for: Diff complexity tracking

### Metric Examples

```csharp
// Operation throughput
SELECT COUNT(*) FROM changelog.operation.count WHERE operation='ApplyChanges'

// Average operation duration
SELECT AVG(value) FROM changelog.operation.duration WHERE operation='GetHistory'

// Error rate
SELECT
    SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) / COUNT(*) * 100 AS error_rate
FROM changelog.operation.count
WHERE operation='ApplyChanges'

// P95 latency
SELECT PERCENTILE(95, value) FROM changelog.operation.duration
```

## Integration Examples

### OpenTelemetry with Jaeger

Export traces to Jaeger for visualization:

```csharp
using OpenTelemetry;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .SetResourceBuilder(ResourceBuilder.CreateDefault()
        .AddService("MyApp", serviceVersion: "1.0.0"))
    .AddSource("Changelog.Library")
    .AddJaegerExporter(options =>
    {
        options.AgentHost = "localhost";
        options.AgentPort = 6831;
    })
    .Build();
```

**Required package:**
```xml
<PackageReference Include="OpenTelemetry.Exporter.Jaeger" Version="1.5.1" />
```

### OpenTelemetry with Zipkin

```csharp
var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .SetResourceBuilder(ResourceBuilder.CreateDefault()
        .AddService("MyApp"))
    .AddSource("Changelog.Library")
    .AddZipkinExporter(options =>
    {
        options.Endpoint = new Uri("http://localhost:9411/api/v2/spans");
    })
    .Build();
```

**Required package:**
```xml
<PackageReference Include="OpenTelemetry.Exporter.Zipkin" Version="1.9.0" />
```

### Application Insights

```csharp
using Microsoft.ApplicationInsights;
using Microsoft.ApplicationInsights.Extensibility;

var telemetryConfiguration = TelemetryConfiguration.CreateDefault();
telemetryConfiguration.ConnectionString = "InstrumentationKey=...";

var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource("Changelog.Library")
    .AddAzureMonitorTraceExporter(options =>
    {
        options.ConnectionString = "InstrumentationKey=...";
    })
    .Build();
```

**Required package:**
```xml
<PackageReference Include="Azure.Monitor.OpenTelemetry.Exporter" Version="1.3.0" />
```

### ASP.NET Core Integration

Automatic setup with dependency injection:

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddSource("Changelog.Library")
        .AddAspNetCoreInstrumentation()
        .AddJaegerExporter())
    .WithMetrics(metrics => metrics
        .AddMeter("Changelog.Library")
        .AddAspNetCoreInstrumentation()
        .AddPrometheusExporter());

var app = builder.Build();

// Enable Prometheus scraping endpoint
app.MapPrometheusScrapingEndpoint();
```

**Required packages:**
```xml
<PackageReference Include="OpenTelemetry.Extensions.Hosting" Version="1.9.0" />
<PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.9.0" />
<PackageReference Include="OpenTelemetry.Exporter.Prometheus.AspNetCore" Version="1.9.0-beta.2" />
```

### Prometheus Metrics

Export metrics for Prometheus:

```csharp
using OpenTelemetry.Metrics;

var meterProvider = Sdk.CreateMeterProviderBuilder()
    .AddMeter("Changelog.Library")
    .AddPrometheusHttpListener(options =>
    {
        options.UriPrefixes = new[] { "http://localhost:9090/" };
    })
    .Build();
```

Metrics available at `http://localhost:9090/metrics`.

## Production Best Practices

### Sampling

Don't trace every operation in high-throughput scenarios:

```csharp
var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("MyApp"))
    .AddSource("Changelog.Library")
    .SetSampler(new TraceIdRatioBasedSampler(0.1))  // Sample 10% of traces
    .AddJaegerExporter()
    .Build();
```

### Filtering

Only export certain operations:

```csharp
var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource("Changelog.Library")
    .AddProcessor(new MyFilterProcessor())  // Custom filtering
    .AddJaegerExporter()
    .Build();

class MyFilterProcessor : BaseProcessor<Activity>
{
    public override void OnEnd(Activity data)
    {
        // Only export operations that took > 100ms
        if (data.Duration.TotalMilliseconds < 100)
            return;

        base.OnEnd(data);
    }
}
```

### Resource Attributes

Add environment context:

```csharp
var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .SetResourceBuilder(ResourceBuilder.CreateDefault()
        .AddService("MyApp", serviceVersion: "1.2.3")
        .AddAttributes(new Dictionary<string, object>
        {
            ["deployment.environment"] = "production",
            ["host.name"] = Environment.MachineName,
            ["service.namespace"] = "weave.changelog"
        }))
    .AddSource("Changelog.Library")
    .AddJaegerExporter()
    .Build();
```

### Batching

Batch exports for better performance:

```csharp
var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource("Changelog.Library")
    .AddJaegerExporter()
    .AddBatchActivityExportProcessor()  // Batch spans before export
    .Build();
```

### Performance Impact

The library's instrumentation has **near-zero overhead** when tracing is disabled:

- No listeners = no `Activity` objects created
- No allocations if no exporters configured
- Tracing checks are inlined and JIT-optimized

Typical overhead with tracing enabled:
- Memory: ~200 bytes per span
- CPU: <1% for typical workloads
- Latency: <0.1ms per operation

## Troubleshooting

### No Traces Appearing

1. **Check ActivitySource subscription:**
   ```csharp
   // Must add "Changelog.Library" source
   .AddSource("Changelog.Library")
   ```

2. **Verify exporter configuration:**
   ```csharp
   // Console exporter for debugging
   .AddConsoleExporter()
   ```

3. **Check sampling:**
   ```csharp
   // Default sampler may drop traces
   .SetSampler(new AlwaysOnSampler())
   ```

### Missing Attributes

Tags are only set if values are available:
- `document_id` - Always present
- `change.count` - Only on operations that process changes
- `cache.hit` - Only on CachedStorage operations

### Performance Issues

1. **Too many spans:**
   - Use sampling: `.SetSampler(new TraceIdRatioBasedSampler(0.1))`
   - Filter low-value traces

2. **Exporter blocking:**
   - Use batching: `.AddBatchActivityExportProcessor()`
   - Configure batch size and timeout

3. **Memory usage:**
   - Reduce trace retention
   - Lower sampling rate
   - Limit span attributes

### Metrics Not Updating

1. **Check meter subscription:**
   ```csharp
   .AddMeter("Changelog.Library")
   ```

2. **Verify metric reader:**
   ```csharp
   // Add at least one exporter
   .AddConsoleExporter()
   ```

3. **Check metric interval:**
   ```csharp
   .AddConsoleExporter(options =>
   {
       options.MetricReaderType = MetricReaderType.Periodic;
       options.PeriodicExportingMetricReaderOptions = new()
       {
           ExportIntervalMilliseconds = 1000  // Export every 1 second
       };
   })
   ```

## Advanced Topics

### Custom Tags

Add your own tags to traces:

```csharp
using System.Diagnostics;

// Get current activity
var activity = Activity.Current;
activity?.SetTag("user.id", userId);
activity?.SetTag("tenant.id", tenantId);

// Now use the library - your tags are included
await changelog.ApplyChangesAsync(newState);
```

### Correlation

Traces automatically flow across async boundaries:

```csharp
// Parent span
using var parentActivity = new Activity("ProcessDocument").Start();

// Child spans created by Changelog operations are automatically correlated
await changelog.ApplyChangesAsync(newState);
await changelog.GetHistoryAsync();

// All operations share the same trace ID
```

### Custom Metrics

Add your own measurements:

```csharp
using System.Diagnostics.Metrics;

var meter = new Meter("MyApp", "1.0.0");
var documentSizeCounter = meter.CreateCounter<long>("document.size");

// Record custom metric
var state = await changelog.GetDocumentAsync();
documentSizeCounter.Add(JsonSerializer.Serialize(state).Length);
```

## Example Dashboards

### Jaeger Query Examples

```
# Find slow operations
service=MyApp operation=Changelog.ApplyChanges duration>100ms

# Find errors
service=MyApp error=true

# Trace specific document
service=MyApp document_id=user-123
```

### Prometheus Queries

```promql
# Operation rate
rate(changelog_operation_count[5m])

# Average duration
rate(changelog_operation_duration_sum[5m]) / rate(changelog_operation_duration_count[5m])

# Error rate
rate(changelog_error_count[5m]) / rate(changelog_operation_count[5m])

# P95 latency
histogram_quantile(0.95, rate(changelog_operation_duration_bucket[5m]))
```

### Grafana Dashboard

Example panel queries:

```json
{
  "title": "Operation Throughput",
  "targets": [
    {
      "expr": "rate(changelog_operation_count{operation=\"ApplyChanges\"}[5m])"
    }
  ]
}
```

## References

- [.NET Distributed Tracing](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/distributed-tracing)
- [.NET Metrics](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/metrics)
- [OpenTelemetry .NET](https://opentelemetry.io/docs/instrumentation/net/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
