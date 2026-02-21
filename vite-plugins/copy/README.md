# @arcmantle/vite-plugin-copy

A Vite plugin that copies files during the build process with advanced features like file transformation, renaming, and flattening.

## Features

- 🚀 **Fast & Efficient**: Uses globby for pattern matching and fs-extra for optimized file operations
- 🔄 **File Transformation**: Modify file contents during copy
- 📁 **Flexible Destination**: Copy to single or multiple destinations
- 🏷️ **File Renaming**: Rename files during copy with string or function-based renaming
- 📂 **Directory Flattening**: Option to flatten directory structure
- ⚡ **Copy Once Mode**: Perfect for watch mode to avoid redundant copying
- 🎯 **Configurable Hooks**: Choose when copying occurs during the build process
- 📊 **Verbose Logging**: Optional detailed logging of copy operations

## Installation

```bash
npm install @arcmantle/vite-plugin-copy
# or
pnpm add @arcmantle/vite-plugin-copy
# or
yarn add @arcmantle/vite-plugin-copy
```

## Usage

### Basic Usage

```javascript
import { viteCopy } from '@arcmantle/vite-plugin-copy';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    viteCopy({
      targets: [
        {
          from: 'src/assets/**/*',
          to: 'dist/assets'
        }
      ]
    })
  ]
});
```

### Advanced Usage

```javascript
import { viteCopy } from '@arcmantle/vite-plugin-copy';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    viteCopy({
      targets: [
        // Copy vendor styles
        {
          from: './node_modules/@arcmantle/elements/styles/*',
          to: './public/vendor/mimic-elements',
        },
        // Copy and rename files
        {
          from: 'src/config.json',
          to: 'dist/',
          rename: 'app-config.json'
        },
        // Copy to multiple destinations
        {
          from: 'src/shared/**/*',
          to: ['dist/client/shared', 'dist/server/shared']
        },
        // Transform file contents
        {
          from: 'src/template.html',
          to: 'dist/index.html',
          transform: (contents, filename) => {
            return contents.toString().replace('{{VERSION}}', process.env.npm_package_version);
          }
        }
      ],
      hook: 'config',
      copyOnce: true,
      verbose: true
    })
  ]
});
```

## API Reference

### `viteCopy(options)`

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `targets` | `Target[]` | `[]` | Array of copy targets |
| `copyOnce` | `boolean` | `false` | Copy items only once (useful in watch mode) |
| `hook` | `string` | `'buildEnd'` | Rollup hook to use ('config', 'buildEnd', or any valid hook) |
| `verbose` | `boolean` | `false` | Enable verbose logging |
| `flatten` | `boolean` | `true` | Remove base directory structure of copied files |

#### Target Configuration

| Option | Type | Description |
|--------|------|-------------|
| `from` | `string \| string[]` | Source path or glob pattern(s) |
| `to` | `string \| string[]` | Destination path(s) |
| `rename` | `string \| function` | New filename or function to generate filename |
| `transform` | `function` | Function to transform file contents (only works with files) |

### Transform Function

```javascript
transform: (contents, filename) => {
  // contents: Buffer - file contents
  // filename: string - original filename
  // return: any - transformed content
}
```

### Rename Function

```javascript
rename: (name, extension, fullPath) => {
  // name: string - filename without extension
  // extension: string - file extension without dot
  // fullPath: string - full source path
  // return: string - new filename
}
```

## Examples

### Copy Static Assets

```javascript
viteCopy({
  targets: [
    {
      from: 'src/assets/**/*',
      to: 'dist/assets'
    }
  ]
})
```

### Copy with Pattern Matching

```javascript
viteCopy({
  targets: [
    {
      from: ['src/**/*.json', 'src/**/*.xml'],
      to: 'dist/config'
    }
  ]
})
```

### Dynamic Renaming

```javascript
viteCopy({
  targets: [
    {
      from: 'src/locales/*.json',
      to: 'dist/i18n',
      rename: (name, ext, fullPath) => `${name}.locale.${ext}`
    }
  ]
})
```

### Environment-based Transformation

```javascript
viteCopy({
  targets: [
    {
      from: 'src/config.template.json',
      to: 'dist/config.json',
      transform: (contents) => {
        const config = JSON.parse(contents.toString());
        config.environment = process.env.NODE_ENV;
        config.buildTime = new Date().toISOString();
        return JSON.stringify(config, null, 2);
      }
    }
  ]
})
```

### Watch Mode Optimization

```javascript
viteCopy({
  targets: [
    {
      from: 'node_modules/large-library/dist/**/*',
      to: 'public/vendor/large-library'
    }
  ],
  copyOnce: true, // Only copy once in watch mode
  hook: 'config'  // Copy early in the build process
})
```

## Hook Timing

- **`config`**: Runs early during configuration setup
- **`buildEnd`**: Runs after the build is complete (default)
- Any valid Rollup hook name

## Globby Options

This plugin uses [globby](https://github.com/sindresorhus/globby) for file matching. You can pass any globby options in the target configuration:

```javascript
viteCopy({
  targets: [
    {
      from: 'src/**/*',
      to: 'dist/',
      ignore: ['**/*.test.js'],
      dot: true
    }
  ]
})
```

## Requirements

- Node.js >= 22
- Vite >= 7.0.0

## Dependencies

- **fs-extra**: Enhanced file system operations with promises
- **globby**: Fast glob matching for file pattern detection

## License

Apache-2.0

## Contributing

This package is part of the Arcmantle Weave monorepo. Contributions are welcome!
