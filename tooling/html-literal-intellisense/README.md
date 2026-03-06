# HTML Literal IntelliSense

VS Code extension providing HTML IntelliSense inside tagged template literals and comment-annotated template literals in TypeScript/JavaScript files.

## Features

- **Syntax Highlighting** — Embedded HTML highlighting in `html` tagged templates and `/*html*/`-annotated template literals via TextMate injection grammar
- **Completions** — Full HTML tag, attribute, and value completions powered by `vscode-html-languageservice`
- **Hover** — HTML documentation on hover for elements and attributes
- **Interpolation Support** — Template literal interpolations are replaced with HTML-parseable comment placeholders

## Supported Patterns

### Tagged templates (tag name `html` by default)

```ts
import { html } from 'lit';

const template = html`
  <div class="container">
    <h1>Hello world</h1>
  </div>
`;
```

### Comment-annotated template literals

```ts
const template = /*html*/ `
  <div>Hello world</div>
`;

// Also supported:
const a = /** html */ `...`;
const b = /**? html */ `...`;
```

## Configuration

| Setting | Default | Description |
|---|---|---|
| `htmlLiteralIntellisense.tagNames` | `["html"]` | Tag function names to treat as HTML template literals |
| `htmlLiteralIntellisense.commentMarkers` | `["html"]` | Comment markers that indicate a following template literal contains HTML |

## Supported File Types

`.ts`, `.js`, `.tsx`, `.jsx`

## Development

```bash
pnpm install
pnpm test
pnpm run compile
pnpm run package
```
