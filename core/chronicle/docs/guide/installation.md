---
title: Installation
description: Get Chronicle up and running in your project in minutes
keywords: installation, setup, npm, pnpm, yarn, getting started, configuration
---

# Installation

Get Chronicle up and running in your project in just a few minutes.

## Package Installation

Chronicle is available as an npm package and works in any JavaScript environment.

::: code-group

```bash [npm]
npm install @arcmantle/chronicle
```

```bash [pnpm]
pnpm add @arcmantle/chronicle
```

```bash [yarn]
yarn add @arcmantle/chronicle
```

:::

## Requirements

Chronicle has minimal requirements and no dependencies:

- **JavaScript**: ES2015+ (ES6+)
- **Node.js**: 16.x or later (if using server-side)
- **Browsers**: Any modern browser with Proxy support
  - Chrome 49+
  - Firefox 18+
  - Safari 10+
  - Edge 12+

::: warning Proxy Support Required
Chronicle relies on JavaScript Proxies, which cannot be polyfilled. Make sure your target environment supports Proxies. Check compatibility at [caniuse.com/proxy](https://caniuse.com/proxy).
:::

## Basic Setup

Once installed, you can import Chronicle in your project:

```typescript
// ES Modules
import { chronicle } from '@arcmantle/chronicle';

// CommonJS (if your environment supports it)
const { chronicle } = require('@arcmantle/chronicle');
```

### Your First Observable

```typescript
import { chronicle } from '@arcmantle/chronicle';

const state = chronicle({
  count: 0,
  user: { name: 'Alice' }
});

chronicle.listen(state, 'count', (path, newVal, oldVal) => {
  console.log(`Count: ${oldVal} → ${newVal}`);
});

state.count++; // Logs: "Count: 0 → 1"
```

That's it! No build configuration, no plugins, no additional setup required.

## TypeScript Configuration

Chronicle is written in TypeScript and includes full type definitions. If you're using TypeScript, you'll get complete IntelliSense and type checking out of the box.

### Basic TypeScript Setup

No special TypeScript configuration is needed! Just import and use:

```typescript
import { chronicle } from '@arcmantle/chronicle';

interface AppState {
  count: number;
  user: {
    name: string;
    email: string;
  };
}

const state = chronicle<AppState>({
  count: 0,
  user: {
    name: 'Alice',
    email: 'alice@example.com'
  }
});

// Full type safety
state.count = 42;      // ✅ OK
state.count = 'hello'; // ❌ Error: Type 'string' is not assignable to type 'number'
```

### TypeScript Compiler Options

Make sure your `tsconfig.json` includes these settings:

```json
{
  "compilerOptions": {
    "target": "ES2015",           // or later
    "module": "ESNext",            // or "CommonJS"
    "moduleResolution": "node",
    "strict": true,                // Recommended for type safety
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Path-Based Type Inference

Chronicle provides intelligent type inference for path-based operations:

```typescript
interface User {
  name: string;
  age: number;
  address: {
    city: string;
    zip: number;
  };
}

const user = chronicle<User>({
  name: 'Alice',
  age: 30,
  address: { city: 'New York', zip: 10001 }
});

// Type inference works for nested paths
chronicle.listen(user, 'address.city', (path, newVal, oldVal) => {
  // newVal and oldVal are inferred as string
  console.log(newVal.toUpperCase());
});
```

## Framework Integration

Chronicle is framework-agnostic but integrates seamlessly with popular frameworks.

### React

Use Chronicle with React hooks for reactive state management:

```typescript
import { useState, useEffect } from 'react';
import { chronicle } from '@arcmantle/chronicle';

function useChronicle<T extends object>(initialState: T) {
  const [state] = useState(() => chronicle(initialState));
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unlisten = chronicle.onAny(state, () => {
      forceUpdate({});
    });
    return unlisten;
  }, [state]);

  return state;
}

// Usage
function Counter() {
  const state = useChronicle({ count: 0 });

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => state.count++}>Increment</button>
      <button onClick={() => chronicle.undo(state)}>Undo</button>
    </div>
  );
}
```

### Vue

Chronicle works naturally with Vue's reactivity system:

```typescript
import { reactive } from 'vue';
import { chronicle } from '@arcmantle/chronicle';

// Create a chronicle-wrapped reactive object
const state = reactive(chronicle({
  count: 0,
  user: { name: 'Alice' }
}));

// Use in component
export default {
  setup() {
    const increment = () => state.count++;
    const undo = () => chronicle.undo(state);

    return { state, increment, undo };
  }
};
```

### Vanilla JavaScript

Chronicle works perfectly in plain JavaScript without any framework:

```typescript
import { chronicle } from '@arcmantle/chronicle';

const app = chronicle({
  todos: [],
  filter: 'all'
});

// Listen and update DOM
chronicle.listen(app, 'todos', () => {
  renderTodos(app.todos);
}, 'down');

// Add todo
document.getElementById('add-btn').addEventListener('click', () => {
  app.todos.push({
    id: Date.now(),
    text: document.getElementById('input').value,
    done: false
  });
});

// Undo button
document.getElementById('undo-btn').addEventListener('click', () => {
  chronicle.undo(app);
});
```

### Web Components

Chronicle integrates smoothly with Web Components:

```typescript
import { chronicle } from '@arcmantle/chronicle';

class TodoList extends HTMLElement {
  private state = chronicle({
    todos: [],
    filter: 'all'
  });

  connectedCallback() {
    // Listen to state changes
    chronicle.listen(this.state, 'todos', () => {
      this.render();
    }, 'down');

    this.render();
  }

  addTodo(text: string) {
    this.state.todos.push({
      id: Date.now(),
      text,
      done: false
    });
  }

  undo() {
    chronicle.undo(this.state);
  }

  render() {
    this.innerHTML = `
      <ul>
        ${this.state.todos.map(todo => `
          <li>${todo.text}</li>
        `).join('')}
      </ul>
    `;
  }
}

customElements.define('todo-list', TodoList);
```

## Runtime Environments

Chronicle works in multiple JavaScript runtimes:

### Browser

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { chronicle } from './node_modules/@arcmantle/chronicle/dist/index.js';

    const state = chronicle({ count: 0 });
    console.log(state.count);
  </script>
</head>
<body></body>
</html>
```

### Node.js

```javascript
// CommonJS
const { chronicle } = require('@arcmantle/chronicle');

// ES Modules (with "type": "module" in package.json)
import { chronicle } from '@arcmantle/chronicle';

const state = chronicle({ count: 0 });
console.log(state.count);
```

### Deno

```typescript
import { chronicle } from 'npm:@arcmantle/chronicle';

const state = chronicle({ count: 0 });
console.log(state.count);
```

### Bun

```typescript
import { chronicle } from '@arcmantle/chronicle';

const state = chronicle({ count: 0 });
console.log(state.count);
```

## Bundle Size

Chronicle is lightweight and tree-shakeable:

- **Minified**: ~15 KB
- **Minified + Gzipped**: ~5 KB
- **No dependencies**: Zero additional weight

::: tip Tree Shaking
If you only use specific Chronicle features, modern bundlers (Webpack, Rollup, Vite, esbuild) will automatically remove unused code, potentially reducing the bundle size further.
:::

## Development vs Production

Chronicle includes helpful warnings and error messages in development:

```typescript
// Development: Helpful error messages
const state = chronicle(null); // ❌ Error: chronicle() requires an object

// Production: Same behavior, smaller bundle
const state = chronicle(null); // ❌ Error (minimized message)
```

::: info No Build Flag Required
Chronicle automatically detects the environment. No special configuration needed.
:::

## Verification

To verify Chronicle is installed correctly:

```typescript
import { chronicle } from '@arcmantle/chronicle';

const test = chronicle({ value: 'Hello Chronicle!' });
console.log(test.value); // Should log: "Hello Chronicle!"

chronicle.listen(test, 'value', (path, newVal) => {
  console.log('Changed:', newVal);
});

test.value = 'It works!'; // Should log: "Changed: It works!"
```

If you see both log messages, Chronicle is working correctly! 🎉

## Troubleshooting

### Import Errors

If you get import errors:

```typescript
// ❌ Module not found
import { chronicle } from '@arcmantle/chronicle';
```

**Solutions:**

1. Make sure you've run `npm install @arcmantle/chronicle`
2. Check that `node_modules/@arcmantle/chronicle` exists
3. Try clearing your `node_modules` and reinstalling: `rm -rf node_modules && npm install`

### TypeScript Errors

If TypeScript can't find type definitions:

```bash
# Make sure TypeScript can see node_modules
npx tsc --showConfig

# Verify chronicle types exist
ls node_modules/@arcmantle/chronicle/dist/*.d.ts
```

### Proxy Support

If you get "Proxy is not defined":

```javascript
if (typeof Proxy === 'undefined') {
  console.error('Your environment does not support Proxy');
}
```

**Solution:** Upgrade to a modern browser or Node.js version. Proxies cannot be polyfilled.

## Next Steps

Now that Chronicle is installed, learn how it works:

- **[Getting Started →](./getting-started)** - Learn the basics
- **[Deep Observation →](./deep-observation)** - Understand how Chronicle tracks changes
- **[Listeners →](./listeners)** - Master change detection
- **[API Reference →](../api/index)** - Complete API documentation

---

**Ready to dive in?** Start with [Getting Started](./getting-started) to build your first Chronicle application.
