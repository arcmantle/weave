# Type-Safe Configuration with JSON Schema

## Overview

The Pivot Framework now provides **full type safety** for `appsettings.json` through automatically generated JSON schemas. This gives you IntelliSense, validation, and documentation directly in your IDE.

## Solution Architecture

### 1. **Options Classes** (Source of Truth)
Each Pivot package defines its configuration using C# classes with XML documentation:

```csharp
namespace Pivot.Registry;

/// <summary>
/// Configuration options for the Pivot Registry
/// </summary>
public class RegistryOptions {
    /// <summary>
    /// Application name for data directory isolation
    /// </summary>
    public string ApplicationName { get; set; } = "Pivot.Registry";

    /// <summary>
    /// Storage provider: "FileSystem" or "MinIO"
    /// </summary>
    public string StorageProvider { get; set; } = "FileSystem";

    // ... more properties
}
```

### 2. **Schema Generator** (NJsonSchema)
The `Tools/SchemaGenerator` project uses NJsonSchema to generate JSON schemas from your Options classes:

```bash
cd Tools/SchemaGenerator
dotnet run
```

This creates:
- **`pivot-schema.json`** - Composite schema for all Pivot packages
- **`schemas/registry-schema.json`** - Registry-specific schema
- **`schemas/coordinator-schema.json`** - Coordinator-specific schema

### 3. **Schema Reference** (IntelliSense)
Consumer applications reference the schema in `appsettings.json`:

```json
{
  "$schema": "../../pivot-schema.json",
  "Pivot": {
    "Registry": {
      "ApplicationName": "MyRegistry",  // IntelliSense suggests valid properties
      "StorageProvider": "FileSystem"    // Validates against "FileSystem" | "MinIO"
    }
  }
}
```

## Benefits

### ✅ Type Safety
- Invalid properties are flagged immediately
- Typos caught before runtime
- Enum values validated (e.g., "FileSystem" vs "Filesystem")

### ✅ Discoverability
- IntelliSense shows all available options
- XML documentation appears as tooltips
- No need to read documentation or source code

### ✅ Multiple Package Support
The schema system is **composable** - each Pivot package contributes its own schema section:

```json
{
  "$schema": "../../pivot-schema.json",
  "Pivot": {
    "Registry": { ... },           // From Pivot.Registry
    "PluginManagement": { ... },   // From Pivot.Coordinator
    "YourFeature": { ... }         // Your custom package can add here!
  }
}
```

### ✅ Version Safety
When you update a Pivot package:
1. Run `dotnet run` in `Tools/SchemaGenerator`
2. Schemas update automatically
3. Breaking changes appear as validation errors in your IDE

## Adding Your Own Configuration

### Step 1: Create Options Class
```csharp
namespace MyCompany.PivotPlugin;

/// <summary>
/// Configuration for My Awesome Plugin
/// </summary>
public class MyPluginOptions {
    /// <summary>
    /// Enable the plugin
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// API endpoint
    /// </summary>
    public string ApiUrl { get; set; } = "https://api.example.com";
}
```

### Step 2: Update Schema Generator
Edit `Tools/SchemaGenerator/Program.cs`:

```csharp
using MyCompany.PivotPlugin;

// Add your schema generation
var myPluginSchema = JsonSchema.FromType<MyPluginOptions>(settings);

// Add to composite schema properties
pivotProperties["MyPlugin"] = JsonSerializer.Deserialize<JsonElement>(myPluginSchema.ToJson());
```

### Step 3: Generate Schema
```bash
cd Tools/SchemaGenerator
dotnet run
```

### Step 4: Use in appsettings.json
```json
{
  "$schema": "../../pivot-schema.json",
  "Pivot": {
    "MyPlugin": {
      "Enabled": true,        // IntelliSense works!
      "ApiUrl": "..."         // Validation works!
    }
  }
}
```

## Technical Details

### NJsonSchema
We use [NJsonSchema](https://github.com/RicoSuter/NJsonSchema) which:
- Generates JSON Schema from C# types
- Preserves XML documentation as `description` fields
- Supports nullable types, enums, default values
- Works with .NET 10's System.Text.Json

### Schema Structure
The composite schema follows this pattern:

```json
{
  "schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "Logging": { ... },       // Standard ASP.NET Core
    "ApplicationName": { ... },
    "Pivot": {                // All Pivot packages here
      "type": "object",
      "properties": {
        "Registry": { ... },
        "PluginManagement": { ... }
      }
    }
  }
}
```

### IDE Support
JSON Schema is supported by:
- ✅ Visual Studio 2022
- ✅ Visual Studio Code (built-in)
- ✅ JetBrains Rider
- ✅ Any editor with JSON Schema support

## Maintenance

### When to Regenerate Schemas
Run the schema generator when you:
- Add new options properties
- Change property types
- Update XML documentation
- Add new Pivot packages

### Automation
You can automate schema generation as a pre-build step:

```xml
<Target Name="GenerateSchemas" BeforeTargets="Build">
  <Exec Command="dotnet run --project $(ProjectDir)Tools\SchemaGenerator\SchemaGenerator.csproj" />
</Target>
```

## Comparison with Alternatives

| Approach | Type Safety | Multi-Package | IDE Support | Maintenance |
|----------|-------------|---------------|-------------|-------------|
| **JSON Schema** ✅ | Excellent | Composable | Built-in | Auto-generated |
| Manual validation | Poor | Manual | None | High |
| Strongly-typed only | Good | N/A | Limited | Low |
| JSON Schema by hand | Excellent | Manual | Built-in | Very High |

## Example: Complete Configuration

```json
{
  "$schema": "../../pivot-schema.json",
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "ApplicationName": "MyPivotApp",
  "AllowedHosts": "*",
  "Urls": "http://localhost:5000",
  "Pivot": {
    "Registry": {
      "Enabled": true,
      "ApplicationName": "MyRegistry",
      "StorageProvider": "FileSystem",
      "FileSystemBasePath": null
    },
    "PluginManagement": {
      "Enabled": true,
      "ApplicationName": "MyCoordinator",
      "RegistryUrl": "http://localhost:5100",
      "PluginRepositoryPath": null,
      "ActivePluginsPath": null
    }
  }
}
```

With full IntelliSense and validation! 🎉
