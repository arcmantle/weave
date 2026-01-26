# Pivot Registry Example

A sample application demonstrating how to use the Pivot.Registry library.

## Running the Registry

```bash
dotnet run
```

The registry will start on `http://localhost:5100` with Swagger UI available at `http://localhost:5100/swagger`.

## Configuration

The registry can be configured via `appsettings.json` or in code:

```csharp
builder.AddPivotRegistry(options => {
    options.Enabled = true;
    options.ApplicationName = "RegistryExample";
    options.StorageProvider = "FileSystem"; // or "MinIO"
});
```

## Data Storage

All data is stored in the cross-platform application data directory:
- **Windows**: `C:\Users\{user}\AppData\Local\Pivot\Registries\RegistryExample\`
- **macOS/Linux**: `~/.local/share/Pivot/Registries/RegistryExample/`

This includes:
- `registry.db` - SQLite database
- `packages/` - Plugin package files (.pivotpkg)

## API Endpoints

- `GET /api/plugins` - List all plugins
- `GET /api/plugins/{name}` - Get plugin details
- `POST /api/plugins/upload` - Upload a new plugin package
- `GET /api/plugins/{name}/versions/{version}/download` - Download a plugin package
- `DELETE /api/plugins/{name}/versions/{version}` - Delete a plugin version
