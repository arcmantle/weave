---
title: Installation
description: How to install Changelog and its storage providers
---

# Installation

Changelog is distributed as NuGet packages. Install the core package plus your
preferred storage provider.

## Prerequisites

- .NET 10.0 or later
- NuGet package manager

## Package Structure

Changelog uses a modular architecture where each storage provider is a separate
package:

```text
Changelog.Core          ← Core types, DiffEngine, MemoryStorage
├── Changelog.Sqlite    ← SQLite storage provider
├── Changelog.PostgreSQL ← PostgreSQL storage provider
└── Changelog.MongoDB   ← MongoDB storage provider
```

This means you only install what you need, keeping your dependencies minimal.

## Installation Steps

### 1. Choose Your Storage Backend

Pick the storage provider that best fits your application:

| Provider       | Package                    | Use Case                  |
| -------------- | -------------------------- | ------------------------- |
| **Memory**     | `Changelog.Core` only      | Testing, development      |
| **SQLite**     | + `Changelog.Sqlite`       | Desktop apps, small-scale |
| **PostgreSQL** | + `Changelog.PostgreSQL`   | Production web apps       |
| **MongoDB**    | + `Changelog.MongoDB`      | Document-heavy workloads  |

### 2. Install Packages

::: code-group

```bash [.NET CLI - SQLite]
dotnet add package Changelog.Core
dotnet add package Changelog.Sqlite
```

```bash [.NET CLI - PostgreSQL]
dotnet add package Changelog.Core
dotnet add package Changelog.PostgreSQL
```

```bash [.NET CLI - MongoDB]
dotnet add package Changelog.Core
dotnet add package Changelog.MongoDB
```

```bash [.NET CLI - Memory Only]
dotnet add package Changelog.Core
```

```xml [PackageReference - SQLite]
<PackageReference Include="Changelog.Core" Version="1.0.0" />
<PackageReference Include="Changelog.Sqlite" Version="1.0.0" />
```

```xml [PackageReference - PostgreSQL]
<PackageReference Include="Changelog.Core" Version="1.0.0" />
<PackageReference Include="Changelog.PostgreSQL" Version="1.0.0" />
```

```xml [PackageReference - MongoDB]
<PackageReference Include="Changelog.Core" Version="1.0.0" />
<PackageReference Include="Changelog.MongoDB" Version="1.0.0" />
```

:::

### 3. Add Using Statements

```csharp
using Changelog;
using Changelog.Storage;
```

## Quick Start

After installation, create your first changelog:

### SQLite Example

```csharp
using Changelog;
using Changelog.Storage;

var storage = new SqliteStorage<User>("Data Source=changelog.db");
var changelog = new Changelog<User>(storage, "user-123");

// Start tracking changes
var user = new User { Name = "Alice", Email = "alice@example.com" };
await changelog.ApplyChangesAsync(user);
```

### PostgreSQL Example

```csharp
using Changelog;
using Changelog.Storage;

var connectionString = "Host=localhost;Database=myapp;Username=user;Password=pass";
var storage = new PostgresStorage<User>(connectionString);
var changelog = new Changelog<User>(storage, "user-123");

// Start tracking changes
var user = new User { Name = "Alice", Email = "alice@example.com" };
await changelog.ApplyChangesAsync(user);
```

### MongoDB Example

```csharp
using Changelog;
using Changelog.Storage;

var connectionString = "mongodb://localhost:27017";
var storage = new MongoStorage<User>(connectionString);
var changelog = new Changelog<User>(storage, "user-123");

// Start tracking changes
var user = new User { Name = "Alice", Email = "alice@example.com" };
await changelog.ApplyChangesAsync(user);
```

## Dependency Injection

### ASP.NET Core

Register changelog services in your `Program.cs`:

```csharp
using Changelog;
using Changelog.Storage;

var builder = WebApplication.CreateBuilder(args);

// Register storage provider
builder.Services.AddSingleton<IChangelogStorage<User>>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("Changelog");
    return new PostgresStorage<User>(connectionString);
});

// Register changelog factory
builder.Services.AddScoped<Func<string, Changelog<User>>>(sp =>
{
    var storage = sp.GetRequiredService<IChangelogStorage<User>>();
    return documentId => new Changelog<User>(storage, documentId);
});

var app = builder.Build();
```

### Usage in Services

```csharp
public class UserService
{
    private readonly IUserRepository _repository;
    private readonly Func<string, Changelog<User>> _changelogFactory;

    public UserService(
        IUserRepository repository,
        Func<string, Changelog<User>> changelogFactory)
    {
        _repository = repository;
        _changelogFactory = changelogFactory;
    }

    public async Task UpdateUserAsync(string userId, UpdateUserDto dto)
    {
        // Load from your database
        var oldUser = await _repository.GetByIdAsync(userId);

        // Make changes
        oldUser.Email = dto.Email;
        oldUser.Name = dto.Name;

        // Track changes
        var changelog = _changelogFactory(userId);
        await changelog.ApplyChangesAsync(oldUser, oldUser);

        // Save to your database
        await _repository.UpdateAsync(oldUser);
    }
}
```

## Configuration

### appsettings.json

```json
{
  "ConnectionStrings": {
    "Changelog": "Host=localhost;Database=myapp;Username=user;Password=pass"
  },
  "Changelog": {
    "Provider": "PostgreSQL",
    "Options": {
      "Schema": "changelog",
      "TablePrefix": "app_"
    }
  }
}
```

### Strongly-Typed Configuration

```csharp
public class ChangelogSettings
{
    public string Provider { get; set; }
    public PostgresStorageOptions Options { get; set; }
}

// In Program.cs
builder.Services.Configure<ChangelogSettings>(
    builder.Configuration.GetSection("Changelog"));

builder.Services.AddSingleton<IChangelogStorage<User>>(sp =>
{
    var settings = sp.GetRequiredService<IOptions<ChangelogSettings>>().Value;
    var connectionString = builder.Configuration.GetConnectionString("Changelog");

    return settings.Provider switch
    {
        "PostgreSQL" => new PostgresStorage<User>(connectionString, settings.Options),
        "SQLite" => new SqliteStorage<User>(connectionString),
        "MongoDB" => new MongoStorage<User>(connectionString),
        _ => new MemoryStorage<User>()
    };
});
```

## Verification

Verify your installation works:

```csharp
using Changelog;
using Changelog.Storage;

// Create a simple test
var storage = new MemoryStorage<Dictionary<string, object>>();
var changelog = new Changelog<Dictionary<string, object>>(
    storage,
    "test-doc"
);

var doc = new Dictionary<string, object>
{
    ["name"] = "Test",
    ["count"] = 1
};

await changelog.ApplyChangesAsync(doc);

doc["count"] = 2;
await changelog.ApplyChangesAsync(doc);

var history = await changelog.GetHistoryAsync();
Console.WriteLine($"Tracked {history.Count} changes ✓");
```

## Next Steps

- Follow the [Getting Started](/guide/getting-started) guide
- Learn about [storage providers](/storage/)
- Explore [usage patterns](/guide/patterns/sidecar)
