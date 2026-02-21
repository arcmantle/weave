# Multi-Framework Configuration Schema - Complete Solution

## Your Question

> "What if other packages also want to give us type information through the manifest? Since there might be multiple frameworks in use that all want to give types to the json file."

## The Problem

JSON files can only have **ONE** `$schema` reference:

```json
{
  "$schema": "???" // Can only reference ONE schema!

  "Pivot": { ... },      // Wants its own schema
  "Serilog": { ... },    // Wants its own schema
  "MassTransit": { ... } // Wants its own schema
}
```

## The Solution: Schema Composition

We've implemented a **composable schema system** where multiple frameworks contribute schemas that are merged into one composite schema file.

### Architecture

```
Multiple Frameworks         Schema Composition          Single Output
┌──────────────┐            ┌──────────────┐          ┌──────────────┐
│ Pivot        │─────┐      │              │          │              │
│ Framework    │     │      │   Schema     │          │  Composite   │
└──────────────┘     ├─────▶│  Generator   │─────────▶│   Schema     │
┌──────────────┐     │      │              │          │    .json     │
│ Serilog      │─────┤      │ ComposeSchema│          │              │
└──────────────┘     │      │   (contributors)        └──────────────┘
┌──────────────┐     │      │              │                 │
│ Your Library │─────┘      └──────────────┘                 │
└──────────────┘                                             ▼
                                                    ┌──────────────┐
                                                    │ appsettings  │
                                                    │    .json     │
                                                    │ "$schema": "."│
                                                    └──────────────┘
                                                         IntelliSense ✨
```

## Implementation

### 1. Core Interface: `ISchemaContributor`

Located in `Pivot.Core/Configuration/ISchemaContributor.cs`:

```csharp
public interface ISchemaContributor {
    string SectionName { get; }  // e.g., "Pivot", "Serilog", "MassTransit"
    int Priority { get; }        // Lower = higher priority (0-50: framework, 50-100: app, 100+: plugins)
    JsonDocument GetSchemaFragment();
}
```

Any framework can implement this interface to contribute schema!

### 2. Composition Engine: `PivotSchemaGenerator`

Located in `Pivot.Core/Configuration/PivotSchemaGenerator.cs`:

```csharp
public static class PivotSchemaGenerator {
    // Compose multiple schemas into one
    public static JsonDocument ComposeSchema(IEnumerable<ISchemaContributor> contributors) {
        // Merges all contributors by priority
        // Returns single composite schema
    }

    // Auto-discover contributors from assemblies
    public static List<ISchemaContributor> DiscoverContributors(params Assembly[] assemblies) {
        // Scans for [SchemaContributor] attributes
    }
}
```

### 3. Pivot's Implementation: `PivotSchemaContributor`

Located in `Pivot.Core/Configuration/PivotSchemaContributor.cs`:

```csharp
public class PivotSchemaContributor : ISchemaContributor {
    public string SectionName => "Pivot";
    public int Priority => 10; // Framework-level

    public PivotSchemaContributor(params Type[] optionsTypes) {
        // Accepts multiple Options classes: RegistryOptions, PluginManagementOptions, etc.
    }

    public JsonDocument GetSchemaFragment() {
        // Generates schema for all Pivot packages using NJsonSchema
    }
}
```

## Usage Examples

### Example 1: Pivot Only

```csharp
// Tools/SchemaGenerator/Program.cs
var contributors = new List<ISchemaContributor> {
    new PivotSchemaContributor(
        typeof(RegistryOptions),
        typeof(PluginManagementOptions)
    )
};

var schema = PivotSchemaGenerator.ComposeSchema(contributors);
```

Result in `appsettings.json`:
```json
{
  "$schema": "./pivot-schema.json",
  "Pivot": {
    "Registry": { ... },         // Full IntelliSense!
    "PluginManagement": { ... }  // Full IntelliSense!
  }
}
```

### Example 2: Multiple Frameworks

```csharp
var contributors = new List<ISchemaContributor> {
    new PivotSchemaContributor(
        typeof(RegistryOptions),
        typeof(PluginManagementOptions)
    ),
    new SerilogSchemaContributor(),     // Third-party
    new MassTransitSchemaContributor(), // Third-party
    new MyCustomSchemaContributor()     // Your custom library
};

var schema = PivotSchemaGenerator.ComposeSchema(contributors);
```

Result in `appsettings.json`:
```json
{
  "$schema": "./composite-schema.json",
  "Pivot": { ... },      // IntelliSense ✅
  "Serilog": { ... },    // IntelliSense ✅
  "MassTransit": { ... },// IntelliSense ✅
  "MyLibrary": { ... }   // IntelliSense ✅
}
```

### Example 3: Auto-Discovery (Future)

```csharp
// In Serilog package assembly:
[assembly: SchemaContributor(typeof(SerilogSchemaContributor))]

// In your application:
var contributors = PivotSchemaGenerator.DiscoverContributors(); // Auto-finds all!
var schema = PivotSchemaGenerator.ComposeSchema(contributors);
```

## Creating a Schema Contributor

### For Third-Party Frameworks

```csharp
using Pivot.Core.Configuration;

namespace Serilog.Configuration.Schema;

public class SerilogSchemaContributor : ISchemaContributor {
    public string SectionName => "Serilog";
    public int Priority => 20;

    public JsonDocument GetSchemaFragment() {
        var schema = new {
            type = "object",
            description = "Serilog configuration",
            properties = new {
                MinimumLevel = new {
                    type = "object",
                    properties = new {
                        Default = new {
                            type = "string",
                            @enum = new[] { "Verbose", "Debug", "Information", "Warning", "Error", "Fatal" }
                        }
                    }
                },
                WriteTo = new {
                    type = "array",
                    items = new {
                        type = "object",
                        properties = new {
                            Name = new { type = "string" },
                            Args = new { type = "object" }
                        }
                    }
                }
            }
        };

        return JsonDocument.Parse(JsonSerializer.Serialize(schema));
    }
}
```

### For Your Custom Library

```csharp
using NJsonSchema;
using Pivot.Core.Configuration;

public class MyLibrarySchemaContributor : ISchemaContributor {
    public string SectionName => "MyLibrary";
    public int Priority => 75; // Application-level

    public JsonDocument GetSchemaFragment() {
        // Option 1: Use NJsonSchema to generate from Options class
        var settings = new SystemTextJsonSchemaGeneratorSettings {
            SchemaType = SchemaType.JsonSchema
        };
        var schema = JsonSchema.FromType<MyLibraryOptions>(settings);
        return JsonDocument.Parse(schema.ToJson());

        // Option 2: Manual schema definition (like Serilog example above)
    }
}
```

## Priority System

Determines which contributor wins if multiple use the same `SectionName`:

| Priority Range | Level | Examples |
|----------------|-------|----------|
| 0-50 | Framework | Pivot (10), Serilog (20), ASP.NET Core (30) |
| 50-100 | Application | Your libraries (75) |
| 100+ | Plugin | Third-party plugins (150) |

**Lower number = higher priority**

If two contributors both use `"Serilog"`, the one with priority 20 wins over 100.

## Real-World Workflow

### As a Framework Author (e.g., Serilog team)

1. **Implement ISchemaContributor**:
   ```csharp
   public class SerilogSchemaContributor : ISchemaContributor { ... }
   ```

2. **Optional: Add Assembly Attribute**:
   ```csharp
   [assembly: SchemaContributor(typeof(SerilogSchemaContributor))]
   ```

3. **Document for Users**:
   ```markdown
   ## JSON Schema Support

   Serilog provides IntelliSense for appsettings.json via Pivot's schema system.

   To include Serilog schema:
   ```csharp
   var contributors = new List<ISchemaContributor> {
       new SerilogSchemaContributor(),
       // other contributors...
   };
   ```

### As an Application Developer

1. **Reference needed packages**:
   ```xml
   <PackageReference Include="Pivot.Registry" />
   <PackageReference Include="Serilog.AspNetCore" />
   ```

2. **Create schema generator** (if not using auto-discovery):
   ```csharp
   // Tools/SchemaGenerator/Program.cs
   var contributors = new List<ISchemaContributor> {
       new PivotSchemaContributor(typeof(RegistryOptions)),
       new SerilogSchemaContributor()
   };

   var schema = PivotSchemaGenerator.ComposeSchema(contributors);
   File.WriteAllText("appsettings-schema.json", schema);
   ```

3. **Generate schema**:
   ```bash
   dotnet run --project Tools/SchemaGenerator
   ```

4. **Use in appsettings.json**:
   ```json
   {
     "$schema": "./appsettings-schema.json",
     // IntelliSense works for all sections!
   }
   ```

## Benefits

### ✅ Solves the "One $schema" Limitation
Single schema reference includes all frameworks

### ✅ Framework-Agnostic
Any framework can participate:
- Pivot Framework
- Serilog
- MassTransit
- Entity Framework
- Your custom libraries
- Third-party plugins

### ✅ Decoupled
Each framework maintains its own schema independently

### ✅ Extensible
Add new contributors without modifying existing ones

### ✅ Discoverable
Auto-discovery via assembly attributes (when implemented)

### ✅ Priority-Based
Conflict resolution via priority system

### ✅ Type-Safe
Full IntelliSense for all configuration sections

## Files Created

### Core System
- `Pivot.Core/Configuration/ISchemaContributor.cs` - Interface for contributors
- `Pivot.Core/Configuration/SchemaContributorAttribute.cs` - Assembly attribute
- `Pivot.Core/Configuration/PivotSchemaGenerator.cs` - Composition engine
- `Pivot.Core/Configuration/PivotSchemaContributor.cs` - Pivot's implementation

### Schema Generator Tool
- `Tools/SchemaGenerator/SchemaGenerator.csproj` - Tool project
- `Tools/SchemaGenerator/Program.cs` - Generator implementation
- `Tools/SchemaGenerator/README.md` - Usage documentation

### Examples
- `Tools/SchemaGenerator/Examples/SerilogSchemaContributor.cs` - Serilog example
- `Tools/SchemaGenerator/Examples/README.md` - Multi-framework example

### Documentation
- `SCHEMA_COMPOSITION.md` - This document
- `SCHEMA_GUIDE.md` - General schema usage
- `SCHEMA_IMPLEMENTATION.md` - Technical implementation details

## Comparison with Alternatives

| Approach | Multiple Frameworks | IntelliSense | Maintenance | Extensibility |
|----------|---------------------|--------------|-------------|---------------|
| **Schema Composition** ✅ | ✅ Unlimited | ✅ Full | ✅ Auto-gen | ✅ Open |
| Multiple $schema refs | ❌ Not supported by JSON | ❌ Only first works | - | - |
| Manual merge | ✅ Possible | ✅ Works | ❌ Very high | ❌ Brittle |
| $ref imports | ⚠️ Complex | ⚠️ Partial | ⚠️ Moderate | ⚠️ Limited |
| No schema | ✅ N/A | ❌ None | ❌ Runtime errors | - |

## Future Enhancements

### 1. NuGet Package Distribution
```bash
dotnet add package Pivot.Core.Configuration.Schema
```

### 2. MSBuild Integration
```xml
<Target Name="GenerateSchemas" BeforeTargets="Build">
  <GenerateCompositeSchema Contributors="@(SchemaContributors)" />
</Target>
```

### 3. Plugin Schema Discovery
```csharp
// Plugins can contribute schemas at runtime
foreach (var plugin in LoadedPlugins) {
    if (plugin.GetSchemaContributor() is ISchemaContributor contributor) {
        contributors.Add(contributor);
    }
}
```

### 4. Schema Versioning
Track breaking changes:
```json
{
  "$pivotSchemaVersion": "1.0.0",
  "Pivot": { ... }
}
```

## Summary

You asked: **"What if other packages also want to give us type information?"**

**Answer**: We've implemented a **composable schema system** where:

1. Any framework implements `ISchemaContributor`
2. Schema generator composes all contributors into one schema
3. One `$schema` reference provides IntelliSense for all frameworks
4. Priority-based conflict resolution
5. Fully extensible and decoupled

Now you can use Pivot + Serilog + MassTransit + your libraries, **all with full IntelliSense**! 🎉

## Quick Start

```csharp
// 1. Implement for your framework
public class MyFrameworkContributor : ISchemaContributor {
    public string SectionName => "MyFramework";
    public int Priority => 50;
    public JsonDocument GetSchemaFragment() => /* your schema */;
}

// 2. Add to generator
var contributors = new List<ISchemaContributor> {
    new PivotSchemaContributor(...),
    new MyFrameworkContributor()
};

// 3. Generate
var schema = PivotSchemaGenerator.ComposeSchema(contributors);

// 4. Use
// { "$schema": "./schema.json", "MyFramework": { ... } }
```

IntelliSense everywhere! ✨
