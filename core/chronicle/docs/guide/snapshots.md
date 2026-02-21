---
title: Snapshots & Diffs
description: Capture point-in-time state, compare changes, and reset to pristine conditions
keywords: snapshots, diffs, comparison, restore, immutable, state comparison, deep copy
---

# Snapshots & Diffs

Learn how to capture point-in-time state, compare changes, and reset to pristine conditions with Chronicle's snapshot and diff system.

## What are Snapshots?

A **snapshot** is a deep copy of your state at a specific moment in time. Unlike the live observable state, snapshots are plain JavaScript objects with no proxies or tracking.

```typescript
import { chronicle } from '@arcmantle/chronicle';

const state = chronicle({
  count: 0,
  user: { name: 'Alice' }
});

// Create a snapshot
const snapshot = chronicle.snapshot(state);

// Snapshot is a plain object
console.log(snapshot); // { count: 0, user: { name: 'Alice' } }
console.log(snapshot === state); // false (different objects)

// Changes to state don't affect snapshot
state.count = 10;
console.log(state.count);    // 10
console.log(snapshot.count); // 0 (unchanged)
```

## Why Use Snapshots?

### 1. State Comparison

```typescript
const before = chronicle.snapshot(state);

// Make changes
state.user.name = 'Bob';
state.user.email = 'bob@example.com';

const after = chronicle.snapshot(state);

// Compare snapshots
console.log(before); // { user: { name: 'Alice', email: '...' } }
console.log(after);  // { user: { name: 'Bob', email: '...' } }
```

### 2. Exporting State

```typescript
// Export for API, storage, or debugging
const exported = chronicle.snapshot(state);
const json = JSON.stringify(exported);

localStorage.setItem('app-state', json);
await api.saveState(exported);
```

### 3. State Restoration

```typescript
// Save a checkpoint
const checkpoint = chronicle.snapshot(state);

// Make experimental changes
state.experimental = true;
state.data = dangerousOperation();

// Restore from checkpoint
Object.assign(state, checkpoint);
```

## Creating Snapshots

### Basic Snapshot

```typescript
const snapshot = chronicle.snapshot(state);
```

The snapshot is a **deep copy** - nested objects are also copied:

```typescript
const state = chronicle({
  user: {
    profile: {
      name: 'Alice',
      settings: { theme: 'dark' }
    }
  }
});

const snapshot = chronicle.snapshot(state);

// Snapshot is completely independent
snapshot.user.profile.name = 'Changed';
console.log(state.user.profile.name); // Still 'Alice'
```

### Snapshot with Transformations

You can transform the snapshot as needed:

```typescript
function exportState(state: any) {
  const snapshot = chronicle.snapshot(state);

  // Remove sensitive data
  delete snapshot.auth;
  delete snapshot.credentials;

  // Add metadata
  return {
    version: '1.0',
    timestamp: Date.now(),
    data: snapshot
  };
}
```

## Understanding Diffs

A **diff** shows what changed between the original (pristine) state and the current state:

```typescript
const state = chronicle({
  name: 'Alice',
  age: 30,
  city: 'NYC'
});

// Make changes
state.name = 'Bob';
state.age = 31;
delete state.city;
state.country = 'USA';

// Get diff
const diff = chronicle.diff(state);
console.log(diff);
// [
//   { kind: 'changed', path: ['name'], oldValue: 'Alice', newValue: 'Bob' },
//   { kind: 'changed', path: ['age'], oldValue: 30, newValue: 31 },
//   { kind: 'removed', path: ['city'], oldValue: 'NYC' },
//   { kind: 'added', path: ['country'], newValue: 'USA' }
// ]
```

### Diff Record Structure

```typescript
interface DiffRecord {
  kind: 'added' | 'removed' | 'changed';
  path: string[];
  oldValue?: any;  // Present for 'removed' and 'changed'
  newValue?: any;  // Present for 'added' and 'changed'
}
```

### Diff Examples

#### Changed Property

```typescript
state.name = 'Bob';

const diff = chronicle.diff(state);
// [{
//   kind: 'changed',
//   path: ['name'],
//   oldValue: 'Alice',
//   newValue: 'Bob'
// }]
```

#### Added Property

```typescript
state.newField = 'value';

const diff = chronicle.diff(state);
// [{
//   kind: 'added',
//   path: ['newField'],
//   newValue: 'value'
// }]
```

#### Removed Property

```typescript
delete state.age;

const diff = chronicle.diff(state);
// [{
//   kind: 'removed',
//   path: ['age'],
//   oldValue: 30
// }]
```

#### Nested Changes

```typescript
state.user.profile.bio = 'Developer';

const diff = chronicle.diff(state);
// [{
//   kind: 'changed',  // or 'added' if bio didn't exist
//   path: ['user', 'profile', 'bio'],
//   newValue: 'Developer'
// }]
```

## Pristine State

Chronicle remembers the **pristine** (original) state when you first call `chronicle()`:

```typescript
const state = chronicle({
  count: 0,
  name: 'Alice'
});

// This is the pristine state
// { count: 0, name: 'Alice' }

// Make changes
state.count = 10;
state.name = 'Bob';

// Diff compares current to pristine
const diff = chronicle.diff(state);
// Shows count: 0→10, name: Alice→Bob
```

### Reset to Pristine

Restore the state to its original condition:

```typescript
state.count = 100;
state.name = 'Charlie';

chronicle.reset(state);

console.log(state.count); // 0 (original value)
console.log(state.name);  // 'Alice' (original value)
```

::: warning Destructive Operation
`reset()` cannot be undone with `chronicle.undo()`. It clears all history and reverts to the original snapshot taken when `chronicle()` was first called.
:::

### Checking if State is Dirty

```typescript
function isDirty(state: any): boolean {
  return chronicle.diff(state).length > 0;
}

const form = chronicle({ email: '', name: '' });

console.log(isDirty(form)); // false

form.email = 'test@example.com';
console.log(isDirty(form)); // true

chronicle.reset(form);
console.log(isDirty(form)); // false
```

## Common Patterns

### Pattern 1: Form Dirty State

```typescript
const form = chronicle({
  firstName: '',
  lastName: '',
  email: ''
});

function FormComponent() {
  const [dirty, setDirty] = useState(false);

  chronicle.onAny(form, () => {
    setDirty(chronicle.diff(form).length > 0);
  });

  function handleSave() {
    if (!dirty) return;

    const data = chronicle.snapshot(form);
    api.save(data);

    // Reset pristine to current values
    chronicle.markPristine(form);
    setDirty(false);
  }

  function handleCancel() {
    if (dirty) {
      chronicle.reset(form);
      setDirty(false);
    }
  }

  return (
    <>
      {/* Form fields */}
      <button onClick={handleSave} disabled={!dirty}>Save</button>
      <button onClick={handleCancel} disabled={!dirty}>Cancel</button>
    </>
  );
}
```

### Pattern 2: Change Summary

```typescript
function getChangeSummary(state: any): string {
  const diff = chronicle.diff(state);

  if (diff.length === 0) {
    return 'No changes';
  }

  const summary = diff.map(change => {
    const path = change.path.join('.');

    switch (change.kind) {
      case 'added':
        return `Added ${path}`;
      case 'removed':
        return `Removed ${path}`;
      case 'changed':
        return `Changed ${path}: ${change.oldValue} → ${change.newValue}`;
    }
  });

  return summary.join('\n');
}

// Usage
console.log(getChangeSummary(state));
// "Changed name: Alice → Bob"
// "Added country"
// "Removed city"
```

### Pattern 3: Unsaved Changes Warning

```typescript
window.addEventListener('beforeunload', (e) => {
  if (chronicle.diff(state).length > 0) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
});
```

### Pattern 4: API Payload Generation

```typescript
async function saveChanges(state: any) {
  const diff = chronicle.diff(state);

  if (diff.length === 0) {
    console.log('No changes to save');
    return;
  }

  // Send only changed fields
  const payload = {};
  diff.forEach(change => {
    if (change.kind !== 'removed') {
      const key = change.path.join('.');
      payload[key] = change.newValue;
    }
  });

  await api.patch('/resource', payload);

  // Mark as saved
  chronicle.markPristine(state);
}
```

### Pattern 5: State Comparison UI

```typescript
function DiffViewer({ state }: { state: any }) {
  const diff = chronicle.diff(state);

  return (
    <div>
      <h3>Changes</h3>
      {diff.length === 0 ? (
        <p>No changes</p>
      ) : (
        <ul>
          {diff.map((change, i) => (
            <li key={i}>
              <strong>{change.path.join('.')}</strong>
              {change.kind === 'added' && (
                <span> added: {JSON.stringify(change.newValue)}</span>
              )}
              {change.kind === 'removed' && (
                <span> removed: {JSON.stringify(change.oldValue)}</span>
              )}
              {change.kind === 'changed' && (
                <span>
                  : {JSON.stringify(change.oldValue)}
                  → {JSON.stringify(change.newValue)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Pattern 6: Optimistic Updates

```typescript
async function optimisticUpdate(state: any, changes: any) {
  // Save current state
  const backup = chronicle.snapshot(state);

  try {
    // Apply optimistic changes
    Object.assign(state, changes);

    // Try to save to server
    await api.save(chronicle.snapshot(state));

    // Success - update pristine
    chronicle.markPristine(state);
  } catch (error) {
    // Failed - restore backup
    Object.assign(state, backup);
    throw error;
  }
}
```

### Pattern 7: Version Comparison

```typescript
const versions = {
  v1: chronicle.snapshot(state),
  v2: null,
  v3: null
};

// Later: capture new versions
state.content = 'Updated content';
versions.v2 = chronicle.snapshot(state);

state.content = 'Final content';
versions.v3 = chronicle.snapshot(state);

// Compare versions
function compareVersions(v1: any, v2: any) {
  // Custom comparison logic
  return Object.keys(v2).filter(key => v1[key] !== v2[key]);
}
```

## Advanced Snapshot Techniques

### Partial Snapshots

Snapshot only part of the state:

```typescript
function snapshotPath(state: any, path: string): any {
  const parts = path.split('.');
  let current = state;

  for (const part of parts) {
    current = current[part];
    if (current === undefined) return undefined;
  }

  // Create snapshot of just this part
  return JSON.parse(JSON.stringify(current));
}

// Usage
const userSnapshot = snapshotPath(state, 'user');
const settingsSnapshot = snapshotPath(state, 'settings');
```

### Selective Diff

Compare only specific paths:

```typescript
function diffPaths(state: any, paths: string[]): DiffRecord[] {
  const allDiffs = chronicle.diff(state);

  return allDiffs.filter(diff =>
    paths.some(path =>
      diff.path.join('.').startsWith(path)
    )
  );
}

// Usage: Only check user-related changes
const userDiffs = diffPaths(state, ['user']);
```

### Snapshot Equality

Check if two snapshots are equal:

```typescript
function snapshotsEqual(snap1: any, snap2: any): boolean {
  return JSON.stringify(snap1) === JSON.stringify(snap2);
}

const snap1 = chronicle.snapshot(state);
state.value = 42;
const snap2 = chronicle.snapshot(state);

console.log(snapshotsEqual(snap1, snap2)); // false
```

::: warning Limitation
This simple equality check doesn't handle:

- Functions
- Symbols
- Circular references
- Property order differences
- Special objects (Date, RegExp, etc.)

For robust comparison, use a deep-equal library.
:::

## Performance Considerations

### Snapshot Cost

Creating snapshots has a cost proportional to state size:

```typescript
// Small state: ~0.1ms
const small = chronicle({ count: 0 });
const snap1 = chronicle.snapshot(small);

// Large state: ~10ms
const large = chronicle({
  items: new Array(10000).fill(0).map((_, i) => ({ id: i, data: {...} }))
});
const snap2 = chronicle.snapshot(large);
```

### Optimization: Lazy Snapshots

Only create snapshots when needed:

```typescript
// ❌ Wasteful: Creates snapshot every change
chronicle.onAny(state, () => {
  const snapshot = chronicle.snapshot(state);
  checkChanges(snapshot);
});

// ✅ Better: Only snapshot when checking
function saveIfDirty(state: any) {
  if (chronicle.diff(state).length > 0) {
    const snapshot = chronicle.snapshot(state);
    api.save(snapshot);
  }
}
```

### Optimization: Memoized Snapshots

Cache snapshots until state changes:

```typescript
let cachedSnapshot: any = null;
let lastChangeCount = 0;

function getMemoizedSnapshot(state: any) {
  const history = chronicle.getHistory(state);
  const currentCount = history.past.length;

  if (cachedSnapshot === null || currentCount !== lastChangeCount) {
    cachedSnapshot = chronicle.snapshot(state);
    lastChangeCount = currentCount;
  }

  return cachedSnapshot;
}
```

## Diff Performance

Diff calculation traverses the entire state tree:

```typescript
// Small state: ~0.1ms
chronicle.diff(smallState);

// Large nested state: ~50ms
chronicle.diff(largeNestedState);
```

### Optimization: Diff Caching

Cache diff results:

```typescript
let cachedDiff: DiffRecord[] | null = null;
let lastHistoryLength = 0;

function getCachedDiff(state: any): DiffRecord[] {
  const history = chronicle.getHistory(state);
  const currentLength = history.past.length;

  if (cachedDiff === null || currentLength !== lastHistoryLength) {
    cachedDiff = chronicle.diff(state);
    lastHistoryLength = currentLength;
  }

  return cachedDiff;
}
```

## Debugging

### Visualize Diff

```typescript
function visualizeDiff(state: any) {
  const diff = chronicle.diff(state);

  console.group('State Diff');
  diff.forEach(change => {
    const path = change.path.join('.');

    switch (change.kind) {
      case 'added':
        console.log(`%c+ ${path}`, 'color: green', change.newValue);
        break;
      case 'removed':
        console.log(`%c- ${path}`, 'color: red', change.oldValue);
        break;
      case 'changed':
        console.log(`%c~ ${path}`, 'color: orange',
          `${change.oldValue} → ${change.newValue}`);
        break;
    }
  });
  console.groupEnd();
}
```

### Track Snapshot Creation

```typescript
const originalSnapshot = chronicle.snapshot;
let snapshotCount = 0;

chronicle.snapshot = function(state: any) {
  snapshotCount++;
  console.log(`[Snapshot #${snapshotCount}]`);
  return originalSnapshot(state);
};
```

## Next Steps

Now that you understand snapshots and diffs, explore advanced topics:

- **[Performance →](./performance)** - Optimize snapshot and diff usage
- **[TypeScript →](./typescript)** - Type-safe snapshots and diffs
- **[Best Practices →](./best-practices)** - Architectural patterns
- **[API Reference →](../api/index)** - Complete API documentation

---

**Ready to optimize?** Continue to [Performance](./performance) to learn optimization techniques.
