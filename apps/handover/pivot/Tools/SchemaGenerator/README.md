# Pivot Schema Generator

Generates JSON schemas for Pivot Framework configuration files.

## Usage

```bash
cd Tools/SchemaGenerator
dotnet run
```

This generates:
- `pivot-schema.json` - Composite schema for all Pivot packages
- `schemas/registry-schema.json` - Registry-specific schema
- `schemas/coordinator-schema.json` - Coordinator-specific schema

## Using Schemas in appsettings.json

Add this to the top of your `appsettings.json`:

```json
{
  "$schema": "../../pivot-schema.json",
  "Logging": { ... }
}
```

This provides:
- IntelliSense in VS Code and Visual Studio
- Validation of configuration structure
- Auto-completion for Pivot options

## Adding New Options

When you create new Pivot options classes:

1. Add `[JsonPropertyName]` attributes for custom JSON names
2. Add XML documentation comments for descriptions
3. Run the schema generator to update schemas
4. Schemas are automatically composed into the main schema
