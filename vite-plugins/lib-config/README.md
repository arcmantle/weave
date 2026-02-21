# @arcmantle/vite-lib-config

A comprehensive Vite configuration package optimized for building TypeScript libraries and component packages. Provides sensible defaults for modern library development with automatic entry point detection, smart externalization, and TypeScript support.

## Features

- 🚀 **Automatic Entry Detection**: Scans and includes all TypeScript/TSX files as entry points
- 📦 **Smart Externalization**: Automatically externalizes dependencies while allowing custom override logic
- 🎯 **Library Optimized**: Pre-configured for library builds with ES modules output
- 🔧 **TypeScript Ready**: Built-in support for experimental decorators and modern TypeScript features
- 📁 **Structure Preserving**: Maintains source folder structure in output with `preserveModules`
- ⚡ **Customizable**: Easy configuration override system with deep merging
- 🗂️ **Monorepo Friendly**: Perfect for component libraries and package-based monorepos

## Installation

```bash
npm install @arcmantle/vite-lib-config
# or
pnpm add @arcmantle/vite-lib-config
# or
yarn add @arcmantle/vite-lib-config
```

## Usage

### Basic Setup

Create a `vite.config.ts` in your library project:

```typescript
import { libConfig } from '@arcmantle/vite-lib-config';

export default libConfig();
```

That's it! The configuration will automatically:

- Find all `.ts` and `.tsx` files in `src/` as entry points
- Externalize all npm dependencies
- Set up TypeScript compilation with decorators support
- Configure source maps and ES module output
- Preserve your source folder structure

### Custom Configuration

You can override or extend the default configuration:

```typescript
import { libConfig } from '@arcmantle/vite-lib-config';

export default libConfig({
  // Add custom plugins
  plugins: [
    // Your custom plugins
    someVitePlugin()
  ],

  // Override build settings
  build: {
    outDir: 'lib', // Change output directory
    sourcemap: false, // Disable source maps
  },

  // Add esbuild options
  esbuild: {
    minifyIdentifiers: false,
  }
});
```

### Advanced Configuration with Options

```typescript
import { libConfig } from '@arcmantle/vite-lib-config';

export default libConfig(
  // Custom Vite config
  {
    plugins: [/* your plugins */],
  },
  // Configuration options
  {
    // Custom entry point patterns
    entry: {
      patterns: [
        './src/components/**/*.ts',
        './src/utils/**/*.ts',
        '!./src/**/*.test.ts' // Exclude test files
      ]
    },

    // Custom externalization logic
    externalImport: {
      // Custom filter function
      filter: (source, importer, isResolved) => {
        // Bundle specific packages instead of externalizing
        if (source === 'some-utility-lib') return false;

        // Force externalize specific packages
        if (source.startsWith('@internal/')) return true;

        // Use default logic for others
        return undefined;
      },

      // Custom externalization regex
      expression: /^(?!\.{0,2}\/|[A-Za-z]:[\\/]|https?:\/\/).*$/
    }
  }
);
```

### Functional Configuration

For dynamic configurations based on build environment:

```typescript
import { libConfig } from '@arcmantle/vite-lib-config';

export default libConfig(
  // Function receives ConfigEnv (command, mode, etc.)
  (env) => ({
    define: {
      __DEV__: env.mode === 'development'
    },
    plugins: env.mode === 'development' ? [devOnlyPlugin()] : []
  })
);
```

### Async Configuration

```typescript
import { libConfig } from '@arcmantle/vite-lib-config';

export default libConfig(
  async (env) => {
    const config = await loadSomeAsyncConfig();

    return {
      plugins: config.plugins,
      define: config.defines
    };
  }
);
```

## Configuration Options

### `ConfigOptions`

| Option | Type | Description |
|--------|------|-------------|
| `entry` | `object` | Entry point configuration |
| `entry.patterns` | `string[]` | Glob patterns for entry files (default: `['./src/**/*.ts', './src/**/*.tsx']`) |
| `externalImport` | `object` | External import configuration |
| `externalImport.filter` | `function` | Custom externalization filter function |
| `externalImport.expression` | `RegExp` | Regex for default externalization logic |

### Entry Patterns

By default, the configuration scans for:

- `./src/**/*.ts`
- `./src/**/*.tsx`

And excludes files matching:

- `*.test.ts` / `*.test.tsx`
- `*.demo.ts` / `*.demo.tsx`
- `*.types.ts` / `*.types.tsx`

### External Import Filter

The `filter` function receives:

- `source`: The import path/module name
- `importer`: The file doing the importing
- `isResolved`: Whether the import has been resolved

Return values:

- `true`: Force externalize this import
- `false`: Force bundle this import
- `undefined`: Use default externalization logic

## Default Configuration

The package provides these defaults:

```typescript
{
  publicDir: false, // No public directory for libraries

  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true
      }
    }
  },

  build: {
    outDir: 'dist',
    emptyOutDir: false, // Preserve type declarations
    sourcemap: true,
    lib: {
      entry: /* auto-detected files */,
      formats: ['es'] // ES modules only
    },
    rollupOptions: {
      external: /* smart externalization */,
      output: {
        preserveModules: true, // Keep folder structure
        preserveModulesRoot: 'src'
      }
    }
  }
}
```

## Examples

### Component Library

```typescript
// vite.config.ts
import { libConfig } from '@arcmantle/vite-lib-config';
import { componentAutoImporter } from '@arcmantle/vite-plugin-ce-auto-import';

export default libConfig({
  plugins: [
    componentAutoImporter({
      directories: [{ path: './src/components' }],
      prefixes: [/my-/]
    })
  ]
});
```

### Utility Library with Custom Entries

```typescript
import { libConfig } from '@arcmantle/vite-lib-config';

export default libConfig(
  {
    // Custom configuration
  },
  {
    entry: {
      patterns: [
        './src/index.ts', // Main entry
        './src/utils/*.ts', // Utility functions
        './src/types/*.ts' // Type definitions
      ]
    }
  }
);
```

### Library with Internal Dependencies

```typescript
import { libConfig } from '@arcmantle/vite-lib-config';

export default libConfig(
  {},
  {
    externalImport: {
      filter: (source) => {
        // Bundle all @internal packages
        if (source.startsWith('@internal/')) return false;

        // Bundle utility libraries
        if (['lodash-es', 'date-fns'].includes(source)) return false;

        // Use default logic for others
        return undefined;
      }
    }
  }
);
```

## TypeScript Support

The configuration is fully typed with TypeScript. It supports:

- **Experimental Decorators**: Enabled by default for modern framework compatibility
- **Preserve Modules**: Maintains your source structure for better tree-shaking
- **Source Maps**: Generated by default for debugging

## How It Works

1. **Entry Detection**: Scans source files using glob patterns
2. **Externalization**: Applies smart defaults with custom override support
3. **Configuration Merging**: Deep merges custom config with defaults using `deepmerge-ts`
4. **Build Optimization**: Configures Rollup for optimal library output

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run in a test project
pnpm link
cd ../your-library
pnpm link @arcmantle/vite-lib-config
```

## Requirements

- Node.js >= 22
- Vite >= 7.0.0

## Dependencies

- **deepmerge-ts**: Type-safe deep merging for configuration objects

## License

Apache-2.0

## Contributing

This package is part of the Arcmantle Weave monorepo. Contributions are welcome!
