# @arcmantle/lit-context

A powerful and lightweight context provider and consumer system for Lit Elements, enabling efficient state sharing across component hierarchies without prop drilling.

## Features

- 🚀 **Easy to use**: Simple decorators for providing and consuming context
- 🎯 **Type-safe**: Full TypeScript support with proper type inference
- ⚡ **Performant**: Efficient event-based communication system
- 🔄 **Reactive**: Automatic updates when context values change
- 🌳 **Flexible**: Works with both decorator-based and component-based approaches
- 📦 **Lightweight**: Minimal bundle size with zero external dependencies (except Lit)

## Installation

```bash
npm install @arcmantle/lit-context
# or
pnpm add @arcmantle/lit-context
# or
yarn add @arcmantle/lit-context
```

## Quick Start

### Using Decorators (Recommended)

**Provider Component:**

```typescript
import { LitElement, html } from 'lit';
import { provide } from '@arcmantle/lit-context';

class MyProvider extends LitElement {
  @provide() theme = 'dark';
  @provide() user = { name: 'John', id: 1 };

  render() {
    return html`
      <div>
        <h1>My App</h1>
        <slot></slot>
      </div>
    `;
  }
}
```

**Consumer Component:**

```typescript
import { LitElement, html } from 'lit';
import { consume, type ContextProp } from '@arcmantle/lit-context';

class MyConsumer extends LitElement {
  @consume() theme: ContextProp<string>;
  @consume() user: ContextProp<{ name: string; id: number }>;

  render() {
    return html`
      <div class="theme-${this.theme?.value}">
        <p>Hello, ${this.user?.value?.name}!</p>
        <button @click=${() => this.theme.value = 'light'}>
          Switch Theme
        </button>
      </div>
    `;
  }
}
```

### Using ContextProvider Component

```typescript
import { LitElement, html } from 'lit';
import { ContextProvider } from '@arcmantle/lit-context';

// Register the context provider component
ContextProvider.register();

class MyApp extends LitElement {
  private context = {
    theme: 'dark',
    user: { name: 'John', id: 1 }
  };

  render() {
    return html`
      <context-provider .context=${this.context}>
        <my-consumer></my-consumer>
        <my-other-consumer></my-other-consumer>
      </context-provider>
    `;
  }
}
```

## API Reference

### Decorators

#### `@provide(name?: string)`

Marks a property as a context provider. The property will be available to all child components that consume the same context.

**Parameters:**

- `name` (optional): Custom name for the context. If not provided, uses the property name.

**Example:**

```typescript
class Provider extends LitElement {
  @provide() myValue = 'hello';
  @provide('customName') anotherValue = 42;
}
```

#### `@consume(name?: string)`

Marks a property as a context consumer. The property will receive updates from the nearest parent provider.

**Parameters:**

- `name` (optional): Custom name for the context to consume. If not provided, uses the property name.

**Returns:** `ContextProp<T>` - An object with a `value` property for getting/setting the context value.

**Example:**

```typescript
class Consumer extends LitElement {
  @consume() myValue: ContextProp<string>;
  @consume('customName') anotherValue: ContextProp<number>;

  someMethod() {
    console.log(this.myValue.value); // 'hello'
    this.myValue.value = 'updated'; // Updates the provider
  }
}
```

### Components

#### `ContextProvider`

A Lit element that provides context to its children.

**Properties:**

- `context`: Record<string, any> - Object containing all context values

**Methods:**

- `static register()`: Registers the component as a custom element

**Example:**

```typescript
import { ContextProvider } from '@arcmantle/lit-context';

ContextProvider.register();

// Now you can use <context-provider> in your templates
```

### Types

#### `ContextProp<T>`

Interface for context properties in consumer components.

```typescript
interface ContextProp<T = any> {
  value: T;
}
```

#### `ConsumeContextEvent<T>`

Custom event type used internally for context communication.

```typescript
type ConsumeContextEvent<T = any> = CustomEvent<{ prop: { value: T; }; }>;
```

## Advanced Usage

### Named Contexts

You can use named contexts to avoid conflicts when multiple providers offer the same property name:

```typescript
class ThemeProvider extends LitElement {
  @provide('app-theme') theme = 'dark';
}

class ThemeConsumer extends LitElement {
  @consume('app-theme') theme: ContextProp<string>;
}
```

### Nested Providers

Context providers can be nested, with inner providers taking precedence:

```typescript
html`
  <outer-provider>
    <!-- theme from outer-provider -->
    <consumer-one></consumer-one>

    <inner-provider>
      <!-- theme from inner-provider -->
      <consumer-two></consumer-two>
    </inner-provider>
  </outer-provider>
`
```

### Dynamic Context Updates

Context values are reactive and will automatically trigger updates in consuming components:

```typescript
class Provider extends LitElement {
  @provide() counter = 0;

  increment() {
    this.counter++; // All consumers will update automatically
  }
}

class Consumer extends LitElement {
  @consume() counter: ContextProp<number>;

  render() {
    return html`
      <p>Count: ${this.counter?.value}</p>
      <button @click=${() => this.counter.value++}>
        Increment from consumer
      </button>
    `;
  }
}
```

## Performance Considerations

- Context updates use an efficient event-based system
- Only consumers that actually use a changed context value will re-render
- The library automatically manages event listeners and cleanup
- Minimal overhead with lazy controller initialization

## Browser Support

This library supports all modern browsers that support:

- ES2017+ (async/await, etc.)
- Custom Elements v1
- ES Modules

## Development

```bash
# Install dependencies
pnpm install

# Run development server with demo
pnpm dev

# Build the library
pnpm build
```

## License

Apache-2.0

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Related Projects

- [Lit](https://lit.dev/) - Simple. Fast. Web Components.
- [Lit Context Protocol](https://github.com/lit/lit/tree/main/packages/context) - Official Lit context implementation
