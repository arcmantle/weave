# Pivot.Registry

A versioned plugin repository service for the Pivot framework, enabling centralized plugin distribution with support for multiple versions and storage backends.

## Features

- **Versioned Plugin Management**: Store and distribute multiple versions of plugins
- **Package Validation**: Automatic validation of `.pivotpkg` files including:
  - Zip structure verification
  - Manifest schema validation
  - .NET assembly (PE) format validation
- **Flexible Storage**: Pluggable storage backends:
  - **FileSystem**: Simple local file storage for development
  - **MinIO**: S3-compatible object storage for production
- **REST API**: Full-featured API for plugin upload, download, search, and management
- **Storage Migration**: Built-in tools to migrate between storage providers

## Package Format

Plugins are packaged as `.pivotpkg` files (ZIP archives) with the following structure:

```
plugin-name-1.0.0.pivotpkg
├── manifest.json          # Plugin metadata
├── client/                # Client-side assets (optional)
│   └── ...
└── server/                # Server-side DLLs (required)
    ├── PluginName.dll
    └── ...
```

### Manifest Schema

```json
{
  "name": "WeatherPlugin",
  "version": "1.0.0",
  "description": "Provides weather forecast API",
  "author": "John Doe",
  "license": "MIT",
  "tags": ["weather", "forecast", "api"],
  "repository": "https://github.com/user/weather-plugin",
  "homepage": "https://example.com/weather-plugin",
  "pluginDependencies": {
    "UsersPlugin": "^1.0.0"
  },
  "packageDependencies": {
    "Newtonsoft.Json": "13.0.1"
  }
}
```

## Configuration

### appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=registry.db"
  },
  "StorageProvider": "MinIO",
  "FileSystemStorage": {
    "BasePath": "registry-packages"
  },
  "MinIO": {
    "Endpoint": "localhost:9000",
    "AccessKey": "minioadmin",
    "SecretKey": "minioadmin",
    "UseSsl": false,
    "BucketName": "pivot-plugins"
  }
}
```

### Storage Providers

**FileSystem** (Development):
```json
{
  "StorageProvider": "FileSystem",
  "FileSystemStorage": {
    "BasePath": "registry-packages"
  }
}
```

**MinIO** (Production):
```json
{
  "StorageProvider": "MinIO",
  "MinIO": {
    "Endpoint": "minio:9000",
    "AccessKey": "your-access-key",
    "SecretKey": "your-secret-key",
    "UseSsl": true,
    "BucketName": "pivot-plugins"
  }
}
```

## Running the Registry

### Development (File System Storage)

```bash
cd Pivot.Registry
dotnet run
```

The registry will be available at `http://localhost:5100`.

### Production (Docker + MinIO)

```bash
cd apps/handover/pivot
docker-compose up
```

This starts:
- **Pivot.Registry** on port 5100
- **MinIO** on port 9000 (API) and 9001 (Console)

Access MinIO Console at `http://localhost:9001` (credentials: minioadmin/minioadmin).

## API Endpoints

### List Plugins
```
GET /api/plugins?search={query}&tag={tag}&page={page}&pageSize={size}
```

### Get Plugin Details
```
GET /api/plugins/{name}
```

### Get Specific Version
```
GET /api/plugins/{name}/versions/{version}
```

### Upload Plugin
```
POST /api/plugins/upload
Content-Type: multipart/form-data
Body: file=plugin.pivotpkg
```

### Download Plugin
```
GET /api/plugins/{name}/versions/{version}/download
```

### Delete Version
```
DELETE /api/plugins/{name}/versions/{version}
```

### Get Available Tags
```
GET /api/plugins/tags
```

### Storage Migration
```
POST /api/storage/migrate?from=FileSystem&to=MinIO
```

### Storage Info
```
GET /api/storage/info
```

## Installing Plugins from Registry

### Via Coordinator UI

1. Navigate to Pivot Coordinator admin panel
2. Click **"Plugin Registry"** tab
3. Enter registry URL (e.g., `http://localhost:5100`)
4. Click **"Load Registry"**
5. Browse available plugins
6. Select version and click **"Install"**
7. Switch to **"Installed Plugins"** tab
8. Enable the plugin and click **"Deploy Plugins"**
9. Click **"Reload Backends"** to activate

### Via API

```bash
# Install plugin from registry
curl -X POST "http://coordinator:5000/api/plugins/install?registryUrl=http://registry:5100&name=WeatherPlugin&version=1.0.0"

# Enable plugin
curl -X POST "http://coordinator:5000/api/plugins/WeatherPlugin/enable"

# Deploy plugins
curl -X POST "http://coordinator:5000/api/plugins/deploy"

# Reload backends
curl -X POST "http://coordinator:5000/reload"
```

## Creating Plugin Packages

### 1. Create Package Structure

```bash
mkdir my-plugin-package
cd my-plugin-package
mkdir client server
```

### 2. Add Manifest

Create `manifest.json`:

```json
{
  "name": "MyPlugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "author": "Your Name",
  "license": "MIT",
  "tags": ["example", "demo"]
}
```

### 3. Add Server DLLs

Copy compiled plugin DLLs to `server/`:

```bash
cp bin/Release/net9.0/MyPlugin.dll server/
```

### 4. Add Client Assets (Optional)

```bash
# Add client-side files if needed
cp -r client-dist/* client/
```

### 5. Package as ZIP

```bash
zip -r MyPlugin-1.0.0.pivotpkg manifest.json client/ server/
```

### 6. Upload to Registry

```bash
curl -X POST -F "file=@MyPlugin-1.0.0.pivotpkg" http://localhost:5100/api/plugins/upload
```

## Storage Migration

Switch between FileSystem and MinIO storage:

```bash
# Migrate from FileSystem to MinIO
curl -X POST "http://localhost:5100/api/storage/migrate?from=FileSystem&to=MinIO"

# Migrate from MinIO to FileSystem
curl -X POST "http://localhost:5100/api/storage/migrate?from=MinIO&to=FileSystem"
```

The migration:
- Copies all packages to the new storage
- Updates database storage keys
- Preserves all metadata and download counts
- Skips packages that already exist in destination

## Swagger UI

API documentation is available at `http://localhost:5100/swagger` in development mode.

## Architecture

```
┌─────────────────────┐
│  Pivot.Coordinator  │  ← Manages plugin state, deploys plugins
└──────────┬──────────┘
           │ HTTP (install)
           ↓
┌─────────────────────┐
│   Pivot.Registry    │  ← Hosts plugin packages
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ↓             ↓
┌─────────┐  ┌────────┐
│FileSystem│  │ MinIO  │  ← Storage backends
└─────────┘  └────────┘
```

## Database Schema

**Plugins Table**:
- Id, Name, Description, Author, Tags, CreatedAt

**PluginVersions Table**:
- Id, PluginId, Version, ManifestJson, StorageKey, FileSize, DownloadCount, UploadedAt

**PluginDependencies Table**:
- Id, PluginVersionId, DependencyName, VersionRange

## License

MIT
