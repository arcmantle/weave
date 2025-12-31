---
title: TypeScript
description: Leverage TypeScript's type system for type-safe state management
keywords: typescript, types, type safety, generics, intellisense, type inference
---

# TypeScript

Learn how to leverage TypeScript's type system with Chronicle for fully type-safe state management, complete IntelliSense, and compile-time error checking.

## Type Safety Out of the Box

Chronicle is written in TypeScript and provides complete type definitions. When you create an observable object, TypeScript infers all types automatically:

```typescript
import { chronicle } from '@arcmantle/chronicle';

const state = chronicle({
  count: 0,
  user: {
    name: 'Alice',
    email: 'alice@example.com'
  }
});

// TypeScript knows the types!
state.count = 42;      // ✅ OK
state.count = 'hello'; // ❌ Error: Type 'string' is not assignable to type 'number'

state.user.name = 'Bob';    // ✅ OK
state.user.age = 30;        // ❌ Error: Property 'age' does not exist
```

## Defining State Interfaces

For better documentation and reusability, define explicit interfaces:

```typescript
interface User {
  name: string;
  email: string;
  age?: number;
}

interface AppState {
  count: number;
  user: User;
  items: string[];
}

const state = chronicle<AppState>({
  count: 0,
  user: {
    name: 'Alice',
    email: 'alice@example.com'
  },
  items: []
});

// Full type checking and autocomplete
state.user.age = 30;     // ✅ OK (optional property)
state.items.push('test'); // ✅ OK
state.invalid = 'value';  // ❌ Error: Property 'invalid' does not exist
```

## Listener Type Safety

Listeners are fully typed based on the path you're listening to:

```typescript
interface AppState {
  count: number;
  user: {
    name: string;
    preferences: {
      theme: 'light' | 'dark';
      fontSize: number;
    };
  };
}

const state = chronicle<AppState>({
  count: 0,
  user: {
    name: 'Alice',
    preferences: {
      theme: 'light',
      fontSize: 14
    }
  }
});

// Type inference for listeners
chronicle.listen(state, 'user.preferences.theme', (path, newVal, oldVal) => {
  // newVal and oldVal are inferred as 'light' | 'dark'
  console.log(newVal.toUpperCase()); // ✅ OK - string method
  console.log(newVal + 1);            // ❌ Error: can't add number to string
});

chronicle.listen(state, 'count', (path, newVal, oldVal) => {
  // newVal and oldVal are inferred as number
  console.log(newVal.toFixed(2)); // ✅ OK - number method
});
```

## Path Type Safety

### String Paths

String paths are checked against your interface:

```typescript
// ✅ Valid paths
chronicle.listen(state, 'count', listener);
chronicle.listen(state, 'user.name', listener);
chronicle.listen(state, 'user.preferences.theme', listener);

// ❌ TypeScript won't catch these at compile time
chronicle.listen(state, 'user.invalid', listener);  // Runtime error
chronicle.listen(state, 'user.name.invalid', listener); // Runtime error
```

::: warning String Path Limitations
TypeScript cannot validate string paths at compile time. For type safety, use function selectors.
:::

### Array Paths

Array paths provide better type checking:

```typescript
// ✅ Better type checking
chronicle.listen(state, ['user', 'name'], listener);
chronicle.listen(state, ['user', 'preferences', 'theme'], listener);

// ❌ TypeScript catches invalid paths
chronicle.listen(state, ['user', 'invalid'], listener); // Might error depending on strictness
```

### Function Selectors (Best)

Function selectors provide the strongest type safety:

```typescript
// ✅ Full type checking and autocomplete
chronicle.listen(state, s => s.count, listener);
chronicle.listen(state, s => s.user.name, listener);
chronicle.listen(state, s => s.user.preferences.theme, listener);

// ❌ TypeScript catches errors at compile time
chronicle.listen(state, s => s.invalid, listener); // Error!
chronicle.listen(state, s => s.user.invalid, listener); // Error!
```

## Generic State Types

Create reusable state management functions:

```typescript
function createStore<T extends object>(initialState: T) {
  const state = chronicle<T>(initialState);

  return {
    state,
    listen: (
      path: keyof T,
      callback: (value: T[keyof T]) => void
    ) => {
      return chronicle.listen(state, path as string, (_, newVal) => {
        callback(newVal);
      });
    },
    update: (updates: Partial<T>) => {
      chronicle.batch(state, (s) => {
        Object.assign(s, updates);
      });
    }
  };
}

// Usage with type safety
interface TodoState {
  todos: Array<{ id: number; text: string }>;
  filter: 'all' | 'active' | 'completed';
}

const store = createStore<TodoState>({
  todos: [],
  filter: 'all'
});

// Fully typed!
store.update({ filter: 'active' }); // ✅ OK
store.update({ filter: 'invalid' }); // ❌ Error
store.listen('todos', todos => {
  // todos is typed as Array<{ id: number; text: string }>
  console.log(todos.length);
});
```

## Typed Snapshots

Snapshots preserve your types:

```typescript
const state = chronicle<AppState>({
  count: 0,
  user: { name: 'Alice', email: 'alice@example.com' }
});

const snapshot = chronicle.snapshot(state);
// snapshot is typed as AppState

console.log(snapshot.count);      // ✅ OK
console.log(snapshot.user.name);  // ✅ OK
console.log(snapshot.invalid);    // ❌ Error
```

## Typed Diffs

Diff records are fully typed:

```typescript
import type { DiffRecord } from '@arcmantle/chronicle';

const diff = chronicle.diff(state);
// diff is typed as DiffRecord[]

diff.forEach(change => {
  // change.kind is 'added' | 'removed' | 'changed'
  // change.path is string[]
  // change.oldValue is any (or undefined for 'added')
  // change.newValue is any (or undefined for 'removed')

  if (change.kind === 'changed') {
    console.log(change.oldValue, change.newValue);
  }
});
```

## Advanced Type Patterns

### Nested State Types

```typescript
interface DatabaseState {
  users: Map<string, User>;
  posts: Map<string, Post>;
  comments: Map<string, Comment>;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  authorId: string;
  title: string;
  content: string;
}

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
}

const db = chronicle<DatabaseState>({
  users: new Map(),
  posts: new Map(),
  comments: new Map()
});

// Fully typed Map operations
db.users.set('user1', {
  id: 'user1',
  name: 'Alice',
  email: 'alice@example.com'
}); // ✅ OK

db.users.set('user2', {
  id: 'user2',
  name: 'Bob'
  // ❌ Error: Property 'email' is missing
});
```

### Readonly State

Make state readonly for consumers:

```typescript
function createReadonlyState<T extends object>(initialState: T) {
  const state = chronicle<T>(initialState);

  return {
    // Readonly access
    get state(): Readonly<T> {
      return state as Readonly<T>;
    },

    // Controlled mutations
    update(fn: (state: T) => void) {
      chronicle.batch(state, fn);
    }
  };
}

// Usage
const store = createReadonlyState({ count: 0 });

console.log(store.state.count);  // ✅ OK
store.state.count = 10;          // ❌ Error: Cannot assign to 'count' (readonly)

store.update(s => {
  s.count = 10; // ✅ OK inside update
});
```

### Strict Null Checking

Chronicle works great with strict null checking:

```typescript
interface UserState {
  currentUser: User | null;
  selectedId: string | undefined;
}

const state = chronicle<UserState>({
  currentUser: null,
  selectedId: undefined
});

// TypeScript enforces null checks
if (state.currentUser !== null) {
  console.log(state.currentUser.name); // ✅ OK (narrowed to User)
}

console.log(state.currentUser.name); // ❌ Error: Object is possibly 'null'
```

### Union Types

```typescript
interface LoadingState {
  status: 'loading';
}

interface SuccessState {
  status: 'success';
  data: any[];
}

interface ErrorState {
  status: 'error';
  error: string;
}

type AppState = LoadingState | SuccessState | ErrorState;

const state = chronicle<AppState>({ status: 'loading' });

// Type narrowing works
if (state.status === 'success') {
  console.log(state.data); // ✅ OK (narrowed to SuccessState)
}

if (state.status === 'error') {
  console.log(state.error); // ✅ OK (narrowed to ErrorState)
}
```

## Utility Types

### Extract State Type

```typescript
// Extract the type from a chronicle instance
type StateType<T> = T extends ReturnType<typeof chronicle<infer U>> ? U : never;

const state = chronicle({ count: 0, name: '' });
type MyState = StateType<typeof state>; // { count: number; name: string }
```

### Path Type Helper

```typescript
// Type for valid object paths
type PathOf<T> = {
  [K in keyof T]: K extends string
    ? T[K] extends object
      ? K | `${K}.${PathOf<T[K]>}`
      : K
    : never;
}[keyof T];

interface MyState {
  user: {
    profile: {
      name: string;
    };
  };
}

// Valid paths: 'user' | 'user.profile' | 'user.profile.name'
type ValidPaths = PathOf<MyState>;

function listenToPath<T>(
  state: T,
  path: PathOf<T>,
  callback: () => void
) {
  chronicle.listen(state, path as string, callback);
}

// Type-checked paths!
listenToPath(state, 'user.profile.name', () => {}); // ✅ OK
listenToPath(state, 'invalid', () => {}); // ❌ Error
```

## React Integration with TypeScript

```typescript
import { useState, useEffect } from 'react';

function useChronicleState<T extends object>(initialState: T) {
  const [state] = useState(() => chronicle<T>(initialState));
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unlisten = chronicle.onAny(state, () => {
      forceUpdate({});
    });
    return unlisten;
  }, [state]);

  return state;
}

// Usage in component
interface TodoState {
  items: Array<{ id: number; text: string; done: boolean }>;
  filter: 'all' | 'active' | 'completed';
}

function TodoApp() {
  const state = useChronicleState<TodoState>({
    items: [],
    filter: 'all'
  });

  // Fully typed state!
  const addTodo = (text: string) => {
    state.items.push({
      id: Date.now(),
      text,
      done: false
    });
  };

  return (
    <div>
      {state.items.map(item => (
        <div key={item.id}>{item.text}</div>
      ))}
    </div>
  );
}
```

## Type Checking Best Practices

### ✅ Do: Define Explicit Interfaces

```typescript
// ✅ Good: Explicit interface
interface AppState {
  count: number;
  user: User;
}

const state = chronicle<AppState>({ ... });
```

### ❌ Don't: Rely on Inference for Complex Types

```typescript
// ❌ Bad: Hard to maintain
const state = chronicle({
  complex: {
    nested: {
      data: {
        // Deep nesting, unclear types
      }
    }
  }
});
```

### ✅ Do: Use Function Selectors

```typescript
// ✅ Good: Type-safe path selection
chronicle.listen(state, s => s.user.name, handler);
```

### ❌ Don't: Use String Paths for Complex Paths

```typescript
// ❌ Bad: No type checking
chronicle.listen(state, 'user.profile.settings.theme', handler);
```

### ✅ Do: Narrow Union Types

```typescript
// ✅ Good: Proper type narrowing
if (state.status === 'success') {
  // TypeScript knows state is SuccessState
  console.log(state.data);
}
```

### ✅ Do: Use Strict Mode

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true
  }
}
```

## Common TypeScript Issues

### Issue 1: Type Widening

```typescript
// Problem: Type widened to string
const state = chronicle({
  status: 'loading' // Type: string (too wide!)
});

// Solution: Use const assertion or explicit type
const state = chronicle({
  status: 'loading' as const // Type: 'loading'
});

// Or
interface State {
  status: 'loading' | 'success' | 'error';
}
const state = chronicle<State>({ status: 'loading' });
```

### Issue 2: Any Leakage

```typescript
// Problem: oldValue and newValue are any
chronicle.listen(state, 'user', (path, newVal, oldVal) => {
  // newVal and oldVal are 'any' :(
});

// Solution: Use explicit typing
chronicle.listen(state, 'user', (path, newVal: User, oldVal: User) => {
  // Now properly typed!
});
```

### Issue 3: Lost Type Information

```typescript
// Problem: Snapshot loses type information
const snapshot = chronicle.snapshot(state);
// snapshot is 'any' or overly broad

// Solution: Explicitly type the snapshot
const snapshot: AppState = chronicle.snapshot(state);
```

## Type Definitions Reference

### Main Types

```typescript
// Create observable
function chronicle<T extends object>(obj: T): T;

// Listen to changes
type ChangeListener = (
  path: string[],
  newValue: any,
  oldValue: any,
  meta?: ChangeMeta
) => void;

// Listener modes
type PathMode = 'exact' | 'up' | 'down';

// Listener options
interface ListenerOptions {
  once?: boolean;
  debounceMs?: number;
  throttleMs?: number;
  schedule?: 'sync' | 'microtask';
}

// Configuration
interface ChronicleOptions {
  maxHistory?: number;
  mergeUngrouped?: boolean;
  mergeWindowMs?: number;
  filter?: (change: ChangeRecord) => boolean;
}

// Diff result
interface DiffRecord {
  kind: 'added' | 'removed' | 'changed';
  path: string[];
  oldValue?: any;
  newValue?: any;
}
```

## Next Steps

Now that you understand TypeScript integration:

- **[Best Practices →](./best-practices)** - Architectural patterns and recommendations
- **[API Reference →](../api/index)** - Complete API documentation
- **[Examples →](./getting-started#common-patterns)** - Real-world usage patterns

---

**Ready for best practices?** Continue to [Best Practices](./best-practices) for architectural guidance.
