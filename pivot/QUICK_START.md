# Quick Start Guide - Pivot Framework

## 🚀 Get Started in 5 Minutes

### Prerequisites
- .NET 10.0 SDK
- Docker (optional, for MinIO)

### Type-Safe Configuration Setup

The Pivot Framework provides **full IntelliSense and validation** for your `appsettings.json` through JSON schemas.

#### Option 1: Use Pre-Generated Schemas
All sample projects already include schema references:

```json
{
  "$schema": "../../pivot-schema.json",
  "Pivot": {
    "Registry": {
      // IntelliSense works here automatically! 🎉
    }
  }
}
```

#### Option 2: Generate Fresh Schemas
If you've updated Options classes:

```bash
cd Tools/SchemaGenerator
dotnet run
```

This creates:
- `pivot-schema.json` - Composite schema for all Pivot packages
- `schemas/*.json` - Individual package schemas

See [SCHEMA_GUIDE.md](SCHEMA_GUIDE.md) for details.

### Step 1: Start the Registry (FileSystem Mode)

```bash
cd apps/handover/pivot/Pivot.Registry
dotnet run
```

Registry is now running at `http://localhost:5100`

### Step 2: Create Your First Plugin Package

```bash
# Create directory structure
mkdir WeatherPlugin-Package
cd WeatherPlugin-Package
mkdir client server

# Create manifest.json
cat > manifest.json << 'EOF'
{
  "name": "WeatherPlugin",
  "version": "1.0.0",
  "description": "Provides weather forecast data",
  "author": "Your Name",
  "license": "MIT",
  "tags": ["weather", "api"]
}
EOF

# Copy your compiled plugin DLL (example)
cp ../Samples/Plugins/WeatherPlugin/bin/Debug/net9.0/WeatherPlugin.dll server/

# Create package
zip -r ../WeatherPlugin-1.0.0.pivotpkg manifest.json client/ server/
cd ..
```

### Step 3: Upload to Registry

```bash
curl -X POST -F "file=@WeatherPlugin-1.0.0.pivotpkg" \
  http://localhost:5100/api/plugins/upload
```

Response:
```json
{
  "message": "Plugin uploaded successfully",
  "plugin": "WeatherPlugin",
  "version": "1.0.0",
  "id": 1
}
```

### Step 4: Browse Registry

```bash
# List all plugins
curl http://localhost:5100/api/plugins

# Get specific plugin
curl http://localhost:5100/api/plugins/WeatherPlugin

# Download plugin
curl -O http://localhost:5100/api/plugins/WeatherPlugin/versions/1.0.0/download
```

### Step 5: View API Documentation

Open `http://localhost:5100/swagger` in your browser

---

## 🐳 Using Docker with MinIO

### Start Registry + MinIO

```bash
cd apps/handover/pivot
docker-compose up
```

Services:
- **Registry**: http://localhost:5100
- **MinIO API**: http://localhost:9000
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

### Switch to MinIO Storage

Edit `appsettings.json`:
```json
{
  "StorageProvider": "MinIO"
}
```

Or use migration:
```bash
curl -X POST "http://localhost:5100/api/storage/migrate?from=FileSystem&to=MinIO"
```

---

## 📦 Example: Publishing Multiple Versions

```bash
# Version 1.0.0
zip -r WeatherPlugin-1.0.0.pivotpkg manifest.json client/ server/
curl -X POST -F "file=@WeatherPlugin-1.0.0.pivotpkg" http://localhost:5100/api/plugins/upload

# Update manifest to 1.1.0
sed -i 's/"version": "1.0.0"/"version": "1.1.0"/' manifest.json

# Version 1.1.0
zip -r WeatherPlugin-1.1.0.pivotpkg manifest.json client/ server/
curl -X POST -F "file=@WeatherPlugin-1.1.0.pivotpkg" http://localhost:5100/api/plugins/upload

# List versions
curl http://localhost:5100/api/plugins/WeatherPlugin
```

---

## 🔌 Installing Plugins (Coordinator Integration)

### Method 1: Via Admin UI

1. Start Coordinator (if not broken):
   ```bash
   cd Pivot.Coordinator
   dotnet run
   ```

2. Navigate to http://localhost:5000

3. Click "Plugin Registry" tab

4. Enter Registry URL: `http://localhost:5100`

5. Click "Load Registry"

6. Select plugin and version

7. Click "Install"

8. Enable and deploy in "Installed Plugins" tab

### Method 2: Via API

```bash
# Install plugin from registry
curl -X POST \
  "http://localhost:5000/api/plugins/install?registryUrl=http://localhost:5100&name=WeatherPlugin&version=1.0.0"

# Enable plugin
curl -X POST http://localhost:5000/api/plugins/WeatherPlugin/enable

# Deploy plugins
curl -X POST http://localhost:5000/api/plugins/deploy
```

---

## 🔍 Searching & Filtering

```bash
# Search by name/description
curl "http://localhost:5100/api/plugins?search=weather"

# Filter by tag
curl "http://localhost:5100/api/plugins?tag=api"

# Pagination
curl "http://localhost:5100/api/plugins?page=1&pageSize=10"

# Get all tags
curl "http://localhost:5100/api/plugins/tags"
```

---

## 🗑️ Deleting Versions

```bash
# Delete specific version
curl -X DELETE http://localhost:5100/api/plugins/WeatherPlugin/versions/1.0.0
```

---

## 📊 Monitoring

```bash
# Check storage provider
curl http://localhost:5100/api/storage/info

# View download counts
curl http://localhost:5100/api/plugins/WeatherPlugin | jq '.versions[].downloadCount'
```

---

## 🛠️ Troubleshooting

### Registry won't start
```bash
# Check if port 5100 is available
netstat -an | grep 5100

# Use different port
dotnet run --urls "http://localhost:5200"
```

### MinIO connection issues
```bash
# Verify MinIO is running
docker ps | grep minio

# Check MinIO logs
docker logs pivot-minio

# Test connection
curl http://localhost:9000/minio/health/live
```

### Upload fails
```bash
# Verify package structure
unzip -l WeatherPlugin-1.0.0.pivotpkg

# Check package size (max 100MB)
ls -lh WeatherPlugin-1.0.0.pivotpkg

# Validate manifest
cat manifest.json | jq .
```

### Build errors
```bash
# Restore packages
dotnet restore

# Clean build
dotnet clean
dotnet build
```

---

## 📝 Quick Reference

### Package Structure
```
plugin-name.pivotpkg (ZIP)
├── manifest.json
├── client/
│   └── (optional client files)
└── server/
    └── PluginName.dll (required)
```

### Manifest Template
```json
{
  "name": "PluginName",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Your Name",
  "license": "MIT",
  "tags": ["tag1", "tag2"],
  "pluginDependencies": {
    "OtherPlugin": "^1.0.0"
  }
}
```

### Environment Variables (Docker)
```bash
ASPNETCORE_ENVIRONMENT=Development
StorageProvider=MinIO
MinIO__Endpoint=minio:9000
MinIO__AccessKey=minioadmin
MinIO__SecretKey=minioadmin
```

---

## 🎯 Next Steps

1. ✅ Upload your first plugin
2. ✅ Test download and installation
3. ✅ Try multiple versions
4. ⬜ Set up MinIO for production
5. ⬜ Add authentication
6. ⬜ Deploy with Docker

---

**Need Help?** Check [README.md](Pivot.Registry/README.md) for detailed documentation.
