# @arcmantle/vite-plugin-sass

A Vite plugin that transforms SASS/SCSS code in tagged template literals and enables importing SASS/SCSS files with proper type assertions.

## Features

- 🎨 **Tagged Template Literals**: Transform `sass` and `scss` tagged template literals into compiled CSS
- 📁 **File Imports**: Import `.scss` and `.sass` files with `with { type: 'scss' }` syntax
- ⚡ **Lightning Fast**: Uses LightningCSS for minification and optimization
- 🔧 **Configurable**: Customizable options for minification, root directory, and debug levels
- 🧩 **Framework Agnostic**: Works with any JavaScript/TypeScript project using Vite
- 📦 **Virtual Modules**: Efficiently handles SASS imports as virtual modules

## Installation

```bash
npm install @arcmantle/vite-plugin-sass
# or
pnpm add @arcmantle/vite-plugin-sass
# or
yarn add @arcmantle/vite-plugin-sass
```

## Usage

### Basic Setup

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { sassTransformer } from '@arcmantle/vite-plugin-sass';

export default defineConfig({
  plugins: [
    sassTransformer({
      rootDir: './src/styles', // Optional: Root directory for SASS imports
      minify: true,            // Optional: Enable CSS minification (default: true)
      debugLevel: 'silent',    // Optional: Debug level ('silent' | 'error')
    }),
  ],
});
```

### Tagged Template Literals

Use `sass` or `scss` tagged template literals in your TypeScript/JavaScript files:

```typescript
import { css, LitElement } from 'lit';

const styles = sass`
  $primary-color: #007bff;
  $font-size: 16px;

  .button {
    background-color: $primary-color;
    font-size: $font-size;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;

    &:hover {
      background-color: darken($primary-color, 10%);
    }
  }
`;

class MyElement extends LitElement {
  static styles = [styles];
  // ... rest of your component
}
```

### File Imports

Import SASS/SCSS files using the `with { type: 'scss' }` syntax:

```typescript
// Import a SCSS file
import styles from './styles.scss' with { type: 'scss' };

// The imported styles will be a CSSStyleSheet object
document.adoptedStyleSheets = [styles];
```

**styles.scss:**

```scss
$primary-color: #333;

body {
  font-family: Arial, sans-serif;
  color: $primary-color;
}
```

### With Lit Elements

Perfect for use with Lit components:

```typescript
import { LitElement, html, css as sass } from 'lit';
import { customElement } from 'lit/decorators.js';
import globalStyles from './global.scss' with { type: 'scss' };

@customElement('my-component')
export class MyComponent extends LitElement {
  static styles = [
    globalStyles,  // Imported SCSS file
    sass`          // Inline SASS
      @use 'variables';

      :host {
        display: block;
        padding: variables.$base-padding;
      }

      .content {
        background: variables.$background-color;
        border-radius: 8px;
      }
    `,
  ];

  render() {
    return html`<div class="content">Hello World!</div>`;
  }
}
```

## Configuration Options

### `SASSTransformerOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minify` | `boolean` | `true` | Enable CSS minification using LightningCSS |
| `rootDir` | `string` | `''` | Root directory for resolving SASS imports |
| `debugLevel` | `'error' \| 'silent'` | `'silent'` | Debug output level |

## How It Works

1. **Detection**: The plugin scans TypeScript/JavaScript files for `sass` or `scss` tagged template literals
2. **Compilation**: SASS code is compiled using the official Dart Sass compiler
3. **Minification**: Compiled CSS is minified using LightningCSS (if enabled)
4. **Transformation**: The tagged template literal is replaced with the compiled CSS string
5. **Virtual Modules**: SASS file imports are handled as virtual modules, creating `CSSStyleSheet` objects

## Supported File Types

### Source Files (for transformation)

- `.ts` - TypeScript files
- `.mts` - TypeScript modules
- `.js` - JavaScript files
- `.mjs` - JavaScript modules

### SASS Files (for imports)

- `.scss` - SASS files with CSS-like syntax
- `.sass` - SASS files with indented syntax

## Example Project Structure

```text
src/
├── styles/
│   ├── _variables.scss
│   ├── _mixins.scss
│   └── base.scss
├── components/
│   ├── button.ts
│   └── card.ts
└── main.ts
```

## Requirements

- Node.js >= 22
- Vite >= 7.0.0

## Dependencies

- **sass**: Official Dart Sass compiler for SASS compilation
- **lightningcss**: Fast CSS transformer and minifier
- **magic-string**: Efficient string manipulation with source maps
- **oxc-walker**: Fast JavaScript/TypeScript AST walker

## License

Apache-2.0

## Contributing

This package is part of the Arcmantle Weave monorepo. Contributions are welcome!
