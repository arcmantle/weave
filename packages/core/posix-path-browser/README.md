# @arcmantle/posix-path-browser

[![npm version](https://badge.fury.io/js/@arcmantle%2Fposix-path-browser.svg)](https://badge.fury.io/js/@arcmantle%2Fposix-path-browser)
[![JSR](https://jsr.io/badges/@arcmantle/posix-path-browser)](https://jsr.io/@arcmantle/posix-path-browser)

A browser-friendly implementation of Node.js's POSIX path utilities. This package provides the same API and methods as the standard Node.js `path.posix` module, but optimized for browser environments without any Node.js dependencies.

## Features

- 🌐 **Browser Compatible**: No Node.js dependencies, works in all modern browsers
- 📦 **Zero Dependencies**: Lightweight implementation with no external dependencies
- 🔄 **Drop-in Replacement**: Same API as Node.js `path.posix` module
- 🎯 **TypeScript Support**: Full TypeScript definitions included
- ⚡ **Lightweight**: Minimal bundle size impact
- 🧪 **Well Tested**: Based on Node.js's battle-tested path implementation

## Installation

### deno

```bash
deno add jsr:@arcmantle/posix-path-browser
```

### pnpm 10.9+

```bash
pnpm add jsr:@arcmantle/posix-path-browser
```

### yarn 4.9+

```bash
yarn add jsr:@arcmantle/posix-path-browser
```

## Usage

```typescript
import {
  join,
  resolve,
  normalize,
  dirname,
  basename,
  extname,
  relative,
  isAbsolute,
  parse,
  format,
  sep,
  delimiter
} from '@arcmantle/posix-path-browser';

// Join paths
const fullPath = join('home', 'user', 'documents', 'file.txt');
// → 'home/user/documents/file.txt'

// Resolve to absolute path
const absolutePath = resolve('/home/user', '../admin', 'config.json');
// → '/home/admin/config.json'

// Normalize path
const normalized = normalize('/home/user/../user/./documents//file.txt');
// → '/home/user/documents/file.txt'

// Get directory name
const dir = dirname('/home/user/documents/file.txt');
// → '/home/user/documents'

// Get file name
const filename = basename('/home/user/documents/file.txt');
// → 'file.txt'

// Get file extension
const ext = extname('/home/user/documents/file.txt');
// → '.txt'

// Get relative path
const rel = relative('/home/user', '/home/user/documents/file.txt');
// → 'documents/file.txt'

// Check if path is absolute
const isAbs = isAbsolute('/home/user');
// → true

// Parse path into components
const parsed = parse('/home/user/documents/file.txt');
// → {
//     root: '/',
//     dir: '/home/user/documents',
//     base: 'file.txt',
//     ext: '.txt',
//     name: 'file'
//   }

// Format path from components
const formatted = format({
  dir: '/home/user/documents',
  name: 'file',
  ext: '.txt'
});
// → '/home/user/documents/file.txt'
```

## API Reference

### Methods

#### `resolve(...paths: string[]): string`

Resolves a sequence of paths or path segments into an absolute path.

#### `normalize(path: string): string`

Normalizes a path, resolving `'..'` and `'.'` segments.

#### `isAbsolute(path: string): boolean`

Determines whether the path is an absolute path.

#### `join(...paths: string[]): string`

Joins all given path segments together using the platform separator as a delimiter, then normalizes the resulting path.

#### `relative(from: string, to: string): string`

Returns the relative path from `from` to `to`.

#### `dirname(path: string): string`

Returns the directory name of a path.

#### `basename(path: string, suffix?: string): string`

Returns the last portion of a path, optionally removing a given suffix.

#### `extname(path: string): string`

Returns the extension of the path, from the last `'.'` to end of string.

#### `parse(path: string): ParsedPath`

Returns an object with properties representing significant elements of the path.

#### `format(pathObject: FormatInputPathObject): string`

Returns a path string from an object - the opposite of `parse()`.

### Constants

#### `sep: string`

The platform-specific file separator: `'/'`

#### `delimiter: string`

The platform-specific path delimiter: `':'`

### Types

```typescript
interface ParsedPath {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
}

interface FormatInputPathObject {
  dir?: string;
  root?: string;
  base?: string;
  name?: string;
  ext?: string;
}
```

## Why Use This Package?

### Browser Compatibility

The standard Node.js `path` module is not available in browsers. This package provides the same functionality without requiring Node.js polyfills or bundler configuration.

### Consistent POSIX Behavior

Always uses POSIX path conventions (forward slashes) regardless of the platform, making it perfect for web applications that work with URLs or need consistent path handling.

### Lightweight Alternative

Unlike full Node.js polyfills, this package only includes the path utilities you need, keeping your bundle size minimal.

## Browser Support

This package works in all modern browsers that support ES2015+ features:

- Chrome 51+
- Firefox 54+
- Safari 10+
- Edge 15+

## License

Apache-2.0

Original Node.js implementation:
Copyright Joyent, Inc. and other Node contributors.

## Contributing

Issues and pull requests are welcome! Please ensure any contributions maintain compatibility with the Node.js `path.posix` API.
