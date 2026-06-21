/**
 * Ambient module declarations for CSS imports used with import attributes:
 *
 *     import styles from './foo.cmp.css' with { type: 'css' };
 *
 * A TypeScript language-service plugin (this package) cannot, on its own, make
 * such an import type-check — that still requires an ambient `declare module`.
 * This file provides it so you don't have to hand-write one. Opt in via your
 * tsconfig:
 *
 *     { "compilerOptions": { "types": ["@arcmantle/ts-asset-goto-plugin/css"] } }
 *
 * (or a `/// <reference types="@arcmantle/ts-asset-goto-plugin/css" />` in one
 * file, or by adding it to `include`). With the import typed, the plugin then
 * makes "Go to Definition" and hover point at the real `.css` file instead of
 * this wildcard declaration.
 *
 * Note: `CSSStyleSheet` comes from the DOM lib, so your tsconfig `lib` must
 * include `"DOM"`. If you already declare `*.css` yourself, use one or the
 * other to avoid a duplicate ambient module.
 */

declare module '*.css' {
	const sheet: CSSStyleSheet;
	export default sheet;
}
