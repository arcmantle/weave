# Mirage-MDE-Display

A standalone markdown display component built with Lit Element. This package provides a clean, styled HTML renderer for markdown content with GitHub-flavored theming and syntax highlighting support.

## Overview

Mirage-MDE-Display is the rendering component used by the Mirage-MDE editor for displaying formatted markdown content. It can be used independently as a markdown display component or as part of the larger Mirage-MDE ecosystem.

## Features

### Display Features

- **GitHub-Flavored Styling**: Authentic GitHub markdown appearance
- **Dual Theme Support**: Light and dark mode themes
- **Syntax Highlighting**: Code block highlighting with customizable styles
- **CSS Custom Properties**: Extensive theming capabilities
- **Responsive Design**: Mobile-friendly responsive layout
- **Semantic HTML**: Proper semantic markup for accessibility

### Supported Markdown Elements

- **Headings**: H1-H6 with GitHub-style anchor links
- **Text Formatting**: Bold, italic, strikethrough, code spans
- **Lists**: Ordered and unordered lists with nesting
- **Links**: External and internal links with hover states
- **Images**: Responsive images with alt text
- **Code Blocks**: Syntax highlighted code with language detection
- **Tables**: Full table support with striped rows
- **Blockquotes**: Styled quote blocks
- **Horizontal Rules**: Section dividers
- **Task Lists**: Interactive checkboxes
- **Footnotes**: Reference-style footnotes

## Installation

```bash
npm install @arcmantle/mirage-mde-display

pnpm add @arcmantle/mirage-mde-display

yarn add @arcmantle/mirage-mde-display
```

## Basic Usage

### HTML

```html
<mirage-mde-display
  theme="dark"
  content="<h1>Hello World</h1><p>This is <strong>bold</strong> text.</p>"
></mirage-mde-display>
```

### JavaScript/TypeScript

```typescript
import '@arcmantle/mirage-mde-display';

const display = document.querySelector('mirage-mde-display');
display.content = '<h1>Hello World</h1><p>This is <strong>bold</strong> text.</p>';
display.theme = 'dark';
```

### With Custom Styles

```typescript
const display = document.querySelector('mirage-mde-display');
display.content = '<h1>Styled Content</h1>';
display.styles = `
  .custom-highlight {
    background-color: yellow;
    padding: 2px 4px;
    border-radius: 3px;
  }
`;
```

## Properties

### `content` (string)

The HTML content to display. This should be properly sanitized HTML, typically generated from markdown.

```typescript
display.content = '<p>Hello <em>world</em>!</p>';
```

### `theme` ('light' | 'dark')

The theme mode for the display. Defaults to 'dark'.

```typescript
display.theme = 'light'; // or 'dark'
```

### `styles` (string)

Additional CSS styles to inject into the component.

```typescript
display.styles = `
  .markdown-body {
    font-size: 18px;
    line-height: 1.6;
  }
`;
```

## Theming

### CSS Custom Properties

The component uses CSS custom properties for extensive theming. All properties are prefixed with `--mmdp-` (Mirage Markdown Display Properties).

#### Basic Theming

```css
mirage-mde-display {
  --mmdp-body-color: #333;
  --mmdp-body-bg: #fff;
  --mmdp-preview-family: Georgia, serif;
  --mmdp-a-color: #0366d6;
}
```

#### Dark Theme Variables

```css
mirage-mde-display[theme="dark"] {
  --mmdp-body-color: #c9d1d9;
  --mmdp-body-bg: #0d1117;
  --mmdp-a-color: #58a6ff;
  --mmdp-blockquote-color: #8b949e;
  --mmdp-blockquote-border-left: 0.25em solid #30363d;
}
```

#### Light Theme Variables

```css
mirage-mde-display[theme="light"] {
  --mmdp-body-color: #24292f;
  --mmdp-body-bg: #ffffff;
  --mmdp-a-color: #0969da;
  --mmdp-blockquote-color: #57606a;
  --mmdp-blockquote-border-left: 0.25em solid #d0d7de;
}
```

#### Code Highlighting

```css
mirage-mde-display {
  --mmdp-hljs-color: #c9d1d9;
  --mmdp-hljs-bg: #161b22;
  --mmdp-hljs-comment: #768390;
  --mmdp-hljs-keyword: #f47067;
  --mmdp-hljs-string: #96d0ff;
  --mmdp-hljs-function: #dcbdfb;
}
```

## Advanced Usage

### Custom Styling

```typescript
const display = document.querySelector('mirage-mde-display');
display.styles = `
  .markdown-body h1 {
    color: #ff6b6b;
    border-bottom: 2px solid #ff6b6b;
  }

  .markdown-body code {
    background-color: rgba(255, 107, 107, 0.1);
    color: #ff6b6b;
  }

  .markdown-body pre {
    border-left: 4px solid #ff6b6b;
    background-color: #1a1a1a;
  }
`;
```

### Integration with Markdown Parser

```typescript
import { marked } from 'marked';

const markdownText = `
# Hello World

This is **bold** text and this is *italic* text.

\`\`\`javascript
console.log('Hello, world!');
\`\`\`
`;

const htmlContent = marked(markdownText);
display.content = htmlContent;
```

### Dynamic Theme Switching

```typescript
const display = document.querySelector('mirage-mde-display');
const themeToggle = document.querySelector('#theme-toggle');

themeToggle.addEventListener('click', () => {
  display.theme = display.theme === 'light' ? 'dark' : 'light';
});
```

## CSS Parts

The component exposes a `markdown-body` part for external styling:

```css
mirage-mde-display::part(markdown-body) {
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
```

## Integration with Mirage-MDE

This component is designed to work seamlessly with the Mirage-MDE editor:

```typescript
import { MirageMDE } from '@arcmantle/mirage-mde';

const editor = new MirageMDE({
  previewRender: async (markdown) => {
    // Your markdown to HTML conversion
    return convertMarkdownToHTML(markdown);
  }
});

// The preview component internally uses mirage-mde-display
```

## Available CSS Variables

### Typography

- `--mmdp-preview-family`: Font family for content
- `--mmdp-body-color`: Main text color
- `--mmdp-body-bg`: Background color

### Links

- `--mmdp-a-color`: Link color
- `--mmdp-octicon-link-color`: Anchor link icon color

### Headings

- `--mmdp-h1-bottom-border`: H1 bottom border
- `--mmdp-h2-bottom-border`: H2 bottom border
- `--mmdp-h6-color`: H6 specific color

### Code

- `--mmdp-codett-bg`: Inline code background
- `--mmdp-pre-bg`: Code block background
- `--mmdp-hljs-*`: Syntax highlighting colors

### Tables

- `--mmdp-table-thtd-border`: Table cell borders
- `--mmdp-table-tr-bg`: Table row background
- `--mmdp-table-tr-alternate-bg`: Alternating row background

### UI Elements

- `--mmdp-blockquote-color`: Blockquote text color
- `--mmdp-blockquote-border-left`: Blockquote left border
- `--mmdp-kbd-bg`: Keyboard key background
- `--mmdp-mark-bg`: Highlighted text background

## Browser Support

- Chrome/Edge 88+
- Firefox 84+
- Safari 14+

## Dependencies

- **lit**: Web components framework (^3.3.0)

## License

Apache-2.0

## Contributing

This is part of the Arcmantle Weave component library. Please refer to the main repository for contribution guidelines.
