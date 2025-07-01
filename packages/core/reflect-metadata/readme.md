# @arcmantle/reflect-metadata

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

A lightweight, partial implementation of the [TC39 Reflect Metadata proposal](https://github.com/tc39/proposal-reflect-metadata). This library provides reflection metadata functionality with a focus on performance and bundle size.

## ✨ Features

- 🪶 **Lightweight**: Only ~3.2KB unminified, 1.7KB minified, 0.7KB gzipped
- 🚀 **Performance optimized**: WeakMap-based storage for optimal memory usage
- 🔧 **Function-activated**: Extends the global Reflect object with metadata APIs
- 🛡️ **Safe**: Won't override existing reflect-metadata implementations
- 📦 **ESM native**: Built for modern JavaScript environments
- 🎯 **TypeScript ready**: Full type definitions included

## 📦 Installation

```bash
npm install jsr:@arcmantle/reflect-metadata
```

```bash
pnpm add jsr:@arcmantle/reflect-metadata
```

```bash
yarn add jsr:@arcmantle/reflect-metadata
```

## 🚀 Quick Start

### Extend Global Reflect

Extend the global Reflect object with metadata APIs:

#### TypeScript/JavaScript

```typescript
import { useReflectMetadata } from '@arcmantle/reflect-metadata';

// Extend the global Reflect with metadata APIs
const Reflect = useReflectMetadata();

// Now you can use Reflect metadata APIs (global Reflect is extended)
Reflect.defineMetadata('custom:key', 'value', target);
const value = Reflect.getMetadata('custom:key', target);
```

#### HTML

```html
<script type="module">
 import { useReflectMetadata } from '@arcmantle/reflect-metadata';

 const Reflect = useReflectMetadata();
 // Reflect metadata APIs are now available globally
</script>
```

## 📚 API Reference

This library implements the following Reflect metadata APIs:

### `Reflect.defineMetadata(key, value, target[, propertyKey])`

Defines metadata for a target object or property.

```typescript
const Reflect = useReflectMetadata();
Reflect.defineMetadata('custom:type', 'string', MyClass, 'propertyName');
```

### `Reflect.getMetadata(key, target[, propertyKey])`

Retrieves metadata from a target object or property, including inherited metadata.

```typescript
const Reflect = useReflectMetadata();
const type = Reflect.getMetadata('custom:type', MyClass, 'propertyName');
```

### `Reflect.getOwnMetadata(key, target[, propertyKey])`

Retrieves own metadata from a target object or property (no inheritance).

```typescript
const Reflect = useReflectMetadata();
const ownType = Reflect.getOwnMetadata('custom:type', MyClass, 'propertyName');
```

### `Reflect.hasMetadata(key, target[, propertyKey])`

Checks if metadata exists for a target object or property (including inherited).

```typescript
const Reflect = useReflectMetadata();
const hasType = Reflect.hasMetadata('custom:type', MyClass, 'propertyName');
```

### `Reflect.hasOwnMetadata(key, target[, propertyKey])`

Checks if own metadata exists for a target object or property (no inheritance).

```typescript
const Reflect = useReflectMetadata();
const hasOwnType = Reflect.hasOwnMetadata('custom:type', MyClass, 'propertyName');
```

### `Reflect.metadata(key, value)`

Creates a metadata decorator function.

```typescript
const Reflect = useReflectMetadata();
const Type = (type: string) => Reflect.metadata('custom:type', type);

class MyClass {
 @Type('string')
 propertyName: string;
}
```

### `Reflect.decorate(decorators, target[, propertyKey, descriptor])`

Applies decorators to a target.

```typescript
const Reflect = useReflectMetadata();
const decoratedClass = Reflect.decorate([MyDecorator], MyClass);
```

## 🔧 Usage Examples

### Basic Metadata Storage

```typescript
import { useReflectMetadata } from '@arcmantle/reflect-metadata';

const Reflect = useReflectMetadata();

class User {
 name: string;
 email: string;
}

// Store metadata
Reflect.defineMetadata('validation:required', true, User, 'name');
Reflect.defineMetadata('validation:email', true, User, 'email');

// Retrieve metadata
const isNameRequired = Reflect.getMetadata('validation:required', User, 'name');
const isEmailValidation = Reflect.getMetadata('validation:email', User, 'email');
```

### Custom Decorators

```typescript
import { useReflectMetadata } from '@arcmantle/reflect-metadata';

const Reflect = useReflectMetadata();

// Create a validation decorator
function Required(target: any, propertyKey: string) {
 Reflect.defineMetadata('validation:required', true, target, propertyKey);
}

function Email(target: any, propertyKey: string) {
 Reflect.defineMetadata('validation:email', true, target, propertyKey);
}

class User {
 @Required
 name: string;

 @Required
 @Email
 email: string;
}

// Validation logic
function validate(instance: any) {
 const constructor = instance.constructor;

 for (const property of Object.keys(instance)) {
  const isRequired = Reflect.getMetadata('validation:required', constructor, property);
  const isEmail = Reflect.getMetadata('validation:email', constructor, property);

  if (isRequired && !instance[property]) {
   throw new Error(`${property} is required`);
  }

  if (isEmail && !instance[property].includes('@')) {
   throw new Error(`${property} must be a valid email`);
  }
 }
}
```

## ⚠️ Important Notes

- **Safe activation**: Multiple calls to `useReflectMetadata()` return the same extended global Reflect
- **Non-destructive**: Won't override existing reflect-metadata implementations
- **Global extension**: Extends the global Reflect object with metadata methods
- **ESM only**: This package is ESM-only and requires Node.js 14+ or modern browsers
- **Partial implementation**: Only implements the most commonly used metadata APIs

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [TC39 Reflect Metadata Proposal](https://github.com/tc39/proposal-reflect-metadata)
- [reflect-metadata](https://github.com/rbuckton/reflect-metadata) - Full implementation

---
