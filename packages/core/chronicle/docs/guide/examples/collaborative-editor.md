---
title: 'Example: Collaborative Text Editor'
description: Real-time collaborative editor with operational transforms and conflict resolution
keywords: example, collaborative, editor, real-time, conflict resolution, operational transforms
---

# Example: Collaborative Text Editor

Build a real-time collaborative editor with Chronicle's snapshot and batching capabilities.

## Overview

This example demonstrates:

- ⚡ Real-time multi-user editing
- 🔄 Operational transforms for conflict resolution
- 📸 Periodic snapshots for state sync
- 🎯 Cursor position tracking
- 👥 User presence indicators
- 💾 Auto-save with debouncing
- ⏱️ Change history and playback

## Complete Implementation

### Type Definitions

```typescript
import { chronicle, ChronicleProxy } from '@arcmantle/chronicle';

interface User {
  id: string;
  name: string;
  color: string;
  cursor: number;
  selection: { start: number; end: number } | null;
}

interface Operation {
  type: 'insert' | 'delete';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  timestamp: number;
}

interface EditorState {
  content: string;
  users: Map<string, User>;
  operations: Operation[];
  version: number;
  lastSaved: number;
}
```

### State Setup

```typescript
const editor = chronicle<EditorState>({
  content: '',
  users: new Map(),
  operations: [],
  version: 0,
  lastSaved: Date.now(),
}, {
  maxHistory: 100,
  autoBatch: true,
  autoBatchDelay: 50, // Fast batching for smooth editing
});

// Current user
const currentUser: User = {
  id: crypto.randomUUID(),
  name: 'User' + Math.floor(Math.random() * 1000),
  color: `hsl(${Math.random() * 360}, 70%, 60%)`,
  cursor: 0,
  selection: null,
};

editor.users.set(currentUser.id, currentUser);
```

### Core Operations

```typescript
// Insert text at position
function insertText(position: number, text: string, userId = currentUser.id): void {
  chronicle.batch(editor, () => {
    // Apply to content
    const before = editor.content.slice(0, position);
    const after = editor.content.slice(position);
    editor.content = before + text + after;

    // Record operation
    editor.operations.push({
      type: 'insert',
      position,
      content: text,
      userId,
      timestamp: Date.now(),
    });

    editor.version++;

    // Update cursors
    updateCursorsAfterInsert(position, text.length, userId);
  });
}

// Delete text at range
function deleteText(start: number, length: number, userId = currentUser.id): void {
  chronicle.batch(editor, () => {
    const before = editor.content.slice(0, start);
    const after = editor.content.slice(start + length);
    editor.content = before + after;

    editor.operations.push({
      type: 'delete',
      position: start,
      length,
      userId,
      timestamp: Date.now(),
    });

    editor.version++;

    updateCursorsAfterDelete(start, length, userId);
  });
}

// Replace text in range
function replaceText(start: number, length: number, text: string): void {
  chronicle.batch(editor, () => {
    deleteText(start, length);
    insertText(start, text);
  });
}
```

### Cursor Management

```typescript
// Update cursor position
function setCursor(position: number, userId = currentUser.id): void {
  const user = editor.users.get(userId);
  if (user) {
    user.cursor = Math.max(0, Math.min(position, editor.content.length));
    user.selection = null;
  }
}

// Set selection range
function setSelection(start: number, end: number, userId = currentUser.id): void {
  const user = editor.users.get(userId);
  if (user) {
    user.cursor = end;
    user.selection = { start, end };
  }
}

// Adjust cursors after insert
function updateCursorsAfterInsert(position: number, length: number, excludeUserId: string): void {
  editor.users.forEach((user) => {
    if (user.id === excludeUserId) return;

    // Adjust cursor
    if (user.cursor >= position) {
      user.cursor += length;
    }

    // Adjust selection
    if (user.selection) {
      if (user.selection.start >= position) {
        user.selection.start += length;
      }
      if (user.selection.end >= position) {
        user.selection.end += length;
      }
    }
  });
}

// Adjust cursors after delete
function updateCursorsAfterDelete(position: number, length: number, excludeUserId: string): void {
  editor.users.forEach((user) => {
    if (user.id === excludeUserId) return;

    if (user.cursor >= position + length) {
      user.cursor -= length;
    } else if (user.cursor > position) {
      user.cursor = position;
    }

    if (user.selection) {
      if (user.selection.start >= position + length) {
        user.selection.start -= length;
      } else if (user.selection.start > position) {
        user.selection.start = position;
      }

      if (user.selection.end >= position + length) {
        user.selection.end -= length;
      } else if (user.selection.end > position) {
        user.selection.end = position;
      }
    }
  });
}
```

### Operational Transforms

```typescript
// Transform operation against concurrent operations
function transformOperation(op: Operation, against: Operation): Operation {
  if (op.userId === against.userId) return op;

  if (op.type === 'insert' && against.type === 'insert') {
    // Both inserting
    if (against.position < op.position) {
      return { ...op, position: op.position + (against.content?.length || 0) };
    } else if (against.position === op.position && against.userId < op.userId) {
      // Tie-break by user ID
      return { ...op, position: op.position + (against.content?.length || 0) };
    }
  } else if (op.type === 'insert' && against.type === 'delete') {
    // Insert vs delete
    if (against.position < op.position) {
      return { ...op, position: op.position - (against.length || 0) };
    }
  } else if (op.type === 'delete' && against.type === 'insert') {
    // Delete vs insert
    if (against.position <= op.position) {
      return { ...op, position: op.position + (against.content?.length || 0) };
    }
  } else if (op.type === 'delete' && against.type === 'delete') {
    // Both deleting
    if (against.position < op.position) {
      return { ...op, position: op.position - (against.length || 0) };
    }
  }

  return op;
}

// Apply remote operation
function applyRemoteOperation(op: Operation): void {
  // Transform against concurrent local operations
  const localOps = editor.operations.filter(
    (o) => o.timestamp >= op.timestamp && o.userId === currentUser.id
  );

  let transformed = op;
  for (const localOp of localOps) {
    transformed = transformOperation(transformed, localOp);
  }

  // Apply transformed operation
  if (transformed.type === 'insert' && transformed.content) {
    insertText(transformed.position, transformed.content, transformed.userId);
  } else if (transformed.type === 'delete' && transformed.length) {
    deleteText(transformed.position, transformed.length, transformed.userId);
  }
}
```

### Synchronization

```typescript
// Generate snapshot for synchronization
function generateSnapshot() {
  return {
    content: editor.content,
    version: editor.version,
    timestamp: Date.now(),
  };
}

// Apply snapshot from server
function applySnapshot(snapshot: ReturnType<typeof generateSnapshot>): void {
  if (snapshot.version > editor.version) {
    chronicle.batch(editor, () => {
      editor.content = snapshot.content;
      editor.version = snapshot.version;

      // Clear old operations
      editor.operations = [];
    });
  }
}

// Get operations since version
function getOperationsSince(version: number): Operation[] {
  return editor.operations.filter((op) =>
    editor.operations.indexOf(op) >= version
  );
}
```

### Auto-save

```typescript
// Save to server with debouncing
chronicle.on(editor, 'content', async () => {
  const snapshot = generateSnapshot();

  try {
    // Simulate API call
    await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });

    editor.lastSaved = Date.now();
  } catch (error) {
    console.error('Save failed:', error);
  }
}, {
  mode: 'exact',
  debounceMs: 2000, // Save at most every 2 seconds
});
```

### User Presence

```typescript
// Add remote user
function addUser(user: User): void {
  editor.users.set(user.id, user);
}

// Remove user
function removeUser(userId: string): void {
  editor.users.delete(userId);
}

// Update remote user cursor
function updateRemoteCursor(userId: string, cursor: number, selection?: { start: number; end: number }): void {
  const user = editor.users.get(userId);
  if (user) {
    user.cursor = cursor;
    user.selection = selection || null;
  }
}

// Broadcast cursor position
chronicle.on(editor.users.get(currentUser.id)!, 'cursor', (event) => {
  // Send to server/peers
  broadcastCursorUpdate({
    userId: currentUser.id,
    cursor: event.value as number,
    selection: currentUser.selection,
  });
}, { mode: 'exact', throttleMs: 100 });
```

## UI Integration

### React Example

```typescript
import { useEffect, useState, useRef } from 'react';

function CollaborativeEditor() {
  const [, forceUpdate] = useState({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const unsubscribe = chronicle.on(editor, '', () => {
      forceUpdate({});
    }, { mode: 'down', throttleMs: 16 }); // 60fps updates

    return unsubscribe;
  }, []);

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Calculate what changed
    const oldContent = editor.content;
    const newContent = textarea.value;

    if (newContent.length > oldContent.length) {
      // Text inserted
      const insertPos = start - (newContent.length - oldContent.length);
      const inserted = newContent.slice(insertPos, start);
      insertText(insertPos, inserted);
    } else if (newContent.length < oldContent.length) {
      // Text deleted
      const deleteLen = oldContent.length - newContent.length;
      deleteText(start, deleteLen);
    }

    setCursor(start);
    if (start !== end) {
      setSelection(start, end);
    }
  };

  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    setCursor(end);
    if (start !== end) {
      setSelection(start, end);
    }
  };

  return (
    <div className="editor-container">
      <div className="editor-header">
        <h2>Collaborative Editor</h2>
        <div className="users">
          {Array.from(editor.users.values()).map((user) => (
            <div
              key={user.id}
              className="user-badge"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name[0]}
            </div>
          ))}
        </div>
        <div className="editor-info">
          v{editor.version} • Saved {new Date(editor.lastSaved).toLocaleTimeString()}
        </div>
      </div>

      <div className="editor-body">
        <textarea
          ref={textareaRef}
          value={editor.content}
          onInput={handleInput}
          onSelect={handleSelectionChange}
          onClick={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          placeholder="Start typing..."
        />

        {/* Render remote cursors */}
        {Array.from(editor.users.values())
          .filter((user) => user.id !== currentUser.id)
          .map((user) => (
            <div
              key={user.id}
              className="remote-cursor"
              style={{
                borderColor: user.color,
                // Position based on cursor position
              }}
            >
              <span className="cursor-label" style={{ backgroundColor: user.color }}>
                {user.name}
              </span>
            </div>
          ))}
      </div>

      <div className="editor-actions">
        <button onClick={() => chronicle.undo(editor)} disabled={!chronicle.canUndo(editor)}>
          Undo
        </button>
        <button onClick={() => chronicle.redo(editor)} disabled={!chronicle.canRedo(editor)}>
          Redo
        </button>
        <button onClick={() => {
          const snapshot = generateSnapshot();
          console.log('Snapshot:', snapshot);
        }}>
          Export
        </button>
      </div>
    </div>
  );
}
```

## Key Features Demonstrated

### 1. Operational Transforms

Concurrent edits resolve correctly:

```typescript
// User A: Insert 'Hello' at position 0
insertText(0, 'Hello', 'user-a');

// User B: Insert 'World' at position 0 (concurrent)
const opB = { type: 'insert', position: 0, content: 'World', userId: 'user-b' };
const transformed = transformOperation(opB, { type: 'insert', position: 0, content: 'Hello', userId: 'user-a' });
// transformed.position = 5, so final content: 'HelloWorld'
```

### 2. Cursor Synchronization

Remote cursors update in real-time:

```typescript
chronicle.on(currentUser, 'cursor', (event) => {
  socket.emit('cursor', {
    userId: currentUser.id,
    cursor: event.value,
  });
}, { throttleMs: 100 }); // Max 10 updates/sec
```

### 3. Efficient Snapshots

Periodic full-state sync:

```typescript
setInterval(() => {
  if (editor.version % 100 === 0) {
    const snapshot = generateSnapshot();
    socket.emit('snapshot', snapshot);
  }
}, 10000); // Every 10 seconds
```

## Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Collaborative Editor', () => {
  beforeEach(() => {
    editor.content = '';
    editor.version = 0;
    editor.operations = [];
  });

  it('should insert text', () => {
    insertText(0, 'Hello');
    expect(editor.content).toBe('Hello');
    expect(editor.version).toBe(1);
  });

  it('should delete text', () => {
    insertText(0, 'Hello');
    deleteText(0, 5);
    expect(editor.content).toBe('');
    expect(editor.version).toBe(2);
  });

  it('should transform concurrent inserts', () => {
    const op1: Operation = {
      type: 'insert',
      position: 0,
      content: 'A',
      userId: 'user1',
      timestamp: 1000,
    };

    const op2: Operation = {
      type: 'insert',
      position: 0,
      content: 'B',
      userId: 'user2',
      timestamp: 1001,
    };

    const transformed = transformOperation(op2, op1);
    expect(transformed.position).toBe(1);
  });

  it('should update cursors after insert', () => {
    const user2 = { id: 'user2', name: 'User2', color: '#000', cursor: 5, selection: null };
    editor.users.set('user2', user2);

    insertText(0, 'Hello', 'user1');

    expect(user2.cursor).toBe(10); // 5 + 5
  });
});
```

## Next Steps

- [Game State](./game-state) - State management for games
- [Data Table](./data-table) - Complex data operations
- [Snapshots Guide](../snapshots) - Advanced snapshot techniques

## Related Guides

- [History & Time-Travel](../history) - Undo/redo implementation
- [Batching](../batching) - Optimize concurrent operations
- [Performance](../performance) - Scale to large documents
