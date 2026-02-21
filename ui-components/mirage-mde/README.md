# Mirage-MDE

A modern, feature-rich Markdown editor built on top of CodeMirror 6 and Lit Element. Mirage-MDE provides a complete markdown editing experience with live preview, syntax highlighting, and extensive customization options.

## Features

### Editor Features

- **CodeMirror 6** based editing with syntax highlighting
- **Live Preview** with side-by-side or fullscreen modes
- **Toolbar** with common markdown formatting actions
- **Status Bar** with cursor position, word count, and line count
- **Keyboard Shortcuts** for all major operations
- **Autosave** functionality with configurable intervals
- **Image Upload** support with drag & drop
- **Fullscreen Mode** for distraction-free editing

### Markdown Support

- **GitHub Flavored Markdown** (GFM)
- **Extended Tables** with advanced formatting
- **Syntax Highlighting** for code blocks
- **Task Lists** with checkboxes
- **Heading IDs** for anchor links
- **Link Mangling** for security
- **Custom Preprocessors** for content transformation

### Customization

- **Theming** with CSS custom properties
- **Custom Toolbar** actions and buttons
- **Custom Status Bar** items
- **Plugin System** for extensions
- **Configurable Options** for all behaviors

## Installation

```bash
npm install @arcmantle/mirage-mde

pnpm add @arcmantle/mirage-mde

yarn add @arcmantle/mirage-mde
```

## Basic Usage

### HTML

```html
<mirage-mde value="# Hello World"></mirage-mde>
```

### TypeScript

```typescript
import '@arcmantle/mirage-mde';

const editor = document.querySelector('mirage-mde');
editor.value = '# Hello World\n\nThis is **bold** text.';
```

### With Options

```typescript
const editor = document.querySelector('mirage-mde');
editor.options = {
  lineNumbers: true,
  lineWrapping: true,
  autosave: {
    enabled: true,
    uniqueId: 'my-editor',
    delay: 1000
  },
  uploadImage: true,
  toolbar: ['bold', 'italic', 'heading', '|', 'quote', 'code', 'link']
};
```

## Configuration Options

### Basic Options

- `lineNumbers` (boolean): Show line numbers in editor
- `lineWrapping` (boolean): Enable line wrapping
- `tabSize` (number): Tab size in spaces (default: 3)
- `placeholder` (string): Placeholder text for empty editor
- `autofocus` (boolean): Focus editor on load
- `direction` ('ltr' | 'rtl'): Text direction

### Rendering Options

- `singleLineBreaks` (boolean): Convert single line breaks to `<br>`
- `codeSyntaxHighlighting` (boolean): Enable syntax highlighting in code blocks
- `sanitizerFunction` (function): Custom HTML sanitizer
- `previewRender` (function): Custom preview renderer

### Toolbar Configuration

```typescript
toolbar: [
  'bold', 'italic', 'strikethrough', '|',
  'heading', 'heading-smaller', 'heading-bigger', '|',
  'code', 'quote', 'unordered-list', 'ordered-list', '|',
  'link', 'image', 'table', 'horizontal-rule', '|',
  'preview', 'side-by-side', 'fullscreen', '|',
  'guide'
]
```

### Status Bar Configuration

```typescript
statusbar: [
  'autosave', 'lines', 'words', 'cursor'
]
```

### Image Upload

```typescript
uploadImage: true,
imageMaxSize: 2097152, // 2MB
imageAccept: 'image/png, image/jpeg, image/gif, image/avif',
imageUploadFunction: (file, onSuccess, onError) => {
  // Custom upload logic
  uploadToServer(file)
    .then(url => onSuccess(url))
    .catch(error => onError(error.message));
}
```

### Autosave

```typescript
autosave: {
  enabled: true,
  uniqueId: 'my-editor-content',
  delay: 1000,
  submit_delay: 5000,
  text: 'Autosaved: ',
  timeFormat: {
    locale: 'en-US',
    format: {
      hour: '2-digit',
      minute: '2-digit'
    }
  }
}
```

## API Reference

### MirageMDEElement

#### Properties

- `value: string` - The markdown content
- `options: Options` - Editor configuration

#### Methods

- `editor.value()` - Get current content
- `editor.value(content)` - Set content
- `editor.action(actionName)` - Execute toolbar action

### Events

- `change` - Fired when content changes

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Bold | `Ctrl+B` |
| Italic | `Ctrl+I` |
| Link | `Ctrl+K` |
| Image | `Ctrl+Alt+I` |
| Code Block | `Ctrl+Alt+C` |
| Quote | `Ctrl+'` |
| Unordered List | `Ctrl+L` |
| Ordered List | `Ctrl+Alt+L` |
| Heading | `Ctrl+H` |
| Horizontal Rule | `Ctrl+R` |
| Preview | `Ctrl+P` |
| Side by Side | `F9` |
| Fullscreen | `F11` |
| Table | `Ctrl+Alt+T` |
| Toggle Checkbox | `Ctrl+D` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |

## Theming

Mirage-MDE supports extensive theming through CSS custom properties:

```css
mirage-mde {
  --mmde-border: 2px solid #333;
  --mmde-color: #fff;
  --mmde-background-color: #1a1a1a;
  --mmde-toolbar-bg: #2d2d2d;
  --mmde-editor-bg: #1e1e1e;
  --mmde-editor-family: 'Fira Code', monospace;
  --mmde-preview-family: 'Georgia', serif;
}
```

## Advanced Usage

### Custom Toolbar Actions

```typescript
const customAction = {
  name: 'my-action',
  type: 'button',
  title: 'My Custom Action',
  iconUrl: 'path/to/icon.svg',
  action: (view, scope) => {
    // Custom action logic
    const selection = view.state.selection.main;
    const text = view.state.doc.sliceString(selection.from, selection.to);
    // Transform text and update editor
  }
};

editor.options = {
  toolbar: ['bold', 'italic', 'my-action'],
  toolbarActions: [customAction]
};
```

### Custom Status Bar Items

```typescript
const customStatus = {
  name: 'my-status',
  template: (item) => `<div>Custom: ${item.value}</div>`,
  onUpdate: (item, update) => {
    item.value = 'some value';
  }
};

editor.options = {
  statusbar: ['lines', 'words', 'my-status'],
  statusbarStatuses: [customStatus]
};
```

### Custom Preprocessors

```typescript
editor.options = {
  renderingConfig: {
    preprocessor: [
      {
        regexp: /\{\{([^}]+)\}\}/g,
        replacer: (match, content) => {
          // Transform template syntax
          return `<span class="template">${content}</span>`;
        }
      }
    ]
  }
};
```

## Dependencies

- **@codemirror/\*** - Core editing functionality
- **marked** - Markdown parsing and rendering
- **highlight.js** - Code syntax highlighting
- **lit** - Web components framework

## Browser Support

- Chrome/Edge 88+
- Firefox 84+
- Safari 14+

## License

Apache-2.0

## Contributing

This is part of the Arcmantle Weave component library. Please refer to the main repository for contribution guidelines.
