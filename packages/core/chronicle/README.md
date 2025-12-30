# Chronicle - Deep Observable State with Time-Travel

Chronicle is a powerful state observation library that provides deep proxy-based tracking, history recording, undo/redo capabilities, and time-travel debugging for JavaScript objects.

## Features

- **Deep Observation**: Automatically tracks changes to nested objects, arrays, Maps, and Sets
- **Time-Travel Debugging**: Full undo/redo with group-based operations
- **Flexible Listeners**: Listen to specific paths with exact, descendant, or ancestor modes
- **Batching & Transactions**: Group multiple changes into atomic, undoable operations
- **Smart History**: Configurable history size, filtering, and compaction
- **Diff & Snapshots**: Compare current state to original, reset to pristine
- **Quality of Life**: Debounce, throttle, once listeners, pause/resume notifications

## Quick Start

```typescript
import { chronicle } from './chronicle.ts';

// Observe an object
const state = chronicle({ count: 0, user: { name: 'Alice' } });

// Listen to changes (string selector)
chronicle.listen(state, 'count', (path, newValue, oldValue) => {
  console.log(`Count changed from ${oldValue} to ${newValue}`);
});

// Or use a function selector for better type safety
chronicle.listen(state, s => s.count, (path, newValue, oldValue) => {
  console.log(`Count changed from ${oldValue} to ${newValue}`);
});

// Make changes
state.count = 1; // Listener fires: "Count changed from 0 to 1"

// Undo
chronicle.undo(state);
console.log(state.count); // 0
```

## Core API

### `chronicle(object)`

Wraps an object with deep observation. Returns a proxy that tracks all changes.

```typescript
const observed = chronicle({ items: [], settings: { theme: 'dark' } });
```

### Listeners

#### `chronicle.listen(object, selector, listener, mode?, options?)`

Listen to changes at a specific path.

**Modes:**

- `'exact'` (default): Only changes to this exact path
- `'down'`: Changes to this path and all descendants
- `'up'`: Changes to any ancestor of this path

**Selector types:**

- String: `'user.name'` or `'items.0'`
- Array: `['user', 'name']` or `['items', 0]`
- Function: `obj => obj.user.name` (uses `nameof` utility)

**Options:**

- `once: boolean` - Auto-unsubscribe after first call
- `debounceMs: number` - Coalesce rapid changes
- `throttleMs: number` - Limit call frequency
- `schedule: 'sync' | 'microtask'` - When to deliver notifications

```typescript
// Listen to exact path (string selector)
chronicle.listen(state, 'count', (path, newVal, oldVal, meta) => {
  console.log('Count changed:', newVal);
});

// Or use a function selector for type safety
chronicle.listen(state, s => s.count, (path, newVal, oldVal, meta) => {
  console.log('Count changed:', newVal);
});

// Listen to all descendants
chronicle.listen(state, 'user', (path) => {
  console.log('User changed at:', path);
}, 'down');

// Function selector with descendant mode
chronicle.listen(state, s => s.user, (path) => {
  console.log('User changed at:', path);
}, 'down');

// Debounced listener
chronicle.listen(state, s => s.searchQuery, handleSearch, {
  debounceMs: 300
});

// Throttled listener
chronicle.listen(state, s => s.mousePosition, updateUI, {
  throttleMs: 16 // ~60fps
});

// One-time listener
chronicle.listen(state, s => s.initialized, () => {
  console.log('App initialized!');
}, { once: true });
```

#### `chronicle.onAny(object, listener, options?)`

Listen to all changes on the object.

```typescript
chronicle.onAny(state, (path, newVal, oldVal, meta) => {
  console.log('Changed:', path, 'type:', meta.type);
});
```

### Pause/Resume

```typescript
// Pause notifications (queues them)
chronicle.pause(state);

state.count = 1;
state.count = 2;
state.count = 3; // No listeners fired yet

// Resume and deliver all queued notifications
chronicle.resume(state);

// Or just flush without resuming
chronicle.flush(state);
```

### History

```typescript
// Get full history
const history = chronicle.getHistory(state);
// [{ path: ['count'], type: 'set', oldValue: 0, newValue: 1, ... }]

// Clear history
chronicle.clearHistory(state);

// Mark current point for undo
const marker = chronicle.mark(state);
// ... make changes ...
chronicle.undoSince(state, marker);
```

### Undo/Redo

```typescript
// Undo individual steps
chronicle.undo(state, 3); // Undo last 3 changes

// Undo by groups (batches/transactions)
chronicle.undoGroups(state, 1); // Undo last batch

// Redo
chronicle.redo(state, 2);
chronicle.redoGroups(state, 1);

// Check availability
if (chronicle.canUndo(state)) {
  chronicle.undo(state);
}

if (chronicle.canRedo(state)) {
  chronicle.redo(state);
}

// Clear redo stack
chronicle.clearRedo(state);
```

### Batching

Group multiple changes into a single undoable operation.

```typescript
// Manual batching
chronicle.beginBatch(state);
state.items.push('item1');
state.items.push('item2');
state.count = 2;
chronicle.commitBatch(state);

// Now undo reverts all 3 changes as one
chronicle.undoGroups(state, 1);

// Or rollback to discard changes
chronicle.beginBatch(state);
state.count = 999;
chronicle.rollbackBatch(state); // Changes discarded

// Convenience wrapper
chronicle.batch(state, (s) => {
  s.items.push('item1');
  s.items.push('item2');
  s.count = 2;
}); // Auto-commits

// Batch with error handling
try {
  chronicle.batch(state, (s) => {
    s.count = 1;
    throw new Error('Something went wrong');
  });
} catch (e) {
  // Batch auto-rolled back on error
}
```

### Transactions

Transactions are batches with convenient undo helpers.

```typescript
// Sync transaction
const { result, marker, undo } = chronicle.transaction(state, (s) => {
  s.user.name = 'Bob';
  s.user.email = 'bob@example.com';
  return s.user;
});

// Later, undo this specific transaction
undo();

// Async transaction
const { result, undo } = await chronicle.transactionAsync(state, async (s) => {
  s.loading = true;
  const data = await fetchData();
  s.data = data;
  s.loading = false;
  return data;
});

// Nested transactions coalesce
chronicle.transaction(state, (s) => {
  s.count = 1;
  chronicle.transaction(s, (s2) => {
    s2.count = 2; // Both changes in one group
  });
});
// Undo undoes both changes
```

### Diff & Reset

```typescript
const original = { count: 0, items: ['a'] };
const state = chronicle(original);

state.count = 5;
state.items.push('b');

// Get differences
const diff = chronicle.diff(state);
// [
//   { path: ['count'], kind: 'changed', oldValue: 0, newValue: 5 },
//   { path: ['items', '1'], kind: 'added', newValue: 'b' }
// ]

// Check if pristine
console.log(chronicle.isPristine(state)); // false

// Reset to original
chronicle.reset(state);
console.log(state.count); // 0
console.log(state.items); // ['a']

// Mark new pristine point
state.count = 10;
chronicle.markPristine(state);
console.log(chronicle.isPristine(state)); // true
```

### Configuration

```typescript
chronicle.configure(state, {
  // Limit history size (trims by whole groups)
  maxHistory: 100,

  // Filter which changes to record
  filter: (record) => !record.path.includes('_temp'),

  // Merge ungrouped changes within time window
  mergeUngrouped: true,
  mergeWindowMs: 100,

  // Compact consecutive sets to same path
  compactConsecutiveSamePath: true,

  // Enable proxy caching for stable identity
  cacheProxies: true,

  // Custom clone function (default: structuredClone)
  clone: (value) => JSON.parse(JSON.stringify(value)),

  // Custom equality check (default: Object.is)
  compare: (a, b) => a === b,

  // Filter diff traversal
  diffFilter: (path) => {
    if (path[0] === '_internal') return false; // Skip
    if (path[0] === 'large') return 'shallow'; // Don't recurse
    return true; // Recurse normally
  }
});
```

## Working with Collections

### Arrays

Arrays work seamlessly with all features. Deleting by index uses splice to avoid holes.

```typescript
const state = chronicle({ items: ['a', 'b', 'c'] });

state.items.push('d');
state.items[1] = 'B';
delete state.items[2]; // Uses splice internally

chronicle.undo(state); // Restores 'c' at index 2
```

### Maps

```typescript
const state = chronicle({ cache: new Map() });

state.cache.set('key1', 'value1');
state.cache.set('key2', 'value2');
state.cache.delete('key1');
state.cache.clear();

// Listen to map changes
chronicle.listen(state, 'cache', (path, newVal, oldVal, meta) => {
  console.log('Map operation:', meta.type);
  // meta contains: { collection: 'map', key: 'key1' }
});

// Undo works correctly
chronicle.undoGroups(state, 1); // Undoes entire clear
```

### Sets

```typescript
const state = chronicle({ tags: new Set() });

state.tags.add('javascript');
state.tags.add('typescript');
state.tags.delete('javascript');

chronicle.undo(state); // Restores 'javascript'
```

## Common Patterns

### Todo List with Undo

```typescript
const todos = chronicle({
  items: [],
  filter: 'all'
});

function addTodo(text) {
  chronicle.batch(todos, (state) => {
    state.items.push({
      id: Date.now(),
      text,
      completed: false
    });
  });
}

function toggleTodo(id) {
  const todo = todos.items.find(t => t.id === id);
  if (todo) todo.completed = !todo.completed;
}

function deleteTodo(id) {
  const index = todos.items.findIndex(t => t.id === id);
  if (index !== -1) todos.items.splice(index, 1);
}

// Undo last action
chronicle.undoGroups(todos, 1);
```

### Form State with Validation

```typescript
const form = chronicle({
  values: { email: '', password: '' },
  errors: {},
  touched: {},
  isValid: true
});

// Debounced validation
chronicle.listen(form, 'values', (path) => {
  validateForm();
}, 'down', { debounceMs: 300 });

function validateForm() {
  const errors = {};
  if (!form.values.email.includes('@')) {
    errors.email = 'Invalid email';
  }
  form.errors = errors;
  form.isValid = Object.keys(errors).length === 0;
}

// Transaction for submit
async function submitForm() {
  const { result, undo } = await chronicle.transactionAsync(form, async (f) => {
    f.submitting = true;
    try {
      const result = await api.post('/submit', f.values);
      f.submitSuccess = true;
      return result;
    } catch (error) {
      f.submitError = error.message;
      throw error;
    } finally {
      f.submitting = false;
    }
  });
  return result;
}
```

### Collaborative Editor

```typescript
const doc = chronicle({
  content: '',
  cursors: new Map(),
  version: 0
});

// Batch local edits
let editBatch = null;
function startEdit() {
  if (!editBatch) {
    chronicle.beginBatch(doc);
    editBatch = setTimeout(() => {
      chronicle.commitBatch(doc);
      editBatch = null;
    }, 1000);
  }
}

function insert(pos, text) {
  startEdit();
  doc.content = doc.content.slice(0, pos) + text + doc.content.slice(pos);
  doc.version++;
}

// Listen for remote changes
chronicle.listen(doc, 'content', (path, newVal) => {
  broadcastToRemote({ content: newVal, version: doc.version });
}, { debounceMs: 100 });
```

## Performance Tips

1. **Use batching** for bulk operations to reduce listener overhead
2. **Enable proxy caching** for frequently accessed nested objects
3. **Use debounce/throttle** for high-frequency updates
4. **Filter history** to exclude temporary/internal state
5. **Set maxHistory** to prevent unbounded growth
6. **Use 'exact' mode** when possible (faster than 'down'/'up')

## Gotchas & Best Practices

### Listener Path Modes

```typescript
const state = chronicle({ user: { profile: { name: 'Alice' } } });

// 'exact': Only fires when 'user' is reassigned
chronicle.listen(state, 'user', handler, 'exact');
state.user = {}; // Fires
state.user.profile.name = 'Bob'; // Does NOT fire

// 'down': Fires for user and all nested changes
chronicle.listen(state, 'user', handler, 'down');
state.user = {}; // Fires
state.user.profile.name = 'Bob'; // Fires

// 'up': Fires when any ancestor changes
chronicle.listen(state, ['user', 'profile', 'name'], handler, 'up');
state.user.profile.name = 'Bob'; // Does NOT fire (not an ancestor)
state.user.profile = {}; // Fires (ancestor)
state.user = {}; // Fires (ancestor)
```

### Array Length Changes

When shrinking arrays, deletes are synthesized for removed elements:

```typescript
const state = chronicle({ items: [1, 2, 3, 4] });
state.items.length = 2; // Generates delete records for indices 2 and 3
```

### Redo is Cleared

Making any forward change clears the redo stack:

```typescript
chronicle.undo(state); // Can now redo
state.count = 5; // Clears redo stack
chronicle.redo(state); // Does nothing
```

### Avoid Recording Internal Operations

```typescript
// Bad: Will record intermediate array operations
state.items.push(...largeArray);

// Better: Use batch to group
chronicle.batch(state, (s) => {
  s.items.push(...largeArray);
});

// Best: Filter out internal paths
chronicle.configure(state, {
  filter: (rec) => !rec.path[0].startsWith('_')
});
state._tempData = []; // Not recorded
```

## TypeScript Support

Chronicle is fully typed and preserves object types:

```typescript
interface User {
  name: string;
  age: number;
}

const user: User = chronicle({ name: 'Alice', age: 30 });
// user is still typed as User, all properties autocomplete
```

## License

Apache-2

..
