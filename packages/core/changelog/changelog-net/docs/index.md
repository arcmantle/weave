---
layout: home

hero:
  name: "Changelog"
  text: "Document Change Tracking for .NET"
  tagline: A powerful library for tracking and managing document changes with intelligent diff engine, time-travel debugging, and pluggable storage backends
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Storage Providers
      link: /storage/
    - theme: alt
      text: View on GitHub
      link: https://github.com/arcmantle/weave

features:
  - icon: 🔍
    title: Intelligent Diff Engine
    details: Automatic change detection using compiled expression trees for 5-10x faster performance than reflection. Supports nested objects, arrays, and complex types.

  - icon: ⏱️
    title: Change Groups & History
    details: Group related changes together like Git commits. Full history with timestamps, metadata, and the ability to query changes by time range or group.

  - icon: 🗄️
    title: Pluggable Storage
    details: Choose from SQLite, PostgreSQL, MongoDB, or in-memory storage. Each provider is a separate NuGet package - install only what you need.

  - icon: 🎯
    title: Side-car Pattern
    details: Use changelog as an audit log alongside your main database. Provides old state explicitly to avoid extra database round-trips.

  - icon: 📦
    title: Stackable Decorators
    details: Add caching, compression, or custom behavior by wrapping storage providers. Decorators are composable for maximum flexibility.

  - icon: 🚀
    title: High Performance
    details: LRU caching, async streaming, LCS array diffing, and compiled property accessors. Optimized for both storage efficiency and speed.

  - icon: 📊
    title: OpenTelemetry Integration
    details: Built-in metrics and tracing for all operations. Monitor performance, track errors, and debug issues with full observability.

  - icon: 🔄
    title: Retention Policies
    details: Automatic history cleanup based on age, count, or custom rules. Keep your storage lean while maintaining important audit trails.
---

## Quick Example

Track changes to your domain models:

```csharp
using Changelog;
using Changelog.Storage;

// Choose a storage provider (SQLite, PostgreSQL, MongoDB, or Memory)
var storage = new SqliteStorage<User>("Data Source=changelog.db");
var changelog = new Changelog<User>(storage, documentId: "user-123");

// Side-car pattern: use with your existing database
var oldUser = await userRepository.GetByIdAsync(userId);
oldUser.Email = "newemail@example.com";
oldUser.Role = "admin";

// Track what changed
await changelog.ApplyChangesAsync(oldUser, oldUser);

// Save to your main database
await userRepository.UpdateAsync(oldUser);

// Query history
var history = await changelog.GetHistoryAsync(new QueryOptions {
    Since = DateTimeOffset.UtcNow.AddDays(-7).ToUnixTimeMilliseconds(),
    Limit = 50
});

// Group changes like Git commits
var groupId = await changelog.BeginGroupAsync(new Dictionary<string, object> {
    ["author"] = "admin@example.com",
    ["message"] = "Promoted user to admin"
});

user.Role = "admin";
user.Permissions = new[] { "read", "write", "delete" };

await changelog.ApplyChangesAsync(user);
await changelog.CommitGroupAsync();
```

## Why Changelog?

### Compliance & Audit Trails

Perfect for applications that need to track **who changed what and when**:

- GDPR, SOX, HIPAA compliance
- Audit logging for financial systems
- Change tracking for CRM/ERP systems
- Document management with full history

### Debugging Production Issues

See exactly what changed before a bug appeared:

```csharp
var changes = await changelog.GetHistoryAsync(new QueryOptions {
    Since = incidentTime - TimeSpan.FromHours(1),
    Limit = 100
});
```

### Minimal Integration

Just two extra lines in your repository:

```csharp
var oldEntity = await _repo.GetByIdAsync(id);
await _changelog.ApplyChangesAsync(oldEntity, updatedEntity); // ← Add this
await _repo.UpdateAsync(updatedEntity);
```

## Architecture

```txt
┌─────────────────────────────────────────────────────┐
│                  Your Application                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐         ┌─────────────────┐       │
│  │  Repository  │────────▶│  Changelog<T>   │       │
│  │  (Your DB)   │         │                 │       │
│  └──────────────┘         └────────┬────────┘       │
│                                     │               │
│                            ┌────────▼────────┐      │
│                            │ IChangelogStorage │    │
│                            └────────┬────────┘      │
│                                     │               │
│         ┌───────────────────────────┼──────────┐    │
│         │                           │          │    │
│    ┌────▼─────┐  ┌────────▼─────┐ ┌▼─────────▼┐     │
│    │ Cached   │  │ Compressed   │ │  Storage  │     │
│    │ Decorator│  │  Decorator   │ │ Provider  │     │
│    └────┬─────┘  └──────┬───────┘ └┬──────────┘     │
│         │                │           │              │
│         └────────────────┴───────────┘              │
│                          │                          │
└──────────────────────────┼──────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
       ┌────▼───┐    ┌────▼────┐   ┌────▼────┐
       │ SQLite │    │Postgres │   │ MongoDB │
       └────────┘    └─────────┘   └─────────┘
```

</div>

## Get Started

Choose your storage backend and install the corresponding package:

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

```bash [Memory (Testing)]
dotnet add package Changelog.Core
# MemoryStorage is included in Core
```

:::

[Get Started →](/guide/getting-started)
