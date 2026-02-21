# @arcmantle/tsconfig

A TypeScript configuration package with convenient defaults for modern TypeScript development.

## 📦 Installation

```bash
npm install --save-dev @arcmantle/tsconfig
```

```bash
pnpm add -D @arcmantle/tsconfig
```

```bash
yarn add --dev @arcmantle/tsconfig
```

## 🚀 Usage

This package provides two TypeScript configurations:

### Development Configuration (Default)

Extend the development configuration in your `tsconfig.json`:

```json
{
  "extends": "@arcmantle/tsconfig"
}
```

### Build Configuration

For production builds, use the build configuration:

```json
{
  "extends": "@arcmantle/tsconfig/build"
}
```

## ⚙️ Configuration Details

### Development Config (`tsconfig.dev.json`)

The development configuration includes:

- **Modern TypeScript**: ESNext target and module system
- **Bundler-friendly**: Uses bundler module resolution
- **Declaration generation**: Emits `.d.ts` files with source maps
- **Strict type checking**: All strict flags enabled
- **Isolated modules**: Supports isolated compilation
- **Path mapping**: Configurable base URL and paths
- **Import/Export features**:
  - Synthetic default imports
  - Import helpers
  - Relative import extension rewriting
  - Verbatim module syntax

### Build Config (`tsconfig.build.json`)

The build configuration extends the development config with:

- **Full compilation**: Emits both JavaScript and declaration files
- **Production-ready**: Optimized for bundling and distribution

## 🔧 Key Features

- **ESNext Target**: Uses the latest ECMAScript features
- **Bundler Module Resolution**: Optimized for modern bundlers like Vite, Webpack, etc.
- **Strict Type Checking**: Comprehensive strict mode settings for better code quality
- **Decorator Support**: Experimental decorators with metadata emission
- **Isolated Declarations**: Ensures type-only imports/exports are properly handled
- **Modern Import/Export**: Support for TypeScript file extensions and relative import rewriting

## 📝 Compiler Options Highlights

### Output Configuration

- `outDir`: `${configDir}/../dist`
- `rootDir`: `${configDir}`
- `declaration`: `true`
- `declarationMap`: `true`
- `sourceMap`: `true`

### Strictness

- `strict`: `true`
- `noUncheckedIndexedAccess`: `true`
- `noPropertyAccessFromIndexSignature`: `true`
- `isolatedModules`: `true`
- `isolatedDeclarations`: `true`

### Modern Features

- `allowImportingTsExtensions`: `true`
- `rewriteRelativeImportExtensions`: `true`
- `verbatimModuleSyntax`: `true`
- `experimentalDecorators`: `true`

## 🎯 Use Cases

This configuration is ideal for:

- **Component Libraries**: Building reusable TypeScript components
- **Monorepo Packages**: Consistent TypeScript setup across packages
- **Modern Web Applications**: Using latest TypeScript features with bundlers
- **Library Development**: Creating distributable npm packages

## 📁 File Inclusion

The configuration automatically includes:

- `**/*.ts` - TypeScript files
- `**/*.dts` - TypeScript declaration files
- `**/*.tsx` - TypeScript JSX files
- `**/*.js` - JavaScript files (when needed)

And excludes:

- `dist/` - Build output directory
- `node_modules/` - Dependencies

## 🤝 Contributing

This package is part of the Weave monorepo. Please refer to the main repository for contribution guidelines.

## 📄 License

Apache-2.0

## 👤 Author

Kristoffer Roen-Lie
