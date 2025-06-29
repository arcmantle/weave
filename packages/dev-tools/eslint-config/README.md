# @arcmantle/eslint-config

A comprehensive ESLint configuration package for TypeScript and JavaScript projects, featuring stylistic rules, import sorting, and specialized configurations for different environments.

## Features

- 🎯 **TypeScript-first**: Built with TypeScript support as a primary concern
- 🎨 **Stylistic Rules**: Comprehensive formatting and code style enforcement
- 📦 **Import Sorting**: Automatic import organization with `simple-import-sort`
- 🏗️ **Multiple Configs**: Tailored configurations for different project types
- 🔧 **Modern ESLint**: Uses ESLint v9 flat config format
- 🚀 **Lit Support**: Specialized rules for Lit element development

## Installation

```bash
npm install @arcmantle/eslint-config
# or
pnpm add @arcmantle/eslint-config
# or
yarn add @arcmantle/eslint-config
```

## Usage

Create an `eslint.config.js` file in your project root:

```javascript
import { configs } from '@arcmantle/eslint-config';

export default [
  ...configs.recommended,
  // Add your custom overrides here
];
```

## Available Configurations

### `recommended`
The default configuration suitable for most TypeScript/JavaScript projects.

```javascript
import { configs } from '@arcmantle/eslint-config';

export default [...configs.recommended];
```

**Includes:**
- ESLint recommended rules
- TypeScript strict and stylistic rules
- Stylistic formatting rules
- Import sorting
- Modern ECMAScript features support

### `node`
Extends the recommended config with Node.js specific optimizations.

```javascript
import { configs } from '@arcmantle/eslint-config';

export default [...configs.node];
```

### `lit`
Specialized configuration for Lit element development.

```javascript
import { configs } from '@arcmantle/eslint-config';

export default [...configs.lit];
```

**Includes:**
- All recommended rules
- Lit-specific linting rules
- Custom element best practices

## Configuration Details

### Code Style Highlights

- **Indentation**: Tab-based indentation
- **Quotes**: Single quotes with template literal support
- **Semicolons**: Always required
- **Max Line Length**: 130 characters for code, 150 for comments
- **Brace Style**: Stroustrup style
- **Object/Array Spacing**: Enforced spacing for readability

### Import Organization

Imports are automatically sorted using `simple-import-sort`:
- External libraries first
- Internal imports second
- Relative imports last
- Blank lines between import groups

### TypeScript Features

- Strict type checking enabled
- Explicit return types required for public methods
- Unused variables warning (prefix with `_` to ignore)
- No-public accessibility modifier enforcement
- Consistent generic constructor patterns

## File Coverage

The configuration applies to:
- `**/*.{js,jsx,mjs,cjs,ts,tsx}`

And ignores:
- `**/dist/**`
- `**/node_modules/**`

## Customization

You can override specific rules by extending the configuration:

```javascript
import { configs } from '@arcmantle/eslint-config';

export default [
  ...configs.recommended,
  {
    rules: {
      // Your custom rule overrides
      '@stylistic/max-len': ['warn', { code: 100 }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
```

## Requirements

- **Node.js**: >= 22
- **ESLint**: >= 9.29.0
- **TypeScript**: >= 5.8.3 (for TypeScript projects)

## Dependencies

This package includes and configures:
- `@eslint/js` - Core ESLint rules
- `@stylistic/eslint-plugin` - Code formatting rules
- `eslint-plugin-lit` - Lit element specific rules
- `eslint-plugin-simple-import-sort` - Import organization
- `typescript-eslint` - TypeScript integration

## License

MIT

## Author

Kristoffer Roen-Lie
