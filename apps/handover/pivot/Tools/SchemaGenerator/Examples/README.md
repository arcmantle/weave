# Example: Multi-Framework Schema

This example demonstrates how to use schemas from multiple frameworks in a single `appsettings.json`.

## Scenario

Your application uses:
- **Pivot Framework** (Registry + Coordinator)
- **Serilog** (structured logging)
- **Your Custom Library** (custom configuration)

## Step 1: Implement Schema Contributors

### Serilog Example
See `SerilogSchemaContributor.cs` - shows how Serilog could provide schema

### Your Custom Library
```csharp
public class MyLibrarySchemaContributor : ISchemaContributor {
    public string SectionName => "MyLibrary";
    public int Priority => 75; // Application-level

    public JsonDocument GetSchemaFragment() {
        var schema = JsonSchema.FromType<MyLibraryOptions>(settings);
        return JsonDocument.Parse(schema.ToJson());
    }
}
```

## Step 2: Register Contributors

In `Tools/SchemaGenerator/Program.cs`:

```csharp
var contributors = new List<ISchemaContributor> {
    new PivotSchemaContributor(
        typeof(RegistryOptions),
        typeof(PluginManagementOptions)
    ),
    new SerilogSchemaContributor(),
    new MyLibrarySchemaContributor()
};

var schema = PivotSchemaGenerator.ComposeSchema(contributors);
```

## Step 3: Generate Composite Schema

```bash
cd Tools/SchemaGenerator
dotnet run
```

Creates `pivot-schema.json` with all frameworks included.

## Step 4: Use in appsettings.json

```json
{
  "$schema": "../../pivot-schema.json",
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  },
  "Pivot": {
    "Registry": {
      "ApplicationName": "MyApp"
    },
    "PluginManagement": {
      "Enabled": true
    }
  },
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information"
    },
    "WriteTo": [
      {
        "Name": "Console"
      }
    ]
  },
  "MyLibrary": {
    "Feature1": true
  }
}
```

**All sections get IntelliSense!** ✨

## Benefits

- One `$schema` reference for everything
- Each framework maintains its own schema
- Composable and extensible
- Priority-based conflict resolution
