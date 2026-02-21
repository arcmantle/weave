# Pivot.Registry.Client

Web client for the Pivot Registry, built with Lit and TypeScript.

## Migration from Blazor

This client has been migrated from Blazor WebAssembly to Lit + TypeScript for better performance, smaller bundle size, and simpler deployment.

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Project Structure

```
src/
  ├── components/        # Lit components
  │   ├── login-page.ts
  │   └── registry-manager.ts
  ├── models/            # TypeScript interfaces
  │   ├── auth.ts
  │   └── plugin.ts
  ├── services/          # API services
  │   ├── auth-service.ts
  │   └── plugin-api-service.ts
  └── app.ts             # Main app with routing
```

## Features

- **Authentication**: Simple username-based authentication with JWT
- **Plugin Management**: Browse, upload, and delete plugin packages
- **Storage Info**: View registry storage statistics
- **Responsive UI**: Modern, clean interface built with Lit components

## API Endpoints

The client connects to the Pivot Registry API:

- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `GET /api/plugins` - List plugins
- `DELETE /api/plugins/{name}/versions/{version}` - Delete plugin version

## Configuration

The dev server proxies API requests to `http://localhost:5100` (configurable in `vite.config.ts`).
