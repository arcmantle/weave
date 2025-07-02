# @arcmantle/vite-plugin-minify-css-literal

A Vite plugin that minifies CSS template literals in your TypeScript and JavaScript files, perfect for projects using Lit elements or other libraries that use tagged template literals for CSS.

## Features

- 🔥 **Fast CSS minification** using [Lightning CSS](https://lightningcss.dev/)
- 🎯 **Targeted processing** - only processes files containing CSS template literals
- 📦 **Zero runtime overhead** - minification happens at build time
- 🔍 **Smart detection** - automatically finds and processes `css` tagged template literals
- 📊 **Build statistics** - reports minification savings after build
- 🛠️ **TypeScript support** - full TypeScript and decorator support
- 🎛️ **Configurable** - customizable debug levels and error handling

## Installation

```bash
npm install @arcmantle/vite-plugin-minify-css-literal
```

```bash
pnpm add @arcmantle/vite-plugin-minify-css-literal
```

```bash
yarn add @arcmantle/vite-plugin-minify-css-literal
```

## Usage

### Basic Setup

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { minifyCssLiteral } from '@arcmantle/vite-plugin-minify-css-literal';

export default defineConfig({
  plugins: [
    minifyCssLiteral(),
    // ... other plugins
  ],
});
```

### With Options

```typescript
import { defineConfig } from 'vite';
import { minifyCssLiteral } from '@arcmantle/vite-plugin-minify-css-literal';

export default defineConfig({
  plugins: [
    minifyCssLiteral('error'), // Enable error logging
    // ... other plugins
  ],
});
```

## What It Does

The plugin automatically detects and minifies CSS content within tagged template literals:

### Before Minification

```typescript
import { css, LitElement } from 'lit';

class MyElement extends LitElement {
  static styles = css`
    /* Box sizing rules */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    /* Set core body defaults */
    body {
      min-height: 100vh;
      line-height: 1.5;
    }
  `;
}
```

### After Minification

```typescript
import { css, LitElement } from 'lit';

class MyElement extends LitElement {
  static styles = css`*,*::before,*::after{box-sizing:border-box}body{min-height:100vh;line-height:1.5}`;
}
```

## API

### `minifyCssLiteral(debugLevel?)`

#### Parameters

- **`debugLevel`** (optional): `'error' | 'silent'`
  - `'silent'` (default): Suppresses error messages
  - `'error'`: Shows error messages when CSS minification fails

#### Returns

A Vite plugin object.

### `minifyCssAssets(dir?)`

An additional plugin for minifying CSS asset files in the build output.

#### Parameters for minifyCssAssets

- **`dir`** (optional): `string`
  - Custom directory to search for CSS files (defaults to `config.build.outDir`)

#### Example Usage

```typescript
import { defineConfig } from 'vite';
import { minifyCssLiteral, minifyCssAssets } from '@arcmantle/vite-plugin-minify-css-literal';

export default defineConfig({
  plugins: [
    minifyCssLiteral(),
    minifyCssAssets(), // Minifies CSS files in build output
  ],
});
```

## How It Works

1. **File Detection**: The plugin scans TypeScript and JavaScript files (`.ts`, `.js`) for the presence of CSS template literals
2. **AST Parsing**: Uses Babel parser to create an Abstract Syntax Tree of your code
3. **Template Literal Detection**: Traverses the AST to find tagged template expressions using the `css` identifier
4. **CSS Minification**: Processes each CSS template literal with Lightning CSS minifier
5. **Code Transformation**: Replaces the original CSS with the minified version using MagicString
6. **Source Maps**: Generates accurate source maps for debugging

## Build Output

After a successful build, you'll see statistics about the minification:

```text
@arcmantle/vite-plugin-minify-css-literal
Minified css literals by 1247 characters.
Before minify: 2156.
After minify: 909
```

## Supported Syntax

The plugin supports:

- ✅ Tagged template literals with `css` identifier
- ✅ TypeScript and JavaScript files
- ✅ ES6 modules and imports
- ✅ Decorators (legacy syntax)
- ✅ Import attributes
- ✅ Nested template expressions

## Development Mode

The plugin automatically skips processing in development mode to maintain fast build times and preserve readable CSS for debugging.

## Requirements

- Node.js >= 22
- Vite >= 7.0.0
- TypeScript support for TypeScript projects

## Dependencies

- **@babel/parser**: JavaScript/TypeScript parsing for AST generation
- **@babel/traverse**: AST traversal for finding tagged template literals
- **@babel/types**: TypeScript definitions for Babel AST nodes
- **lightningcss**: Fast CSS minification and optimization
- **magic-string**: Efficient string manipulation with source maps

## License

Apache-2.0

## Contributing

This package is part of the Arcmantle Weave monorepo. Contributions are welcome!
