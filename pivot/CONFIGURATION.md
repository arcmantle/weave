# Pivot Framework Configuration

## Type-Safe Configuration with JSON Schema

Pivot provides JSON schemas for all configuration options, giving you IntelliSense and validation in your `appsettings.json` files.

### Quick Start

Add this to the top of your `appsettings.json`:

```json
{
  "$schema": "../../pivot-schema.json",
  "Logging": { ... }
}
```

Now you get:
- **IntelliSense** - Auto-completion for all Pivot options
- **Validation** - Immediate feedback on invalid configuration
- **Documentation** - Inline descriptions from XML comments

### Generating Schemas

When you add new Pivot packages or update options classes:

```bash
cd Tools/SchemaGenerator
dotnet run
```

This generates:
- `pivot-schema.json` - Composite schema for all Pivot packages
- `schemas/registry-schema.json` - Registry-specific schema
- `schemas/coordinator-schema.json` - Coordinator-specific schema

### Configuration Structure

```json
{
  "$schema": "../../pivot-schema.json",
  "ApplicationName": "MyApp",
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  },
  "Pivot": {
    "Registry": {
      "Enabled": true,
      "ApplicationName": "MyRegistry",
      "StorageProvider": "FileSystem"
    },
    "PluginManagement": {
      "Enabled": true,
      "ApplicationName": "MyCoordinator",
      "RegistryUrl": "http://localhost:5100"
    }
  }
}
```

### Adding New Configuration Options

1. **Create Options Class** with XML documentation:
   ```csharp
   /// <summary>
   /// Options for my feature
   /// </summary>
   public class MyFeatureOptions {
       /// <summary>
       /// Enable the feature
       /// </summary>
       public bool Enabled { get; set; } = true;
   }
   ```

2. **Add to SchemaGenerator** in `Tools/SchemaGenerator/Program.cs`:
   ```csharp
   var myFeatureSchema = JsonSchema.FromType<MyFeatureOptions>(settings);
   ```

3. **Run Generator**:
   ```bash
   cd Tools/SchemaGenerator
   dotnet run
   ```

4. **Use in appsettings.json** with full IntelliSense!

### Schema Composition

The schema generator automatically composes schemas from multiple Pivot packages. Each package defines its own options, and they're all combined into a single schema for your convenience.

This allows:
- **Multiple Pivot packages** to contribute configuration schemas
- **Third-party plugins** to add their own schemas
- **Type safety** across your entire configuration

### Benefits

- **Catch errors early** - Invalid config is caught before runtime
- **Discoverable** - See all available options via IntelliSense
- **Self-documenting** - XML comments become helpful tooltips
- **Version safe** - Schema updates automatically when you upgrade packages
