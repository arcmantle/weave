# @arcmantle/vite-plugin-import-css-sheet

A Vite plugin that enables the use of [TC39 Import Attributes proposal](https://github.com/tc39/proposal-import-attributes) for CSS files. Import CSS files with `with { type: 'css' }` syntax and get them as `CSSStyleSheet` objects, perfect for Web Components and Shadow DOM.

## Features

- 🚀 **Import CSS as CSSStyleSheet**: Transform CSS imports into constructable stylesheets
- 🎯 **TC39 Standard Syntax**: Uses the official `with { type: 'css' }` syntax
- ⚡ **Vite Integration**: Seamless integration with Vite's build process
- 🗜️ **CSS Minification**: Built-in CSS minification using Lightning CSS
- 🔧 **Customizable**: Support for custom transformers and additional code injection
- 📦 **TypeScript Support**: Full TypeScript definitions included
- 🔍 **Development Friendly**: Watch mode support for CSS file changes

## Installation

```bash
npm install @arcmantle/vite-plugin-import-css-sheet
# or
pnpm add @arcmantle/vite-plugin-import-css-sheet
# or
yarn add @arcmantle/vite-plugin-import-css-sheet
```

## Usage

### Basic Setup

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { importCSSSheet } from '@arcmantle/vite-plugin-import-css-sheet';

export default defineConfig({
  plugins: [
    importCSSSheet()
  ]
});
```

### Import CSS as CSSStyleSheet

Use the TC39 import attributes syntax to import CSS files as `CSSStyleSheet` objects:

```typescript
// Import CSS as CSSStyleSheet
import styles from './component.css' with { type: 'css' };

// Use with Web Components
class MyComponent extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    // Apply the stylesheet to shadow DOM
    shadow.adoptedStyleSheets = [styles];

    shadow.innerHTML = `
      <div class="container">
        <h1>Hello World</h1>
      </div>
    `;
  }
}

customElements.define('my-component', MyComponent);
```

### Lit Integration

Perfect for Lit components:

```typescript
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import componentStyles from './component.css' with { type: 'css' };

@customElement('my-lit-component')
export class MyLitComponent extends LitElement {
  static styles = [componentStyles];

  render() {
    return html`
      <div class="container">
        <p>Styled with imported CSS sheet!</p>
      </div>
    `;
  }
}
```

### TypeScript Support

Include the provided type definitions in your project:

```typescript
// In your vite-env.d.ts or types file
/// <reference types="@arcmantle/vite-plugin-import-css-sheet/client" />
```

This provides proper TypeScript support for CSS imports:

```typescript
// TypeScript will know this is a CSSStyleSheet
import styles from './styles.css' with { type: 'css' };
```

## Configuration

The plugin accepts several configuration options:

```typescript
import { importCSSSheet } from '@arcmantle/vite-plugin-import-css-sheet';

export default defineConfig({
  plugins: [
    importCSSSheet({
      // Custom CSS transformers
      transformers: [
        (code, id) => {
          // Custom transformation logic
          return code.replace(/\$primary-color/g, '#007bff');
        }
      ],

      // Additional code to inject
      additionalCode: [
        'console.log("CSS sheet loaded:", sheet);'
      ],

      // Disable minification (enabled by default)
      minify: false
    })
  ]
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `transformers` | `((code: string, id: string) => string)[]` | `[]` | Array of functions to transform CSS before converting to stylesheet |
| `additionalCode` | `string[]` | `[]` | Additional JavaScript code to inject into the generated module |
| `minify` | `boolean` | `true` | Whether to minify CSS using Lightning CSS |

## How It Works

1. **Detection**: The plugin scans your source files for CSS imports using the `with { type: 'css' }` syntax
2. **Virtual Modules**: Creates virtual modules for CSS files that need to be converted
3. **Transformation**: Processes CSS through any custom transformers and minification
4. **Code Generation**: Generates JavaScript code that creates a `CSSStyleSheet` object
5. **Export**: Exports the stylesheet as the default export

## Browser Support

This plugin generates code that uses the [Constructable Stylesheets API](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet):

- Chrome/Edge 73+
- Firefox 101+
- Safari 16.4+

For older browsers, consider using a polyfill.

## Why Use This Plugin?

### Traditional CSS Imports

```typescript
// Traditional Vite CSS import (injects into document)
import './styles.css';
```

### With This Plugin

```typescript
// Get CSS as CSSStyleSheet object
import styles from './styles.css' with { type: 'css' };

// Perfect for Shadow DOM
shadowRoot.adoptedStyleSheets = [styles];
```

### Benefits

- **Encapsulation**: Styles don't leak into global scope
- **Performance**: No style injection/removal overhead
- **Standards Compliant**: Uses official TC39 syntax
- **Shadow DOM Ready**: Perfect for Web Components
- **Tree Shakable**: Only load styles when needed

## Examples

### Multiple Stylesheets

```typescript
import baseStyles from './base.css' with { type: 'css' };
import themeStyles from './theme.css' with { type: 'css' };
import componentStyles from './component.css' with { type: 'css' };

// Combine multiple stylesheets
element.shadowRoot.adoptedStyleSheets = [
  baseStyles,
  themeStyles,
  componentStyles
];
```

### Dynamic Style Loading

```typescript
// Conditional style loading
const isDark = document.body.classList.contains('dark-theme');
const themeStyles = isDark
  ? await import('./dark-theme.css' with { type: 'css' })
  : await import('./light-theme.css' with { type: 'css' });

shadowRoot.adoptedStyleSheets = [baseStyles, themeStyles.default];
```

## Development

```bash
# Install dependencies
pnpm install

# Run demo in development mode
pnpm dev

# Build the plugin
pnpm build
```

## Requirements

- Node.js >= 22
- Vite >= 7.0.0

## Dependencies

- **lightningcss**: Fast CSS transformer and minifier for CSS processing

## License

Apache-2.0

## Contributing

This package is part of the Arcmantle Weave monorepo. Contributions are welcome!

..
