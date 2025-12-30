---
layout: home

hero:
  name: "Chronicle"
  text: "Deep Observable State with Time-Travel"
  tagline: A powerful state observation library with deep proxy-based tracking, history recording, and time-travel debugging for JavaScript objects
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/index
    - theme: alt
      text: View on GitHub
      link: https://github.com/arcmantle/chronicle

features:
  - icon: 🔍
    title: Deep Observation
    details: Automatically tracks changes to nested objects, arrays, Maps, and Sets with intelligent proxy management.

  - icon: ⏱️
    title: Time-Travel Debugging
    details: Full undo/redo with group-based operations and configurable history management.

  - icon: 🎯
    title: Flexible Listeners
    details: Listen to specific paths with exact, descendant, or ancestor modes for granular change detection.

  - icon: 📦
    title: Batching & Transactions
    details: Group multiple changes into atomic, undo-able operations with automatic or manual batching.

  - icon: 📊
    title: Smart History
    details: Configurable history size, filtering, and compaction to optimize memory usage.

  - icon: 🔄
    title: Diff & Snapshots
    details: Compare current state to original, reset to pristine, or create point-in-time snapshots.

  - icon: ⚡
    title: Performance Optimized
    details: Debounce, throttle, and schedule options for efficient change notification.

  - icon: 🎛️
    title: Quality of Life
    details: Once listeners, pause/resume notifications, and flexible scheduling options.
---

## Quick Example

Track and manage state changes with Chronicle:

```typescript
import { chronicle } from '@arcmantle/chronicle';

// Observe an object
const state = chronicle({
  count: 0,
  user: { name: 'Alice', email: 'alice@example.com' }
});

// Listen to specific changes
chronicle.listen(state, 'count', (path, newValue, oldValue) => {
  console.log(`Count changed from ${oldValue} to ${newValue}`);
});

// Listen to nested changes
chronicle.listen(state, 'user', (path, newValue, oldValue) => {
  console.log(`User changed at ${path.join('.')}`);
}, 'down');

// Make changes (listeners fire automatically)
state.count = 1;
state.user.name = 'Bob';

// Undo changes
chronicle.undo(state); // user.name back to 'Alice'
chronicle.undo(state); // count back to 0

// Redo
chronicle.redo(state); // count back to 1
```

## Installation

::: code-group

```sh [npm]
npm install @arcmantle/chronicle
```

```sh [pnpm]
pnpm add @arcmantle/chronicle
```

```sh [yarn]
yarn add @arcmantle/chronicle
```

:::

## Basic Usage

```typescript
import { chronicle } from '@arcmantle/chronicle';

// Create an observable state
const state = chronicle({
  todos: [],
  filter: 'all'
});

// React to changes
chronicle.listen(state, 'todos', () => {
  console.log('Todos updated:', state.todos);
}, 'down');

// Make changes
state.todos.push({ id: 1, text: 'Learn Chronicle', done: false });

// Time travel
chronicle.undo(state);
chronicle.redo(state);
```

Now you're ready to start using Chronicle! 🚀
