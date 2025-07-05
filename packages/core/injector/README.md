# @arcmantle/injector

Dependency injection done simple.

A lightweight, type-safe dependency injection container for TypeScript/JavaScript applications with support for multiple binding types, lifetimes, and hierarchical containers.

## Features

- 🎯 **Simple API** - Intuitive fluent interface for binding and resolving dependencies
- 🔧 **Multiple Binding Types** - Support for classes, factories, and constants
- ⏱️ **Lifetime Management** - Singleton and transient lifetimes
- 🏷️ **Named & Tagged Bindings** - Additional granularity for complex scenarios
- 🌳 **Hierarchical Containers** - Parent-child container relationships
- 📦 **Module System** - Organize related bindings into loadable modules
- 💫 **Activation Hooks** - Post-creation instance processing
- 🔍 **TypeScript First** - Full type safety and IntelliSense support

## Installation

```bash
npm install @arcmantle/injector
# or
pnpm add @arcmantle/injector
# or
yarn add @arcmantle/injector
```

## Basic Usage

### Creating a Container

```typescript
import { PluginContainer } from '@arcmantle/injector';

const container = new PluginContainer();
```

### Binding Values

#### Constants

```typescript
// Bind a constant value
container.bind('API_URL').constant('https://api.example.com');
container.bind('config').constant({ timeout: 5000, retries: 3 });
```

#### Classes

```typescript
class DatabaseService {
  constructor(private container: PluginContainer) {}
}

class UserService {
  constructor(private container: PluginContainer) {
    this.db = container.get('database');
  }
}

// Bind classes (singleton by default)
container.bind('database').class(DatabaseService).singleton();
container.bind('users').class(UserService).transient();
```

#### Factories

```typescript
// Bind a factory function
container.bind('logger').factory(container => {
  const config = container.get('config');
  return new Logger(config.logLevel);
}).singleton();
```

### Resolving Dependencies

```typescript
// Get a single instance
const config = container.get('config');
const userService = container.get<UserService>('users');

// Try to get (returns undefined if not bound)
const optional = container.tryGet('optional-service');

// Get all instances of a binding
const plugins = container.getAll('plugin');
```

## Advanced Features

### Named Bindings

```typescript
// Bind multiple implementations with names
container.bind('database').class(PostgreSQLService).named('postgres');
container.bind('database').class(MongoDBService).named('mongo');

// Resolve by name
const pgDb = container.getNamed('database', 'postgres');
const mongoDb = container.getNamed('database', 'mongo');
```

### Tagged Bindings

```typescript
// Bind with name and tag for extra specificity
container.bind('cache')
  .class(RedisCache)
  .tagged('redis', 'production');

container.bind('cache')
  .class(MemoryCache)
  .tagged('memory', 'development');

// Resolve by name and tag
const prodCache = container.getTagged('cache', 'redis', 'production');
```

### Activation Hooks

```typescript
container.bind('service')
  .class(MyService)
  .onActivation((instance, container) => {
    // Perform additional setup
    instance.initialize();
    return instance;
  })
  .singleton();
```

### Hierarchical Containers

```typescript
const parentContainer = new PluginContainer();
const childContainer = new PluginContainer({ parent: parentContainer });

// Child containers inherit parent bindings
parentContainer.bind('shared').constant('parent-value');
console.log(childContainer.get('shared')); // 'parent-value'

// Child bindings override parent bindings
childContainer.bind('shared').constant('child-value');
console.log(childContainer.get('shared')); // 'child-value'
```

### Module System

```typescript
import { PluginModule } from '@arcmantle/injector';

// Create a module
const databaseModule = new PluginModule(({ bind, bindOnce, rebind }) => {
  bind('connection').factory(container => {
    const config = container.get('db-config');
    return new Connection(config);
  }).singleton();

  bind('repository').class(UserRepository).transient();
});

// Load the module
container.load(databaseModule);

// Unload when needed
container.unload(databaseModule);
```

## Binding Methods

### `bind(identifier)`

Creates a new binding, potentially overriding existing ones.

### `bindOnce(identifier)`

Only binds if the identifier doesn't already exist. Returns `undefined` if already bound.

### `rebind(identifier)`

Removes existing bindings for the identifier and creates a new one.

## Resolution Methods

| Method | Description |
|--------|-------------|
| `get(id)` | Get single instance (throws if not found) |
| `tryGet(id)` | Get single instance or undefined |
| `getNamed(id, name)` | Get named instance |
| `getTagged(id, name, tag)` | Get tagged instance |
| `getAll(id)` | Get all instances as array |
| `tryGetAll(id)` | Get all instances or empty array |
| `getLast(id)` | Get the last registered instance |

## Container Management

```typescript
// Check if bindings exist
container.has('service');          // In this container only
container.exists('service');       // In this container or parents
container.hasNamed('service', 'name');
container.existsNamed('service', 'name');

// Remove bindings
container.unbind('service');       // Remove specific binding
container.unbindAll();             // Remove all bindings
```

## TypeScript Usage

The library is designed with TypeScript in mind:

```typescript
interface IUserService {
  getUser(id: string): User;
}

class UserService implements IUserService {
  getUser(id: string): User {
    // implementation
  }
}

// Type-safe binding and resolution
container.bind<IUserService>('users').class(UserService);
const userService = container.get<IUserService>('users');
```

## Configuration Options

```typescript
const container = new PluginContainer({
  defaultLifetime: 'transient',  // Default: 'singleton'
  parent: parentContainer        // Optional parent container
});
```

## Best Practices

1. **Use Interfaces**: Bind to interfaces rather than concrete classes for better testability
2. **Module Organization**: Group related bindings into modules
3. **Singleton by Default**: Use singletons for stateless services, transients for stateful ones
4. **Container Hierarchy**: Use parent containers for shared dependencies
5. **Named Bindings**: Use named bindings for multiple implementations of the same interface

## License

Apache-2.0 © Kristoffer Roen-Lie

## Contributing

This package is part of the @arcmantle monorepo. Please refer to the main repository for contribution guidelines.
