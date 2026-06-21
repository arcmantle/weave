# @arcmantle/ts-asset-goto-plugin

A TypeScript Language Service plugin that fixes **Go to Definition** and **hover**
for asset imports.

Imports such as:

```ts
import styles from './foo.cmp.css' with { type: 'css' };
```

are typed by an ambient wildcard module (`declare module '*.css'`). As a result,
"Go to Definition" lands on that useless wildcard declaration, and hover shows a
bare `import styles` with no type.

This plugin intercepts the language service so that:

- **Go to Definition** on the import binding (or any later usage of it) jumps to
  the real file on disk.
- **Hover** surfaces the real resolved type (e.g. `CSSStyleSheet` for css,
  `string` for svg).

It applies to relative and aliased imports (resolved via tsconfig
`paths`/`baseUrl`) ending in any of:
`css`, `scss`, `sass`, `less`, `styl`, `svg`, `html`/`htm`, `md`, `txt`,
`json`/`json5`, `yaml`/`yml`, `graphql`/`gql`, `wasm`.

## Usage

Add it to the `plugins` array of your `tsconfig.json`:

```json
{
	"compilerOptions": {
		"plugins": [
			{ "name": "@arcmantle/ts-asset-goto-plugin" }
		]
	}
}
```

### Adding extra extensions

The built-in list can be extended with an `extensions` array (a leading dot is
optional). These are added on top of the defaults:

```json
{
	"compilerOptions": {
		"plugins": [
			{
				"name": "@arcmantle/ts-asset-goto-plugin",
				"extensions": ["vert", "frag", ".glsl"]
			}
		]
	}
}
```

Then make sure your editor uses the **workspace** TypeScript version so the
plugin is loaded (in VS Code: "TypeScript: Select TypeScript Version" → "Use
Workspace Version").

## Typing the imports

This plugin only fixes **Go to Definition** and **hover** — it does not make the
import type-check. For that you still need an ambient `declare module` so
TypeScript (and `tsc`) accept the import. For CSS imports used with import
attributes the package ships one you can opt into instead of hand-writing it.

Add it to the `types` field of your `tsconfig.json`:

```json
{
	"compilerOptions": {
		"types": ["@arcmantle/ts-asset-goto-plugin/css"]
	}
}
```

```ts
import styles from './foo.cmp.css' with { type: 'css' }; // typed as CSSStyleSheet
```

Alternatively reference it from a single file with
`/// <reference types="@arcmantle/ts-asset-goto-plugin/css" />`, or add the
`css.d.ts` to your tsconfig `include`.

`CSSStyleSheet` comes from the DOM lib, so your `lib` must include `"DOM"`, and
you should not also declare `*.css` yourself (a single ambient declaration
wins). Note that adding a `types` array disables TypeScript's automatic
inclusion of other ambient packages, so list any you still rely on. Other asset
kinds (svg, json, ...) still need their own `declare module` to type-check.

