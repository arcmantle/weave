---
title: Batching & Transactions
description: Group multiple changes into atomic operations for better performance
keywords: batching, transactions, performance, optimization, bulk updates, atomic operations
---

# Batching & Transactions

Learn how to group multiple changes into atomic operations for better undo/redo behavior and improved performance.

## When to Use Batching

```mermaid
graph TD
    A[Making changes?] -->|Single change| B[No batching needed]
    A -->|Multiple changes| C{Are changes related?}

    C -->|Yes, same logical operation| D[Use batch\\(\\)]
    C -->|No, independent| E[Keep separate]

    D --> F{How many changes?}
    F -->|2-10 changes| G[batch\\(\\) for clean undo]
    F -->|10-100 changes| H[batch\\(\\) for performance]
    F -->|100+ changes| I[batch\\(\\) is critical!]

    style D fill:#c8e6c9
    style G fill:#a5d6a7
    style H fill:#81c784
    style I fill:#66bb6a
    style E fill:#fff9c4
```

**Examples of when to batch:**

- ✅ Form submission (multiple field updates)
- ✅ Bulk data import
- ✅ Complex UI interactions (drag & drop with multiple updates)
- ✅ Synchronizing related state (cart items + total + tax)
- ❌ Independent user actions (separate button clicks)

## Why Batch Changes?

When you make multiple related changes, batching provides two key benefits:

### 1. Atomic Undo/Redo

```typescript
// Without batching: 3 separate undo operations
cart.items.push({ id: 1, name: 'Apple', price: 1.50 });
cart.total = 1.50;
cart.count = 1;

chronicle.undo(cart); // Only undoes count ❌
chronicle.undo(cart); // Only undoes total ❌
chronicle.undo(cart); // Only undoes items ❌

// With batching: 1 undo operation
chronicle.batch(cart, (state) => {
  state.items.push({ id: 1, name: 'Apple', price: 1.50 });
  state.total = 1.50;
  state.count = 1;
});

chronicle.undo(cart); // Undoes all three! ✅
```

### 2. Performance Optimization

```typescript
// Without batching: Listeners fire 1000 times
for (let i = 0; i < 1000; i++) {
  state.items.push(i);
  // Listener fires after each push 😫
}

// With batching: Listeners fire ONCE
chronicle.batch(state, (s) => {
  for (let i = 0; i < 1000; i++) {
    s.items.push(i);
  }
  // Listeners fire once after batch 🎉
});
```

## Basic Batching

### The `batch()` Function

Group synchronous changes into one atomic operation:

```typescript
import { chronicle } from '@arcmantle/chronicle';

const state = chronicle({
  firstName: '',
  lastName: '',
  fullName: ''
});

// Batch multiple changes
chronicle.batch(state, (s) => {
  s.firstName = 'John';
  s.lastName = 'Doe';
  s.fullName = `${s.firstName} ${s.lastName}`;
});

// One undo reverts all changes
chronicle.undo(state);
console.log(state.firstName); // ''
console.log(state.lastName);  // ''
console.log(state.fullName);  // ''
```

### Batch Callback Parameter

The callback receives the state object:

```typescript
chronicle.batch(state, (s) => {
  // 's' is the same as 'state'
  s.count++;
  s.lastModified = Date.now();
});

// You can also use 'state' directly
chronicle.batch(state, () => {
  state.count++;
  state.lastModified = Date.now();
});
```

::: tip Prefer the Parameter
Using the callback parameter `(s) =>` makes it clear which state is being modified and helps with nested batches.
:::

### Return Values

Batches can return values:

```typescript
const result = chronicle.batch(state, (s) => {
  s.items.push({ id: 1, name: 'Item 1' });
  s.items.push({ id: 2, name: 'Item 2' });

  return s.items.length; // Return the count
});

console.log(result); // 2
```

## Nested Batches

Batches can be nested - inner batches are merged into outer ones:

```typescript
const state = chronicle({
  user: { name: '', email: '' },
  settings: { theme: 'light' }
});

chronicle.batch(state, () => {
  state.user.name = 'Alice';

  // Inner batch merges into outer
  chronicle.batch(state, () => {
    state.user.email = 'alice@example.com';
    state.settings.theme = 'dark';
  });
});

// One undo reverts all three changes
chronicle.undo(state);
```

### Visual Representation

```text
Outer Batch Start
├─ Change: user.name = 'Alice'
├─ Inner Batch Start
│  ├─ Change: user.email = 'alice@example.com'
│  └─ Change: settings.theme = 'dark'
└─ Inner Batch End
Outer Batch End

Result: One history entry with 3 changes
```

## Async Transactions

For asynchronous operations, use `transaction()`:

### Basic Transaction

```typescript
await chronicle.transaction(state, async (s) => {
  // Fetch data
  const user = await fetchUser(123);
  s.user = user;

  // Fetch more data
  const settings = await fetchSettings(user.id);
  s.settings = settings;
});

// One undo reverts both changes
chronicle.undo(state);
```

### Error Handling

Transactions automatically rollback on error:

```typescript
try {
  await chronicle.transaction(state, async (s) => {
    s.step = 1;
    await saveToServer(s.data);

    s.step = 2;
    await sendNotification();

    s.step = 3;
    throw new Error('Oops!'); // Error!
  });
} catch (error) {
  // Transaction rolled back automatically
  console.log(state.step); // 0 (original value)
}
```

::: warning Manual Rollback
Chronicle currently does **not** automatically rollback transactions on error. You need to implement rollback logic manually if needed.
:::

### Transaction vs Batch

```typescript
// ✅ Use batch() for synchronous changes
chronicle.batch(state, (s) => {
  s.count++;
  s.total = s.count * 10;
});

// ✅ Use transaction() for async changes
await chronicle.transaction(state, async (s) => {
  const data = await fetchData();
  s.data = data;
  s.loaded = true;
});

// ❌ Don't use batch() with async
chronicle.batch(state, async (s) => {
  // Batch ends immediately, not after await!
  const data = await fetchData();
  s.data = data; // This is NOT in the batch!
});
```

## Listener Behavior

### Deferred Notifications

Listeners don't fire until the batch completes:

```typescript
chronicle.listen(state, 'count', (path, newVal) => {
  console.log('Count:', newVal);
});

chronicle.batch(state, () => {
  state.count = 1; // Listener doesn't fire yet
  state.count = 2; // Listener doesn't fire yet
  state.count = 3; // Listener doesn't fire yet
});

// Listener fires ONCE here with value 3
```

### Multiple Path Changes

If the same path changes multiple times, listeners fire with the final value:

```typescript
chronicle.listen(state, 'value', (path, newVal, oldVal) => {
  console.log(`${oldVal} → ${newVal}`);
});

chronicle.batch(state, () => {
  state.value = 1;
  state.value = 2;
  state.value = 3;
});

// Logs: "0 → 3" (not 0→1, 1→2, 2→3)
```

### 'down' Mode Listeners

Listeners in 'down' mode fire once for each changed descendant:

```typescript
chronicle.listen(state, 'user', (path) => {
  console.log('Changed:', path.join('.'));
}, 'down');

chronicle.batch(state, () => {
  state.user.name = 'Alice';
  state.user.email = 'alice@example.com';
  state.user.age = 30;
});

// Fires 3 times:
// "Changed: user.name"
// "Changed: user.email"
// "Changed: user.age"
```

## Common Patterns

### Pattern 1: Form Submission

```typescript
async function submitForm(state: FormState) {
  await chronicle.transaction(state, async (s) => {
    s.submitting = true;
    s.error = null;

    try {
      const result = await api.submitForm({
        name: s.name,
        email: s.email,
        message: s.message
      });

      s.submitted = true;
      s.submitId = result.id;
    } catch (error) {
      s.error = error.message;
      throw error; // Rollback
    } finally {
      s.submitting = false;
    }
  });
}
```

### Pattern 2: Multi-Step Wizard

```typescript
function completeWizard(state: WizardState) {
  chronicle.batch(state, (s) => {
    s.completed = true;
    s.completedAt = Date.now();
    s.currentStep = s.steps.length;

    // Compute summary
    s.summary = {
      duration: s.completedAt - s.startedAt,
      steps: s.steps.length,
      data: gatherData(s)
    };
  });
}
```

### Pattern 3: Bulk Operations

```typescript
function deleteSelectedItems(state: AppState, selectedIds: number[]) {
  chronicle.batch(state, (s) => {
    s.items = s.items.filter(item => !selectedIds.includes(item.id));
    s.selectedCount = 0;
    s.lastAction = 'bulk-delete';
    s.deletedCount += selectedIds.length;
  });
}
```

### Pattern 4: Computed Properties

```typescript
function updateCartItem(cart: Cart, itemId: number, quantity: number) {
  chronicle.batch(cart, (c) => {
    const item = c.items.find(i => i.id === itemId);
    if (!item) return;

    item.quantity = quantity;

    // Recompute totals
    c.subtotal = c.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    c.tax = c.subtotal * c.taxRate;
    c.total = c.subtotal + c.tax;
  });
}
```

### Pattern 5: State Synchronization

```typescript
async function syncFromServer(state: AppState) {
  const data = await fetchFromServer();

  chronicle.batch(state, (s) => {
    // Update multiple parts of state
    s.users = data.users;
    s.posts = data.posts;
    s.comments = data.comments;
    s.lastSync = Date.now();
    s.syncStatus = 'complete';
  });
}
```

## Manual Group Control

For advanced use cases, manually control history groups:

### Start and End Groups

```typescript
// Start a group
const groupId = chronicle.startGroup(state);

try {
  state.step = 1;
  await doSomething();

  state.step = 2;
  await doSomethingElse();

  state.step = 3;
} finally {
  // End the group
  chronicle.endGroup(state, groupId);
}

// One undo reverts all changes
chronicle.undo(state);
```

### Conditional Grouping

```typescript
const shouldGroup = items.length > 10;
const groupId = shouldGroup ? chronicle.startGroup(state) : null;

for (const item of items) {
  state.items.push(item);
  state.count++;
}

if (groupId) {
  chronicle.endGroup(state, groupId);
}
```

::: tip Prefer batch() and transaction()
Manual group control is rarely needed. Use `batch()` or `transaction()` for most cases.
:::

## Auto-Batching Configuration

Configure Chronicle to automatically batch rapid changes:

```typescript
chronicle.configure(state, {
  mergeUngrouped: true,  // Enable auto-batching
  mergeWindowMs: 100     // Merge changes within 100ms
});

// Rapid changes are automatically grouped
state.searchQuery = 'h';
state.searchQuery = 'he';
state.searchQuery = 'hel';
state.searchQuery = 'hello';

// After 100ms, all changes merge into one undo
```

### How It Works

```text
      └─ h   └─ he  └─ hel └─hello

Wait 100ms after last change...

Result: One history entry with all 4 changes
```

### When to Use Auto-Batching

**Good use cases:**

- Search inputs
- Sliders and range inputs
- Real-time text editing
- Canvas drawing

**Avoid for:**

- User-triggered actions (button clicks)
- API responses
- Important state transitions

## Batching Best Practices

### ✅ Do: Group Related Changes

```typescript
// ✅ Good: Related changes grouped
chronicle.batch(state, (s) => {
  s.user.name = newName;
  s.user.updatedAt = Date.now();
  s.user.updatedBy = currentUser;
});
```

### ❌ Don't: Batch Unrelated Changes

```typescript
// ❌ Bad: Unrelated changes grouped
chronicle.batch(state, (s) => {
  s.user.name = 'Alice';
  s.theme = 'dark';
  s.language = 'en';
  // These aren't related!
});
```

### ✅ Do: Use Batching for Performance

```typescript
// ✅ Good: Batch for performance
chronicle.batch(state, (s) => {
  for (let i = 0; i < 1000; i++) {
    s.items.push({ id: i, value: Math.random() });
  }
});
```

### ❌ Don't: Batch Single Changes

```typescript
// ❌ Bad: Unnecessary batch
chronicle.batch(state, (s) => {
  s.count++; // Just do: state.count++
});
```

### ✅ Do: Return Values from Batches

```typescript
// ✅ Good: Return computed result
const success = chronicle.batch(state, (s) => {
  if (!validate(s)) return false;

  s.submitted = true;
  s.submittedAt = Date.now();
  return true;
});
```

### ✅ Do: Use Transactions for Async

```typescript
// ✅ Good: Transaction for async
await chronicle.transaction(state, async (s) => {
  const data = await fetchData();
  s.data = data;
  s.loaded = true;
});
```

## Performance Impact

### Batching Overhead

Batching has minimal overhead:

```typescript
// Without batching: ~1000 operations
for (let i = 0; i < 1000; i++) {
  state.items.push(i);
}

// With batching: ~1 operation + batch overhead
chronicle.batch(state, (s) => {
  for (let i = 0; i < 1000; i++) {
    s.items.push(i);
  }
});
```

**Benchmark results:**

- Single change: ~0.01ms
- Batched 1000 changes: ~0.5ms (50x faster than individual)
- Listener calls reduced from 1000 to 1

### Memory Benefits

```typescript
// Without batching: 1000 history entries
for (let i = 0; i < 1000; i++) {
  state.value = i;
}
// Memory: ~50KB

// With batching: 1 history entry
chronicle.batch(state, (s) => {
  for (let i = 0; i < 1000; i++) {
    s.value = i;
  }
});
// Memory: ~50 bytes (1000x less!)
```

## Debugging Batches

### Log Batch Operations

```typescript
const originalBatch = chronicle.batch;

chronicle.batch = function(state, callback) {
  console.log('[Batch] Start');
  const result = originalBatch(state, callback);
  console.log('[Batch] End');
  return result;
};
```

### Track Batch Depth

```typescript
let batchDepth = 0;

chronicle.batch = function(state, callback) {
  batchDepth++;
  console.log(`[Batch] Depth: ${batchDepth}`);

  try {
    return originalBatch(state, callback);
  } finally {
    batchDepth--;
  }
};
```

### Measure Batch Performance

```typescript
function timedBatch<T>(state: T, callback: (state: T) => void) {
  const start = performance.now();
  const result = chronicle.batch(state, callback);
  const end = performance.now();

  console.log(`Batch took ${(end - start).toFixed(2)}ms`);
  return result;
}
```

## Next Steps

Now that you understand batching, learn about state snapshots and comparisons:

- **[Snapshots & Diffs →](./snapshots)** - Compare and restore states
- **[Performance →](./performance)** - Optimize batching strategies
- **[Best Practices →](./best-practices)** - Architectural patterns
- **[API Reference →](../api/index)** - Complete API documentation

---

**Ready for snapshots?** Continue to [Snapshots & Diffs](./snapshots) to learn about state comparisons.
