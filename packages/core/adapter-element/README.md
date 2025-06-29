# @arcmantle/adapter-element

A modern custom element framework that bridges reactive signals with Web Components, providing an efficient and developer-friendly approach to building web components with automatic reactivity.

## Overview

The Adapter Element framework provides a lightweight abstraction over native Web Components that combines:

- **Signal-based reactivity** - Uses TC39 Signals proposal for efficient, fine-grained reactivity
- **Lit-html templating** - Leverages the powerful and lightweight lit-html for declarative rendering
- **Dependency injection** - Integrates with `@arcmantle/injector` for modular architecture
- **Decorator-driven development** - Modern decorator syntax for defining properties and state
- **Automatic attribute synchronization** - Seamless two-way binding between attributes and properties

## Why Adapter Element?

Traditional Web Components require significant boilerplate and manual change detection. Adapter Element solves this by:

1. **Eliminating manual rendering triggers** - Signal-based reactivity automatically re-renders when state changes
2. **Simplifying property management** - Decorators handle attribute/property synchronization automatically
3. **Providing modern DX** - Clean, class-based syntax with TypeScript support
4. **Maintaining Web Standards compliance** - Built on top of standard Web Components APIs

## Core Concepts

### AdapterElement

The base class that your components extend. It provides:
- Automatic change detection via signals
- Lifecycle management (connected, disconnected, updated)
- Template rendering with lit-html
- Plugin system integration

### Signal-based Reactivity

Uses the TC39 Signals proposal for reactive state management:
- `@state()` - Internal component state that triggers re-renders
- `@property()` - Properties synchronized with HTML attributes
- Automatic dependency tracking and efficient updates

### Two-Class Architecture

The framework uses a unique two-class approach:
- **AdapterElement** - Your component logic and rendering
- **AdapterBase** - Internal HTMLElement that manages the DOM integration

This separation provides clean APIs while maintaining full Web Component compatibility.

## Quick Start

```typescript
import { AdapterElement } from '@arcmantle/adapter-element/adapter';
import { customElement, property, state } from '@arcmantle/adapter-element/adapter';
import { html } from '@arcmantle/adapter-element/shared';

@customElement('my-counter')
class MyCounter extends AdapterElement {
  @property(Number) accessor count = 0;
  @state() accessor internalState = 'ready';

  protected render() {
    return html`
      <div>
        <p>Count: ${this.count}</p>
        <button @click=${this.increment}>+</button>
        <button @click=${this.decrement}>-</button>
      </div>
    `;
  }

  private increment = () => {
    this.count++;
  };

  private decrement = () => {
    this.count--;
  };
}
```

## Exports

The package provides several entry points:

- `./adapter` - Core AdapterElement class and decorators
- `./shared` - Shared utilities (lit-html exports, CSS helpers, reactive controllers)
- `./router` - Client-side routing utilities

## Project Status

⚠️ **Work in Progress** - This framework is currently in active development and APIs may change. Not recommended for production use yet.

## Features

- ✅ Signal-based reactivity
- ✅ Decorator-driven property management
- ✅ Lit-html templating integration
- ✅ Dependency injection support
- ✅ TypeScript support
- ✅ Lifecycle management
- 🚧 Router integration (in development)
- 🚧 Comprehensive documentation
- 🚧 Testing utilities

## Dependencies

- `lit-html` - Template rendering
- `signal-polyfill` - TC39 Signals implementation
- `@arcmantle/injector` - Dependency injection
- `@arcmantle/library` - Utility functions
