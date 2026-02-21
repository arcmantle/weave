# Multi-Framework Schema Composition

## The Problem

You have `appsettings.json` and want type safety, but you're using multiple frameworks:
- **Pivot Framework** (our configuration)
- **Serilog** (structured logging)
- **MassTransit** (messaging)
- **Your custom libraries**

Each framework wants to provide JSON schema for IntelliSense, but you can only have **one** `$schema` reference:

```json
{
  "$schema": "???" // Which schema do I use?
}
```

## The Solution: Schema Composition

We've implemented a **composable schema system** where multiple frameworks contribute their schemas, and they're all merged into one composite schema.

### Architecture

```
┌──────────────────────┐
│ Pivot Framework      │──┐
│ ISchemaContributor   │  │
└──────────────────────┘  │
                          │
┌──────────────────────┐  │
│ Serilog              │  │    ┌──────────────────────┐
│ ISchemaContributor   │──┼───▶│ Schema Generator     │
└──────────────────────┘  │    │ PivotSchemaGenerator │
                          │    └──────────┬───────────┘
┌──────────────────────┐  │               │
│ Your Library         │  │               ▼
│ ISchemaContributor   │──┘    ┌──────────────────────┐
└──────────────────────┘       │ Composite Schema     │
                               │ appsettings-schema   │
                               └──────────────────────┘
```

## How It Works

### Step 1: Implement ISchemaContributor

Each framework that wants to contribute schema implements the interface:

```csharp
using Pivot.Core.Configuration;

public class SerilogSchemaContributor : ISchemaContributor {
    public string SectionName => "Serilog";
    public int Priority => 20; // Lower = higher priority

    public JsonDocument GetSchemaFragment() {
        var schema = new {
            type = "object",
            description = "Serilog configuration",
            properties = new {
                MinimumLevel = new {
                    type = "string",
                    @enum = new[] { "Verbose", "Debug", "Information", "Warning", "Error", "Fatal" }
                },
                WriteTo = new {
                    type = "array",
                    description = "Sinks to write to"
                }
            }
        };

        return JsonDocument.Parse(JsonSerializer.Serialize(schema));
    }
}
```

### Step 2: Register via Assembly Attribute (Optional)

For auto-discovery:

```csharp
[assembly: SchemaContributor(typeof(SerilogSchemaContributor))]

namespace YourNamespace {
    // Your code...
}
```

### Step 3: Generate Composite Schema

#### Option A: Auto-Discovery
```csharp
// Discovers all [SchemaContributor] attributes
var schema = PivotSchemaGenerator.GenerateCompositeSchema();
```

#### Option B: Explicit Registration
```csharp
var contributors = new List<ISchemaContributor> {
    new PivotSchemaContributor(typeof(RegistryOptions), typeof(PluginManagementOptions)),
    new SerilogSchemaContributor(),
    new MassTransitSchemaContributor(),
    new MyCustomSchemaContributor()
};

var schema = PivotSchemaGenerator.ComposeSchema(contributors);
```

### Step 4: Use the Composite Schema

```json
{
  "$schema": "./composite-schema.json",
  "Logging": { ... },
  "Pivot": {
    "Registry": { /* IntelliSense works! */ },
    "PluginManagement": { /* IntelliSense works! */ }
  },
  "Serilog": {
    "MinimumLevel": "Information" // IntelliSense works!
  },
  "MassTransit": {
    "Endpoint": "..." // IntelliSense works!
  }
}
```

## Priority System

Contributors are merged by priority (lower number = higher priority):

- **0-50**: Framework-level (Pivot, ASP.NET Core)
- **50-100**: Application-level (your custom libraries)
- **100+**: Plugin-level (third-party plugins)

If two contributors use the same `SectionName`, the one with lower priority wins.

## Real-World Example

### Your Application with Multiple Frameworks

```csharp
// In Tools/SchemaGenerator/Program.cs
var contributors = new List<ISchemaContributor> {
    // Pivot Framework
    new PivotSchemaContributor(
        typeof(RegistryOptions),
        typeof(PluginManagementOptions)
    ),

    // Serilog
    new SerilogSchemaContributor(),

    // MassTransit
    new MassTransitSchemaContributor(),

    // Your custom library
    new MyCustomSchemaContributor()
};

var schema = PivotSchemaGenerator.ComposeSchema(contributors);
File.WriteAllText("composite-schema.json",
    JsonSerializer.Serialize(schema, new JsonSerializerOptions { WriteIndented = true }));
```

### Result: One Schema, All Frameworks

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Application Configuration",
  "type": "object",
  "properties": {
    "Logging": { ... },
    "Pivot": {
      "type": "object",
      "properties": {
        "Registry": { ... },
        "PluginManagement": { ... }
      }
    },
    "Serilog": {
      "type": "object",
      "properties": {
        "MinimumLevel": { ... }
      }
    },
    "MassTransit": {
      "type": "object",
      "properties": {
        "Endpoint": { ... }
      }
    }
  }
}
```

## Use Cases

### 1. Multiple Pivot Packages
```csharp
new PivotSchemaContributor(
    typeof(RegistryOptions),
    typeof(PluginManagementOptions),
    typeof(ProxyOptions),
    typeof(CoreOptions)
)
```

### 2. Third-Party Framework
```csharp
// NuGet package: Serilog.Configuration.Schema
[assembly: SchemaContributor(typeof(SerilogSchemaContributor))]
```

### 3. Plugin System
Plugins can contribute their own schemas:

```csharp
public class WeatherPluginSchemaContributor : ISchemaContributor {
    public string SectionName => "Plugins:Weather";
    public int Priority => 150; // Plugin priority

    public JsonDocument GetSchemaFragment() {
        return JsonSchema.FromType<WeatherPluginOptions>(settings);
    }
}
```

Result:
```json
{
  "Plugins": {
    "Weather": {
      "ApiKey": "...",
      "RefreshInterval": 300
    }
  }
}
```

## Benefits

### ✅ One Schema Reference
```json
{
  "$schema": "./composite-schema.json"
}
```
No more choosing between frameworks!

### ✅ Framework-Agnostic
Any framework can contribute:
- ✅ Pivot Framework
- ✅ Serilog
- ✅ MassTransit
- ✅ Entity Framework
- ✅ Your custom libraries

### ✅ Extensible
Add new contributors without modifying existing ones

### ✅ Discoverable
Assembly attributes enable auto-discovery:
```csharp
[assembly: SchemaContributor(typeof(MyContributor))]
```

### ✅ Versioned
Each contributor can version independently

## Advanced: Dynamic Plugin Schemas

Plugins loaded at runtime can contribute schemas:

```csharp
// In your plugin loader
var pluginSchemas = new List<ISchemaContributor>();

foreach (var plugin in LoadedPlugins) {
    var contributor = plugin.GetSchemaContributor();
    if (contributor != null) {
        pluginSchemas.Add(contributor);
    }
}

// Regenerate composite schema with plugin contributions
var allContributors = baseContributors.Concat(pluginSchemas);
var schema = PivotSchemaGenerator.ComposeSchema(allContributors);
```

## Comparison with Alternatives

| Approach | Multiple Frameworks | IntelliSense | Maintenance |
|----------|-------------------|--------------|-------------|
| **Composite Schema** ✅ | ✅ All in one | ✅ Full support | ✅ Auto-generated |
| Multiple $schema refs | ❌ Not supported | ❌ Only one works | N/A |
| Manual merge | ✅ Possible | ✅ Works | ❌ Very high |
| No schema | ✅ N/A | ❌ None | ❌ Runtime errors |

## Best Practices

### 1. Use Meaningful Section Names
```csharp
public string SectionName => "MyFramework"; // Good
public string SectionName => "Config";      // Too generic
```

### 2. Set Appropriate Priorities
```csharp
// Framework-level
public int Priority => 10;

// Application-level
public int Priority => 75;

// Plugin-level
public int Priority => 150;
```

### 3. Include Descriptions
```csharp
var schema = new {
    type = "object",
    description = "Clear description of what this configures", // ✅
    properties = { ... }
};
```

### 4. Version Your Schemas
```csharp
public class MySchemaContributor : ISchemaContributor {
    public const string SchemaVersion = "1.0.0";

    public JsonDocument GetSchemaFragment() {
        return new {
            // Include version in metadata
            $schemaVersion = SchemaVersion,
            ...
        };
    }
}
```

## Troubleshooting

### Conflict: Two Contributors Use Same Section Name
```csharp
// Priority determines winner
new MyContributor1() { Priority = 10 } // This one wins
new MyContributor2() { Priority = 20 } // This is ignored
```

### Schema Not Discovered
- ✅ Check assembly attribute: `[assembly: SchemaContributor(...)]`
- ✅ Ensure assembly is loaded
- ✅ Use explicit registration as fallback

### IntelliSense Not Working
- ✅ Verify `$schema` path is correct
- ✅ Reload VS Code window
- ✅ Check schema is valid JSON

## Summary

The composable schema system solves the "one `$schema` reference" limitation by:

1. **ISchemaContributor** interface for framework participation
2. **Priority system** for conflict resolution
3. **Auto-discovery** via assembly attributes
4. **Explicit registration** for fine control
5. **One composite schema** combining all contributors

Now you can use Pivot + Serilog + MassTransit + your libraries, all with full IntelliSense! 🎉
