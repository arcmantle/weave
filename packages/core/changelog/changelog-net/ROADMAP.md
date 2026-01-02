# Changelog Library - Production Roadmap

## Executive Summary

The Changelog library provides a solid foundation for document change tracking with automatic diffing, grouped changes, and flexible storage. However, to support production workloads at scale (millions of documents, billions of changes), significant improvements are needed across performance, scalability, and reliability.

**Current Status**: ✅ Proof of Concept / Learning Project
**Target Status**: 🎯 Production-Ready for Enterprise Scale

---

## Architecture Overview

### Current Design

```txt
┌─────────────────┐
│  Changelog<T>   │  ← Public API (per-document instance)
└────────┬────────┘
         │
┌────────▼────────┐
│ IChangelogStorage│  ← Storage abstraction
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼───┐  ┌──▼──────┐
│Memory │  │ SQLite  │
│Storage│  │ Storage │
└───────┘  └─────────┘

Database Schema:
- States:  {documentId, state, lastUpdated}
- Changes: {id, documentId, path, type, oldValue, newValue, timestamp, groupId}
- Groups:  {id, documentId, timestamp, changeCount, metadata}
```

### Identified Issues

#### Performance Issues

1. **Double serialization on reads** - Every `GetDocumentAsync()` serializes + deserializes twice
2. **Missing database indexes** - Full table scans on filtered queries
3. **In-memory loading** - All changes loaded before filtering
4. **Reflection overhead** - Property access via reflection on every diff
5. **No caching** - Repeated work for same operations

#### Scalability Issues

1. **Unbounded growth** - No archival or retention policies
2. **No pagination** - Entire result sets loaded at once
3. **Single database** - All document types share tables (contention)
4. **No sharding** - Can't distribute load across databases
5. **Array diff inefficiency** - Stores entire arrays on single item change

#### Reliability Issues

1. **No optimistic concurrency** - Last-write-wins causes data loss
2. **Non-atomic groups** - Partial failures leave orphaned groups
3. **No circular ref detection** - Stack overflow on circular objects
4. **No transactions** - Multi-document updates aren't atomic

#### Missing Features

1. **Compression** - JSON stored uncompressed
2. **Security** - No ACLs, encryption, or access auditing
3. **Observability** - No metrics, tracing, or structured logging
4. **Conflict resolution** - No merge strategies for concurrent edits
5. **Streaming** - No async enumeration for large queries

---

## Roadmap Phases

### Phase 0: Critical Fixes (MUST HAVE)

*Timeline: 2-3 weeks*
*Goal: Make library safe for production use*

| Priority | Issue | Solution | Impact |
| ---------- | ------- | ---------- | -------- |
| **P0-1** | Missing database indexes | Add composite indexes on `(DocumentId, Timestamp)`, `(DocumentId, GroupId)`, `(GroupId)` | 100x query speedup |
| **P0-2** | No pagination support | Add `skip`/`take` params to `GetChangesAsync()` and `GetGroupsAsync()` | Prevents OOM |
| **P0-3** | Non-atomic group operations | Wrap `BeginGroup` → `ApplyChanges` → `CommitGroup` in transactions | Data consistency |
| **P0-4** | No optimistic concurrency | Add version/etag to States table, check before write | Prevents data loss |
| **P0-5** | In-memory filtering | Push WHERE clauses to SQL, return filtered results | 10x memory reduction |

**Deliverables:**

- [x] Add migration script for indexes *(Completed: Jan 1, 2026)*
- [x] Update `IChangelogStorage` interface with pagination params *(Completed: Jan 1, 2026)*
- [x] Implement transaction support in SqliteStorage *(Completed: Jan 1, 2026)*
- [x] Add `Version` column to States table *(Completed: Jan 1, 2026)*
- [x] Refactor `GetChangesAsync()` to build SQL WHERE clauses *(Completed: Jan 1, 2026)*

**Success Criteria:**

- ✅ Queries on 1M changes complete in <100ms
- ✅ No data loss under concurrent writes
- ✅ Memory usage stays flat regardless of change count

---

### Phase 1: Performance & Scalability (SHOULD HAVE)

*Timeline: 4-6 weeks*
*Goal: Handle millions of documents efficiently*

| Priority | Issue | Solution | Impact |
|----------|-------|----------|--------|
| **P1-1** | Double serialization overhead | Cache deserialized documents, use copy-on-write | 2x faster reads |
| **P1-2** | Reflection in DiffEngine | Use compiled expressions or source generators | 5x faster diffs |
| **P1-3** | Inefficient array diffs | Implement LCS algorithm for array changes | 10x storage savings |
| **P1-4** | No compression | Compress `OldValue`/`NewValue` with gzip | 5x storage reduction |
| **P1-5** | Unbounded growth | Add retention policies and archival | Bounded storage |
| **P1-6** | No streaming | Implement `IAsyncEnumerable<T>` returns | Constant memory |

**Deliverables:**

- [x] Implement document cache with LRU eviction *(Completed: Jan 1, 2026)*
- [x] Refactor DiffEngine to use `Expression.Compile()` *(Completed: Jan 1, 2026)*
- [x] Add LCS-based array differ *(Completed: Jan 1, 2026)*
- [x] Add compression layer in storage implementations *(Completed: Jan 1, 2026)*
- [x] Create retention policies with configurable cleanup *(Completed: Jan 1, 2026)*
- [x] Update all list methods to return `IAsyncEnumerable<T>` *(Completed: Jan 1, 2026)*

**Success Criteria:**

- ✅ Diff performance: 10k objects/sec
- ✅ Storage: <50% of current size with compression
- ✅ Memory: Constant regardless of query size

---

### Phase 2: Production Hardening (SHOULD HAVE)
*Timeline: 3-4 weeks*
*Goal: Enterprise-grade reliability and observability*

| Priority | Feature | Implementation | Impact |
|----------|---------|----------------|--------|
| **P2-1** | ✅ Distributed tracing | Add .NET Activity instrumentation | Debuggability |
| **P2-2** | ✅ Metrics | Track query latency, storage size, error rates | Monitoring |
| **P2-3** | ✅ Structured logging | Use `ILogger` with contextual data | Troubleshooting |
| **P2-4** | ✅ Circular ref detection | Add visited set in diff recursion | Prevents crashes |
| **P2-5** | ✅ Multi-document transactions | Add `IChangelogTransaction` interface | Atomicity |
| **P2-6** | ✅ Health checks | Implement storage health endpoints | Reliability |

**Deliverables:**

- [x] Add `ActivitySource` for tracing *(Complete: Jan 2, 2026 - All layers instrumented, docs complete)*
- [x] Expose metrics via `Meter` *(Complete: Jan 2, 2026 - 6 instruments, all core operations instrumented)*
- [x] Add structured logging throughout *(Complete: Jan 2, 2026 - ILogger support, trace correlation, error logging)*
- [x] Implement cycle detection in DiffEngine *(Complete: Jan 2, 2026 - Already implemented, added tests and docs)*
- [x] Create transaction coordinator *(Complete: Jan 2, 2026 - MemoryStorage & SqliteStorage transaction support)*
- [x] Add health check middleware *(Complete: Jan 2, 2026 - CheckHealthAsync() on all storage backends)*

**Success Criteria:**

- ✅ All operations traced end-to-end
- ✅ Dashboards show P95/P99 latencies (metrics available via histograms)
- ✅ Zero crashes from circular references
- ✅ Multi-document operations are atomic
- ✅ Storage health can be monitored programmatically

---

### Phase 3: Advanced Features (NICE TO HAVE)
*Timeline: 6-8 weeks*
*Goal: Competitive feature set for complex scenarios*

| Priority | Feature | Description | Use Case |
|----------|---------|-------------|----------|
| **P3-1** | Conflict resolution | Merge strategies for concurrent edits | Collaborative editing |
| **P3-2** | Sharding support | Partition by document type/ID range | Horizontal scaling |
| **P3-3** | Read replicas | Route reads to replicas | Query scaling |
| **P3-4** | Event sourcing mode | Rebuild state from changes | Temporal queries |
| **P3-5** | Security layer | Row-level ACLs, encryption at rest | Compliance |
| **P3-6** | Change notifications | Pub/sub for document updates | Real-time sync |

**Deliverables:**

- [ ] Implement 3-way merge for conflicts
- [ ] Add sharding key to storage interface
- [ ] Support connection string routing
- [ ] Add `RebuildStateAsync(documentId, timestamp)` method
- [ ] Create ACL middleware
- [ ] Add webhook/event integration

**Success Criteria:**

- ✅ Supports automatic conflict resolution
- ✅ Scales horizontally to 10M+ documents
- ✅ Meets compliance requirements (GDPR, SOC2)

---

### Phase 4: Ecosystem & Developer Experience (NICE TO HAVE)
*Timeline: Ongoing*
*Goal: Best-in-class developer experience*

| Priority | Item | Description |
|----------|------|-------------|
| **P4-1** | NuGet packages | Publish to NuGet.org |
| **P4-2** | Documentation site | API docs, tutorials, examples |
| **P4-3** | Migration tools | Import from other change tracking systems |
| **P4-4** | Admin UI | Web interface for browsing changes |
| **P4-5** | CLI tool | Command-line for common operations |
| **P4-6** | Additional storage providers | Postgres, SQL Server, MongoDB, Cosmos DB |

**Deliverables:**

- [ ] Create multi-package solution structure
- [ ] Build DocFx documentation site
- [ ] Create migration CLI
- [ ] Build Blazor admin dashboard
- [ ] Create `dotnet-changelog` global tool
- [ ] Implement additional storage adapters

---

## Technical Specifications

### P0-1: Database Indexes

**Current Schema:**

```sql
CREATE TABLE Changes (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    DocumentId TEXT NOT NULL,
    Path TEXT NOT NULL,
    Type INTEGER NOT NULL,
    OldValue TEXT,
    NewValue TEXT,
    Timestamp INTEGER NOT NULL,
    GroupId TEXT
);
```

**Required Indexes:**

```sql
-- Composite index for filtered queries
CREATE INDEX idx_changes_document_timestamp
    ON Changes(DocumentId, Timestamp);

-- Index for group lookups
CREATE INDEX idx_changes_document_group
    ON Changes(DocumentId, GroupId);

-- Index for group queries
CREATE INDEX idx_groups_document_timestamp
    ON Groups(DocumentId, Timestamp);

-- Consider partial indexes for common filters
CREATE INDEX idx_changes_recent
    ON Changes(DocumentId, Timestamp)
    WHERE Timestamp > (unixepoch() - 2592000); -- Last 30 days
```

### P0-2: Pagination API

**Current Interface:**

```csharp
Task<List<ChangeRecord>> GetChangesAsync(string documentId, QueryOptions? options = null);
```

**New Interface:**

```csharp
public class QueryOptions {
    public long? Since { get; init; }
    public int? Limit { get; init; }
    public string? GroupId { get; init; }

    // NEW
    public int? Skip { get; init; }
    public int? Take { get; init; }
    public string? ContinuationToken { get; init; }
}

public class PagedResult<T> {
    public required List<T> Items { get; init; }
    public required int TotalCount { get; init; }
    public string? NextToken { get; init; }
    public bool HasMore { get; init; }
}

Task<PagedResult<ChangeRecord>> GetChangesPagedAsync(
    string documentId,
    QueryOptions? options = null
);
```

### P0-3: Transaction Support

**New Interface:**

```csharp
public interface IChangelogTransaction : IAsyncDisposable {
    Task CommitAsync();
    Task RollbackAsync();
}

public interface IChangelogStorage<T> {
    // NEW
    Task<IChangelogTransaction> BeginTransactionAsync();

    // Existing methods now participate in ambient transaction
    Task SaveStateAsync(string documentId, T state);
    Task AppendChangesAsync(string documentId, List<ChangeRecord> changes, string groupId);
}
```

**Usage:**

```csharp
await using var transaction = await storage.BeginTransactionAsync();
try {
    await storage.AppendChangesAsync(docId, changes, groupId);
    await storage.UpdateGroupChangeCountAsync(docId, groupId, count);
    await storage.SaveStateAsync(docId, state);
    await transaction.CommitAsync();
} catch {
    await transaction.RollbackAsync();
    throw;
}
```

### P0-4: Optimistic Concurrency

**Updated States Schema:**

```sql
CREATE TABLE States (
    DocumentId TEXT PRIMARY KEY,
    State TEXT NOT NULL,
    LastUpdated INTEGER NOT NULL,
    Version INTEGER NOT NULL DEFAULT 1  -- NEW
);
```

**Interface Change:**

```csharp
public class DocumentState<T> {
    public required string DocumentId { get; init; }
    public required T Data { get; init; }
    public required long Version { get; init; }  // NEW
}

// Throws ConcurrencyException if version mismatch
Task SaveStateAsync(string documentId, T state, long expectedVersion);
```

### P1-1: Document Caching

**Implementation:**

```csharp
public class CachedChangelogStorage<T> : IChangelogStorage<T> {
    private readonly IChangelogStorage<T> _inner;
    private readonly IMemoryCache _cache;

    public async Task<T?> LoadStateAsync(string documentId) {
        var cacheKey = $"state:{documentId}";

        if (_cache.TryGetValue<T>(cacheKey, out var cached)) {
            return cached;
        }

        var state = await _inner.LoadStateAsync(documentId);
        if (state != null) {
            _cache.Set(cacheKey, state, TimeSpan.FromMinutes(5));
        }
        return state;
    }
}
```

### P1-2: Compiled Diff Engine

**Before (Reflection):**

```csharp
foreach (var prop in properties) {
    var value = prop.GetValue(obj);  // Slow!
}
```

**After (Compiled Expressions):**

```csharp
private static class PropertyAccessorCache<T> {
    private static readonly ConcurrentDictionary<string, Func<T, object?>> _getters = new();

    public static Func<T, object?> GetGetter(PropertyInfo prop) {
        return _getters.GetOrAdd(prop.Name, _ => {
            var param = Expression.Parameter(typeof(T));
            var property = Expression.Property(param, prop);
            var convert = Expression.Convert(property, typeof(object));
            return Expression.Lambda<Func<T, object?>>(convert, param).Compile();
        });
    }
}
```

### P1-3: LCS Array Diffing

**Before:**

```csharp
// Stores entire new array
diffs.Add(new DiffRecord { Path = path, Kind = DiffKind.Changed, NewValue = newArray });
```

**After:**

```csharp
// Computes minimal diff
var operations = ComputeLCS(oldArray, newArray);
foreach (var op in operations) {
    switch (op.Type) {
        case OperationType.Insert:
            diffs.Add(new DiffRecord {
                Path = path.Append($"[{op.Index}]"),
                Kind = DiffKind.Added,
                NewValue = op.Value
            });
            break;
        case OperationType.Delete:
            diffs.Add(new DiffRecord {
                Path = path.Append($"[{op.Index}]"),
                Kind = DiffKind.Removed,
                OldValue = op.Value
            });
            break;
    }
}
```

---

## Performance Targets

### Latency Goals

| Operation | Current | Phase 0 | Phase 1 | Phase 2 |
|-----------|---------|---------|---------|---------|
| GetDocumentAsync | 5ms | 5ms | 2ms | 1ms (cached) |
| ApplyChangesAsync | 10ms | 10ms | 5ms | 3ms |
| GetChangesAsync (1k) | 500ms | 50ms | 20ms | 10ms |
| GetChangesAsync (100k) | OOM | 2s | 500ms | 200ms |

### Throughput Goals

| Metric | Current | Phase 0 | Phase 1 | Phase 2 |
|--------|---------|---------|---------|---------|
| Diffs/sec | 100 | 200 | 1,000 | 5,000 |
| Writes/sec | 50 | 100 | 500 | 2,000 |
| Reads/sec | 200 | 500 | 2,000 | 10,000 |

### Storage Goals

| Metric | Current | Phase 1 | Phase 3 |
|--------|---------|---------|---------|
| Bytes per change | ~500B | ~100B | ~50B |
| 1M changes | 500MB | 100MB | 50MB |
| 1B changes | 500GB | 100GB | 50GB |

---

## Testing Strategy

### Phase 0: Correctness Tests

- [ ] Concurrent write tests (100 threads)
- [ ] Transaction rollback tests
- [ ] Version conflict tests
- [ ] Index performance benchmarks

### Phase 1: Performance Tests

- [ ] Load test: 1M documents
- [ ] Load test: 100M changes
- [ ] Stress test: 10k ops/sec
- [ ] Memory profiling under load

### Phase 2: Chaos Engineering

- [ ] Network partition tests
- [ ] Database failover tests
- [ ] Slow query injection
- [ ] OOM scenarios

### Phase 3: Integration Tests

- [ ] Multi-region replication
- [ ] Disaster recovery drills
- [ ] Upgrade path validation

---

## Migration Strategy

### Breaking Changes

Each phase may introduce breaking changes. Migration guide will include:

1. **Phase 0**:
   - Add Version column to States (default to 1 for existing rows)
   - Rebuild indexes (can be done online)

2. **Phase 1**:
   - Change return types from `List<T>` to `IAsyncEnumerable<T>`
   - Add compression (transparent, backward compatible)

3. **Phase 2**:
   - No breaking changes (additive only)

### Versioning

- Follow SemVer 2.0
- Major version bump for breaking changes
- Maintain compatibility for at least one major version

---

## Success Metrics

### Technical Metrics

- ✅ P99 latency < 100ms for all operations
- ✅ Zero data loss events
- ✅ 99.99% uptime in production
- ✅ <1% error rate under load

### Business Metrics

- ✅ Supports 10M+ documents
- ✅ <$100/month hosting for 1M documents
- ✅ Sub-minute recovery from failures

### Developer Metrics

- ✅ <5 minutes to integrate
- ✅ <10 lines of code for common scenarios
- ✅ 90%+ test coverage

---

## Resources & Dependencies

### Team Requirements

- 1 Senior Engineer (architecture, P0-P1)
- 1 Mid-level Engineer (P2-P3)
- 1 QA Engineer (testing strategy)

### External Dependencies

- OpenTelemetry (tracing/metrics)
- Benchmark.NET (performance testing)
- xUnit (unit tests)

### Infrastructure

- CI/CD pipeline for benchmarks
- Test environment with realistic data
- Performance regression dashboard

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Performance regressions | High | Medium | Automated benchmarks in CI |
| Breaking changes anger users | High | Medium | Deprecation warnings, migration guides |
| Storage layer bugs cause data loss | Critical | Low | Extensive integration tests, canary releases |
| Scope creep delays launch | Medium | High | Strict phase gates, MVP focus |

---

## Decision Log

### ADR-001: Use SQLite as Primary Storage

**Context**: Need simple, embeddable storage for proof of concept
**Decision**: Use SQLite with abstraction for future alternatives
**Status**: Accepted
**Consequences**: Limits horizontal scaling, need sharding in Phase 3

### ADR-002: Store Changes as Individual Records

**Context**: Audit trail vs storage efficiency tradeoff
**Decision**: Store each property change as separate row
**Status**: Accepted
**Consequences**: More rows but better queryability, mitigated by compression

### ADR-003: Use Reflection for Diffing

**Context**: Simplicity vs performance in diffing
**Decision**: Start with reflection, optimize in Phase 1
**Status**: Accepted
**Consequences**: Performance bottleneck at scale, planned fix in P1-2

---

## Appendix

### Related Work

- **Marten**: Event sourcing for .NET on Postgres
- **EventStore**: Purpose-built event sourcing database
- **Dapper**: Micro-ORM for .NET (consider for Phase 1)
- **MassTransit**: Event bus (consider for Phase 3 notifications)

### Further Reading

- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [Change Data Capture](https://en.wikipedia.org/wiki/Change_data_capture)

### Contact

- Technical Lead: TBD
- Product Owner: TBD
- Architecture Reviews: Monthly

---

**Last Updated**: January 1, 2026
**Next Review**: After Phase 0 completion
