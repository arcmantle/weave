# Introduction

## What is @weave/changelog?

`@weave/changelog` is a lightweight, framework-agnostic library for tracking and managing changes to JavaScript objects over time. Think of it as a **version control system for your application state** — it automatically captures what changed, when it changed, and provides powerful features for grouping, querying, and replaying changes.

## The Problem It Solves

When building collaborative applications, real-time editors, or any application that needs to track state changes, you typically face several challenges:

1. **Change Tracking**: How do you know what changed between two states?
2. **History Management**: How do you maintain a complete history of changes?
3. **Undo/Redo**: How do you implement reliable undo/redo functionality?
4. **Collaboration**: How do you track who made what changes?
5. **State Synchronization**: How do you sync changes across different clients or sessions?

`@weave/changelog` solves these problems by providing:

- **Automatic diff computation** between old and new states
- **Persistent change history** with flexible storage backends (IndexedDB, in-memory, or custom)
- **Change grouping** (similar to git commits) for logical batching of related changes
- **Fine-grained change records** with paths to specific properties
- **Transaction support** with rollback capabilities

## Core Concepts

### Change Records

Every modification to your document state is captured as a `ChangeRecord`:

```typescript
interface ChangeRecord {
  path: string[];           // Path to the changed value
  type: 'set' | 'delete';   // Type of operation
  oldValue: any;            // Previous value
  newValue: any;            // New value
  timestamp: number;        // When it happened
  groupId?: string;         // Optional group identifier
}
```

### Change Groups

Changes can be grouped together (like git commits) with optional metadata:

```typescript
interface ChangeGroup {
  id: string;               // Unique identifier
  timestamp: number;        // When the group was created
  changeCount: number;      // Number of changes in this group
  metadata?: {              // User-defined metadata
    author?: string;
    message?: string;
    // ... any custom fields
  };
}
```

### Storage Backends

The library supports multiple storage backends through a simple interface:

- **IndexedDB Storage**: Persistent storage in the browser
- **Memory Storage**: Fast in-memory storage for testing or temporary state
- **Custom Storage**: Implement your own storage backend

## Basic Usage

### Setting Up

```typescript
import { Changelog } from '@weave/changelog';
import { IndexedDBStorage } from '@weave/changelog/storage';

// Create a storage backend
const storage = new IndexedDBStorage('my-app');

// Create a changelog instance for a specific document
const changelog = new Changelog(storage, 'document-1');
```

### Tracking Changes

The simplest way to track changes is with `applyChanges`:

```typescript
// Initial state
await changelog.setDocument({
  title: 'My Document',
  content: 'Hello world'
});

// Make changes - the library automatically computes the diff
await changelog.applyChanges({
  title: 'My Document',
  content: 'Hello world! Updated content.'
});

// Get the change history
const history = await changelog.getHistory();
console.log(history);
// [{
//   path: ['content'],
//   type: 'set',
//   oldValue: 'Hello world',
//   newValue: 'Hello world! Updated content.',
//   timestamp: 1704067200000,
//   groupId: 'g1'
// }]
```

### Grouping Changes (Batching)

Group multiple changes together with metadata:

```typescript
// Start a new change group
const groupId = await changelog.beginGroup({
  author: 'user@example.com',
  message: 'Update document metadata'
});

// Make multiple changes
await changelog.applyChanges({
  title: 'Updated Title',
  content: 'Hello world',
  metadata: { tags: ['important', 'draft'] }
});

await changelog.applyChanges({
  title: 'Updated Title',
  content: 'Hello world',
  metadata: { tags: ['important', 'draft'], version: 2 }
});

// Commit the group
await changelog.commitGroup();

// All changes are now grouped under a single ID
const groups = await changelog.getGroups();
console.log(groups);
// [{
//   id: 'g1',
//   timestamp: 1704067200000,
//   changeCount: 2,
//   metadata: {
//     author: 'user@example.com',
//     message: 'Update document metadata'
//   }
// }]
```

### Rollback Support

Undo changes by rolling back a group:

```typescript
const groupId = await changelog.beginGroup({
  message: 'Experimental changes'
});

await changelog.applyChanges({
  title: 'Risky Update',
  experimental: true
});

// Oops, let's not save this
await changelog.rollbackGroup();

// Document state is restored to before beginGroup()
const doc = await changelog.getDocument();
console.log(doc.experimental); // undefined
```

## Advanced Features

### Querying Change History

Filter changes by timestamp or group:

```typescript
// Get changes since a specific timestamp
const recentChanges = await changelog.getHistory({
  since: Date.now() - 3600000 // last hour
});

// Get changes for a specific group
const groupChanges = await changelog.getHistory({
  groupId: 'g1'
});

// Limit number of results
const latest = await changelog.getHistory({
  limit: 10
});
```

### Custom Diff Comparison

Provide custom equality logic for specialized types:

```typescript
import { diff } from '@weave/changelog';

const oldState = { items: [1, 2, 3] };
const newState = { items: [1, 2, 4] };

const differences = diff(oldState, newState, {
  compare: (a, b, path) => {
    // Custom comparison logic
    if (path.includes('items')) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return Object.is(a, b);
  }
});
```

### Applying Diffs Programmatically

You can compute and apply diffs independently:

```typescript
import { diff, applyDiff } from '@weave/changelog';

const oldDoc = { count: 0, name: 'test' };
const newDoc = { count: 5, name: 'test' };

// Compute the diff
const differences = diff(oldDoc, newDoc);
// [{ path: ['count'], kind: 'changed', oldValue: 0, newValue: 5 }]

// Apply the diff to another object
const result = applyDiff(oldDoc, differences);
console.log(result); // { count: 5, name: 'test' }
```

## When to Use This Library

`@weave/changelog` is ideal for:

- 📝 **Collaborative editors** (track who changed what)
- ↩️ **Undo/redo systems** (maintain operation history)
- 🔄 **State synchronization** (sync changes across clients)
- 📊 **Audit logging** (track all changes to important data)
- 🕐 **Time-travel debugging** (replay state at any point in time)
- 💾 **Autosave systems** (efficiently track changes to save)

## Next Steps

- [API Reference](../api/index.md) - Complete API documentation
- [Storage Backends](./storage.md) - Learn about different storage options
- [Advanced Patterns](./patterns.md) - Common patterns and best practices
