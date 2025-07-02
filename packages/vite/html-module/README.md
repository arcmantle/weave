# @arcmantle/vite-plugin-html-module

A Vite plugin that enables importing HTML files as modules, supporting the [HTML Modules proposal](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/html-modules-explainer.md). Transform HTML files into JavaScript modules that export DOM nodes for use in your applications.

## Features

- 🏗️ **HTML Module Support**: Import HTML files directly as JavaScript modules
- 🔍 **Element ID Export**: Optionally export elements with IDs as named exports
- 📦 **TypeScript Support**: Includes TypeScript declarations for seamless integration
- ⚡ **Vite Integration**: Built specifically for Vite with hot reload support
- 🎯 **Standards-Based**: Follows the emerging HTML Modules web standard

## Installation

```bash
npm install @arcmantle/vite-plugin-html-module
# or
pnpm add @arcmantle/vite-plugin-html-module
# or
yarn add @arcmantle/vite-plugin-html-module
```

## Usage

### Basic Setup

Add the plugin to your `vite.config.ts`:

```typescript
import { htmlModules } from '@arcmantle/vite-plugin-html-module';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    htmlModules()
  ]
});
```

### TypeScript Configuration

Include the client types in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["@arcmantle/vite-plugin-html-module/client"]
  }
}
```

### Importing HTML Files

Import HTML files using the `with { type: 'html' }` syntax:

```typescript
import template from './template.html' with { type: 'html' };

// The default export is a Document object
console.log(template); // Document

// Use the document as needed
document.body.appendChild(template.body.firstElementChild);
```

### With Element ID Exports

Enable element ID exports in your configuration:

```typescript
import { htmlModules } from '@arcmantle/vite-plugin-html-module';

export default defineConfig({
  plugins: [
    htmlModules({ exportIds: true })
  ]
});
```

Given an HTML file like this:

```html
<!-- template.html -->
<div id="container">
  <h1 id="title">Hello World</h1>
  <button id="my-button">Click me</button>
</div>
```

You can import both the document and individual elements:

```typescript
import template, { container, title } from './template.html' with { type: 'html' };

// Access the full document
console.log(template); // Document

// Access individual elements by their IDs
console.log(container); // <div id="container">...</div>
console.log(title); // <h1 id="title">Hello World</h1>

// Elements with invalid JavaScript identifiers are exported with quotes
import template, { 'my-button': myButton } from './template.html' with { type: 'html' };
console.log(myButton); // <button id="my-button">Click me</button>
```

## Configuration Options

### `exportIds`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: When enabled, elements with `id` attributes are exported as named exports. Elements with valid JavaScript identifiers are exported directly, while others are exported with quoted names.

```typescript
htmlModules({
  exportIds: true  // Enable ID-based exports
})
```

## How It Works

1. **Detection**: The plugin detects imports of `.html` files that use the `with { type: 'html' }` import assertion
2. **Parsing**: HTML content is parsed using [parse5](https://github.com/inikulin/parse5) to extract element information
3. **Transformation**: The HTML is transformed into a JavaScript module that:
   - Creates a `DOMParser` instance
   - Parses the HTML string into a `Document`
   - Exports the document as the default export
   - Optionally exports individual elements by their IDs
4. **Type Safety**: TypeScript declarations ensure proper typing for imported HTML modules

## Browser Compatibility

This plugin transforms HTML modules at build time, so the generated code runs in any environment that supports:

- `DOMParser` API (all modern browsers)
- ES modules

## Requirements

- Node.js >= 22
- Vite >= 7.0.0

## Dependencies

- **parse5**: HTML parser for processing HTML files
- **@parse5/tools**: Additional tools for HTML parsing and manipulation

## License

Apache-2.0

## Contributing

This package is part of the Arcmantle Weave monorepo. Contributions are welcome!

---

**Note**: This plugin implements support for the HTML Modules proposal, which is still evolving. The syntax and behavior may change as the specification develops.
