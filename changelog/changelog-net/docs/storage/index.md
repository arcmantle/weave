---
title: Storage Providers
description: Overview of available storage backends for Changelog
---

# Storage Providers

Changelog uses a pluggable storage architecture. Each storage provider is a separate NuGet package, so you only install what you need.

## Available Providers

| Provider | Package | Best For | Features |
|----------|---------|----------|----------|
| **Memory** | `Changelog.Core` | Testing, prototyping | Fast, no persistence |
| **SQLite** | `Changelog.Sqlite` | Desktop apps, small-scale | Embedded, serverless, transactions |
| **PostgreSQL** | `Changelog.PostgreSQL` | Production, high-scale | JSONB queries, transactions, robust |
| **MongoDB** | `Changelog.MongoDB` | Document-heavy workloads | Native JSON, flexible schema |

## Quick Comparison

### MemoryStorage

```csharp
var storage = new MemoryStorage<User>();
var changelog = new Changelog<User>(storage, "user-123");
```

**Pros:**
- ✅ Fastest performance
- ✅ No dependencies
- ✅ Perfect for testing

**Cons:**
- ❌ Data lost on restart
- ❌ No persistence

**Use for:** Unit tests, prototyping, temporary caching

---

### SqliteStorage

```csharp
var storage = new SqliteStorage<User>(
    "Data Source=changelog.db",
    new SqliteStorageOptions
    {
        TablePrefix = "app_"
    }
);
```

**Pros:**
- ✅ Embedded (no separate server)
- ✅ Full SQL capabilities
- ✅ Transaction support
- ✅ Cross-platform

**Cons:**
- ❌ Single-writer limitation
- ❌ Not ideal for high concurrency

**Use for:** Desktop applications, small web apps, development

[Learn more →](/storage/sqlite)

---

### PostgresStorage

```csharp
var storage = new PostgresStorage<User>(
    "Host=localhost;Database=myapp;Username=user;Password=pass",
    new PostgresStorageOptions
    {
        Schema = "changelog",
        TablePrefix = "app_"
    }
);
```

**Pros:**
- ✅ JSONB for efficient queries
- ✅ Full ACID transactions
- ✅ Excellent concurrency
- ✅ Production-grade

**Cons:**
- ❌ Requires server setup
- ❌ More infrastructure

**Use for:** Production web applications, APIs, multi-user systems

[Learn more →](/storage/postgresql)

---

### MongoStorage

```csharp
var storage = new MongoStorage<User>(
    "mongodb://localhost:27017",
    new MongoStorageOptions
    {
        DatabaseName = "changelog",
        CollectionPrefix = "app_"
    }
);
```

**Pros:**
- ✅ Native JSON storage
- ✅ Flexible schema
- ✅ Horizontal scaling
- ✅ Rich query capabilities

**Cons:**
- ❌ Eventual consistency (configurable)
- ❌ Requires MongoDB server

**Use for:** Document-heavy apps, microservices, event sourcing

[Learn more →](/storage/mongodb)

## Choosing a Provider

### Development
Start with **MemoryStorage** or **SQLite**:
```csharp
#if DEBUG
var storage = new MemoryStorage<User>();
#else
var storage = new SqliteStorage<User>("Data Source=changelog.db");
#endif
```

### Small Applications
Use **SQLite** for simplicity:
```csharp
var storage = new SqliteStorage<User>("Data Source=changelog.db");
```

### Production Web Apps
Choose **PostgreSQL** for reliability:
```csharp
var storage = new PostgresStorage<User>(connectionString);
```

### Microservices
Consider **MongoDB** for flexibility:
```csharp
var storage = new MongoStorage<User>(connectionString);
```

## Performance Optimizations

Wrap any storage provider with decorators:

### Caching

```csharp
var baseStorage = new PostgresStorage<User>(connectionString);
var cachedStorage = new CachedStorage<User>(baseStorage, capacity: 100);
var changelog = new Changelog<User>(cachedStorage, documentId);
```

[Learn more about caching →](/storage/decorators/cached)

### Compression

```csharp
var baseStorage = new MongoStorage<User>(connectionString);
var compressedStorage = new CompressedStorage<User>(baseStorage);
var changelog = new Changelog<User>(compressedStorage, documentId);
```

[Learn more about compression →](/storage/decorators/compressed)

### Stack Multiple Decorators

```csharp
var storage = new PostgresStorage<User>(connectionString);
var compressed = new CompressedStorage<User>(storage);
var cached = new CachedStorage<User>(compressed, capacity: 100);
var changelog = new Changelog<User>(cached, documentId);
```

## Configuration Options

All storage providers support table/collection naming options:

```csharp
// SQLite & PostgreSQL
new SqliteStorageOptions
{
    TablePrefix = "myapp_",        // Prefix all tables
    ChangesTable = "audit_log",     // Custom table name
    GroupsTable = "change_groups",
    StatesTable = "document_states"
}

// MongoDB
new MongoStorageOptions
{
    DatabaseName = "myapp",
    CollectionPrefix = "cl_",
    ChangesCollection = "changes",
    GroupsCollection = "groups",
    StatesCollection = "states"
}
```

## Next Steps

- Explore each provider in detail
- Learn about [decorators](/guide/decorators) for caching and compression
- Understand [transactions](/guide/patterns/transactions) for atomic operations
