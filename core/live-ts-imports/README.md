# @arcmantle/live-ts-imports

> Opinionated TypeScript live compiler of client-side files with hot module reloading

A powerful development tool that enables live server-side TypeScript compilation without a build step, featuring automatic import map generation, dependency symlinking, and hot module reloading for rapid development workflows.

## Features

- 🔥 **Live TypeScript Compilation**: Transpiles TypeScript files on the server when requested
- 🔄 **Hot Module Reloading**: Automatic browser refresh when files change
- 📦 **Import Map Generation**: Automatically creates browser-compatible import maps for dependencies
- 🔗 **Smart Dependency Resolution**: Creates symlinks for npm packages with proper export mapping
- 🚀 **Zero Build Step**: Serve TypeScript as JavaScript without pre-compilation
- 🎯 **Express Integration**: Seamlessly integrates with Express.js applications
- 🔍 **Package Export Parsing**: Intelligently handles complex package.json export configurations

## Installation

```bash
npm install @arcmantle/live-ts-imports
```

```bash
pnpm add @arcmantle/live-ts-imports
```

```bash
yarn add @arcmantle/live-ts-imports
```

**Peer Dependencies:**

- `express ^4.19.2`

## Quick Start

```typescript
import express from 'express';
import { createServer } from 'http';
import { liveTsImports } from '@arcmantle/live-ts-imports';

const app = express();
const server = createServer(app);

// Configure live TypeScript imports
const { wss } = liveTsImports({
  importMeta: import.meta,
  server,
  app,
  packages: ['lit', '@types/node'], // npm packages to make available
  client: [{ path: '/', dir: 'client' }], // client directories to serve
  dev: true
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Configuration

### `LiveTsImportsConfig`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `importMeta` | `ImportMeta` | **required** | Import meta object for resolving paths |
| `server` | `HTTPServer \| HTTPSServer` | **required** | HTTP server instance |
| `app` | `express.Express` | **required** | Express application instance |
| `packages` | `string[]` | **required** | Array of npm package names to expose to client |
| `client` | `Array<{path: string, dir: string}>` | `[{path: '/', dir: 'client'}]` | Client directories to serve |
| `vendorDir` | `string` | `'_vendor'` | Directory name for package symlinks |
| `clientPath` | `string` | - | Custom client path override |
| `vendorPath` | `string` | `'/vendor'` | URL path for vendor packages |
| `dev` | `boolean` | `true` | Enable development features (HMR, file watching) |

## How It Works

### 1. TypeScript Compilation

- Intercepts `.ts` file requests and transpiles them server-side on demand
- Uses Node.js TypeScript compiler with optimized settings for modern browsers
- Caches compiled output for performance
- Serves transpiled JavaScript with correct MIME types to the browser

### 2. Import Map Generation

- Analyzes package.json exports of specified dependencies
- Creates browser-compatible import maps
- Handles complex export configurations and conditional exports
- Maps bare imports to vendor URLs (e.g., `'lit'` → `'/vendor/lit/index.js'`)

### 3. Dependency Management

- Creates symlinks in the vendor directory for each package
- Resolves package dependencies and their exports
- Handles scoped packages by converting `/` to `-` in paths
- Automatically includes `tslib` for TypeScript helper functions

### 4. Hot Module Reloading

- Sets up WebSocket server for real-time communication
- Watches client directories for file changes
- Automatically refreshes browser when files are modified
- Injects HMR client script into HTML pages

## Example Project Structure

```bash
project/
├── server.js           # Express server with live-ts-imports
├── client/            # Client-side TypeScript files
│   ├── index.html
│   ├── main.ts
│   └── components/
│       └── my-element.ts
└── node_modules/
    └── _vendor/       # Generated symlinks (auto-created)
        ├── lit/
        ├── tslib/
        └── client-shims/
```

## Generated Import Map Example

When you specify packages like `['lit', '@types/node']`, the tool generates an import map:

```json
{
  "imports": {
    "lit":        "/vendor/lit/index.js",
    "lit/":       "/vendor/lit/",
    "tslib":      "/vendor/tslib/tslib.es6.mjs",
    "tslib/":     "/vendor/tslib/"
  }
}
```

This allows you to use standard imports in your TypeScript:

```typescript
// client/main.ts
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('my-element')
export class MyElement extends LitElement {
  render() {
    return html`<h1>Hello from TypeScript!</h1>`;
  }
}
```

## Development vs Production

This tool is designed for **development only**. In production:

- Use a proper build tool (Vite, Webpack, etc.) to bundle your code
- Pre-compile TypeScript to JavaScript
- Use CDNs or bundled dependencies instead of symlinks
- Disable the `dev` flag or use a separate production configuration

## Advanced Usage

### Multiple Client Directories

```typescript
liveTsImports({
  importMeta: import.meta,
  server,
  app,
  packages: ['lit'],
  client: [
    { path: '/', dir: 'public' },
    { path: '/admin', dir: 'admin-client' },
    { path: '/api-docs', dir: 'docs' }
  ]
});
```

### Custom Vendor Configuration

```typescript
liveTsImports({
  importMeta: import.meta,
  server,
  app,
  packages: ['lit', 'rxjs'],
  vendorDir: 'custom-vendor',  // Creates node_modules/custom-vendor/
  vendorPath: '/deps',         // Serves at /deps instead of /vendor
});
```

## TypeScript Configuration

The tool uses these TypeScript compiler options:

```typescript
{
  target: "ESNext",
  module: "ESNext",
  moduleResolution: "Bundler",
  importHelpers: true,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  useDefineForClassFields: false
}
```

## Limitations

- Development tool only - not suitable for production
- Requires modern browsers with ES modules support
- No code splitting or optimization
- Limited to TypeScript transpilation (no bundling)
- Windows symlink creation may require elevated permissions

## Contributing

Project is not ready for contribution, experimental mode.

## License

Apache-2.0 License.
