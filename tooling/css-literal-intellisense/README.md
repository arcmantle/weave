# CSS Literal IntelliSense

VS Code extension providing CSS IntelliSense inside tagged template literals and comment-annotated template literals in TypeScript/JavaScript files.

## Features

- **Syntax Highlighting** — Embedded CSS highlighting in `css` tagged templates and `/*css*/`-annotated template literals via TextMate injection grammar
- **Completions** — Full CSS property, value, and selector completions powered by `vscode-css-languageservice`
- **Hover** — CSS documentation on hover for properties, values, selectors, and at-rules
- **Diagnostics** — Real-time CSS validation with errors/warnings mapped back to source positions
- **Interpolation Support** — Template literal interpolations are replaced with CSS-parseable placeholders; diagnostics overlapping placeholders are automatically suppressed

## Supported Patterns

### Tagged templates (tag name `css` by default)

```ts
import { css } from 'lit';

const styles = css`
  :host { display: block; color: red; }
`;
```

### Comment-annotated template literals

```ts
const styles = /*css*/ `
  :host { display: block; }
`;

// Also supported:
const a = /** css */ `...`;
const b = /**? css */ `...`;
```

## Configuration

| Setting | Default | Description |
|---|---|---|
| `cssLiteralIntellisense.tagNames` | `["css"]` | Tag function names to treat as CSS template literals |
| `cssLiteralIntellisense.commentMarkers` | `["css"]` | Comment markers that indicate a following template literal contains CSS |
| `cssLiteralIntellisense.validate` | `true` | Enable/disable CSS diagnostics |

## Supported File Types

`.ts`, `.js`, `.tsx`, `.jsx`

## Development

```sh
pnpm install
pnpm run compile   # type-check + bundle
pnpm run test      # run unit tests
pnpm run package   # build .vsix
```

## Architecture

- **css-region-detector** — TypeScript AST-based detection of CSS regions (tagged templates + comment-annotated literals)
- **offset-mapping** — Pure bidirectional offset mapping between source and virtual CSS documents
- **virtual-document** — VS Code-aware position/range mapping built on offset-mapping
- **css-service** — Bridge to `vscode-css-languageservice` for completions, hover, and diagnostics
- **document-cache** — Per-document version-keyed cache for detected CSS regions
- **completion-provider / hover-provider / diagnostics-manager** — VS Code language feature providers
- **syntaxes/css-tagged-template.json** — TextMate injection grammar for embedded CSS highlighting
