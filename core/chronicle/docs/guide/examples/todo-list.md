---
title: 'Example: Todo List with Undo/Redo'
description: Complete todo list implementation with history tracking and batching
keywords: example, todo list, undo, redo, history, batching, tutorial
---

# Example: Todo List with Undo/Redo

A complete todo list implementation showcasing Chronicle's history tracking, batching, and listener capabilities.

## Overview

This example demonstrates:

- ✅ Full undo/redo support for all operations
- 📝 Add, edit, complete, and delete todos
- 🔍 Real-time filtering (all, active, completed)
- 💾 Automatic persistence to localStorage
- ⚡ Batched updates for performance
- 🎯 Granular change tracking

## Complete Implementation

### Type Definitions

```typescript
import { chronicle, ChronicleProxy } from '@arcmantle/chronicle';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

interface TodoState {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
  editingId: string | null;
}
```

### State Setup

```typescript
// Initialize state
const initialState: TodoState = {
  todos: [],
  filter: 'all',
  editingId: null,
};

// Create observable state
const state = chronicle(initialState, {
  maxHistory: 50, // Limit undo stack
  autoBatch: true, // Auto-batch rapid changes
  autoBatchDelay: 100,
});

// Load from localStorage
const saved = localStorage.getItem('todos');
if (saved) {
  const data = JSON.parse(saved);
  state.todos = data.todos;
  state.filter = data.filter;
}
```

### Core Operations

```typescript
// Add a new todo
function addTodo(text: string): void {
  if (!text.trim()) return;

  state.todos.push({
    id: crypto.randomUUID(),
    text: text.trim(),
    completed: false,
    createdAt: Date.now(),
  });
}

// Toggle todo completion
function toggleTodo(id: string): void {
  const todo = state.todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
  }
}

// Edit todo text
function editTodo(id: string, newText: string): void {
  const todo = state.todos.find((t) => t.id === id);
  if (todo && newText.trim()) {
    todo.text = newText.trim();
    state.editingId = null;
  }
}

// Delete a todo
function deleteTodo(id: string): void {
  const index = state.todos.findIndex((t) => t.id === id);
  if (index !== -1) {
    state.todos.splice(index, 1);
  }
}

// Clear completed todos (batched)
function clearCompleted(): void {
  chronicle.batch(state, () => {
    // Remove all completed todos in one history entry
    state.todos = state.todos.filter((t) => !t.completed);
  });
}

// Toggle all todos
function toggleAll(): void {
  const allCompleted = state.todos.every((t) => t.completed);

  chronicle.batch(state, () => {
    state.todos.forEach((todo) => {
      todo.completed = !allCompleted;
    });
  });
}
```

### History Controls

```typescript
// Undo last change
function undo(): void {
  if (chronicle.canUndo(state)) {
    chronicle.undo(state);
  }
}

// Redo last undone change
function redo(): void {
  if (chronicle.canRedo(state)) {
    chronicle.redo(state);
  }
}

// Clear all history
function clearHistory(): void {
  chronicle.clearHistory(state);
}

// Get current history state
function getHistoryInfo() {
  return {
    canUndo: chronicle.canUndo(state),
    canRedo: chronicle.canRedo(state),
    historyLength: chronicle.getHistory(state).past.length,
  };
}
```

### Filtering

```typescript
// Change filter
function setFilter(filter: 'all' | 'active' | 'completed'): void {
  state.filter = filter;
}

// Get filtered todos (computed, not tracked)
function getFilteredTodos(): Todo[] {
  switch (state.filter) {
    case 'active':
      return state.todos.filter((t) => !t.completed);
    case 'completed':
      return state.todos.filter((t) => t.completed);
    default:
      return state.todos;
  }
}

// Get counts
function getCounts() {
  return {
    total: state.todos.length,
    active: state.todos.filter((t) => !t.completed).length,
    completed: state.todos.filter((t) => t.completed).length,
  };
}
```

### Persistence

```typescript
// Save to localStorage on any change
chronicle.on(state, '', () => {
  const snapshot = chronicle.snapshot(state);
  localStorage.setItem('todos', JSON.stringify(snapshot));
}, { mode: 'down', debounceMs: 500 });

// Import/Export
function exportTodos(): string {
  return JSON.stringify(chronicle.snapshot(state), null, 2);
}

function importTodos(json: string): void {
  try {
    const data = JSON.parse(json);
    chronicle.batch(state, () => {
      state.todos = data.todos || [];
      state.filter = data.filter || 'all';
    });
  } catch (error) {
    console.error('Invalid todo data:', error);
  }
}
```

## UI Integration

### React Example

```typescript
import { useEffect, useState } from 'react';

function TodoApp() {
  const [, forceUpdate] = useState({});

  // Re-render on any state change
  useEffect(() => {
    const unsubscribe = chronicle.on(state, '', () => {
      forceUpdate({});
    }, { mode: 'down' });

    return unsubscribe;
  }, []);

  const filteredTodos = getFilteredTodos();
  const counts = getCounts();
  const history = getHistoryInfo();

  return (
    <div className="todo-app">
      <header>
        <h1>Todos</h1>
        <div className="history-controls">
          <button onClick={undo} disabled={!history.canUndo}>
            ↶ Undo
          </button>
          <button onClick={redo} disabled={!history.canRedo}>
            ↷ Redo
          </button>
        </div>
      </header>

      <form onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('todo') as HTMLInputElement;
        addTodo(input.value);
        input.value = '';
      }}>
        <input
          name="todo"
          placeholder="What needs to be done?"
          autoFocus
        />
      </form>

      {state.todos.length > 0 && (
        <div className="controls">
          <button onClick={toggleAll}>
            {counts.active === 0 ? 'Clear All' : 'Complete All'}
          </button>
        </div>
      )}

      <ul className="todo-list">
        {filteredTodos.map((todo) => (
          <li key={todo.id} className={todo.completed ? 'completed' : ''}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />

            {state.editingId === todo.id ? (
              <input
                defaultValue={todo.text}
                autoFocus
                onBlur={(e) => editTodo(todo.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    editTodo(todo.id, e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    state.editingId = null;
                  }
                }}
              />
            ) : (
              <span onDoubleClick={() => (state.editingId = todo.id)}>
                {todo.text}
              </span>
            )}

            <button onClick={() => deleteTodo(todo.id)}>×</button>
          </li>
        ))}
      </ul>

      <footer>
        <span>{counts.active} items left</span>

        <div className="filters">
          <button
            className={state.filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={state.filter === 'active' ? 'active' : ''}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={state.filter === 'completed' ? 'active' : ''}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>

        {counts.completed > 0 && (
          <button onClick={clearCompleted}>
            Clear completed ({counts.completed})
          </button>
        )}
      </footer>
    </div>
  );
}
```

### Vanilla JavaScript Example

```typescript
// DOM elements
const input = document.querySelector<HTMLInputElement>('#todo-input')!;
const todoList = document.querySelector<HTMLUListElement>('#todo-list')!;
const filterButtons = document.querySelectorAll<HTMLButtonElement>('.filter-btn');
const undoBtn = document.querySelector<HTMLButtonElement>('#undo-btn')!;
const redoBtn = document.querySelector<HTMLButtonElement>('#redo-btn')!;

// Render function
function render() {
  const filteredTodos = getFilteredTodos();
  const counts = getCounts();
  const history = getHistoryInfo();

  // Update todo list
  todoList.innerHTML = filteredTodos
    .map(
      (todo) => `
    <li class="${todo.completed ? 'completed' : ''}">
      <input
        type="checkbox"
        ${todo.completed ? 'checked' : ''}
        data-id="${todo.id}"
      />
      <span>${todo.text}</span>
      <button class="delete" data-id="${todo.id}">×</button>
    </li>
  `
    )
    .join('');

  // Update button states
  undoBtn.disabled = !history.canUndo;
  redoBtn.disabled = !history.canRedo;

  // Update counts
  document.querySelector('#active-count')!.textContent = `${counts.active} items left`;
}

// Auto-render on state changes
chronicle.on(state, '', render, { mode: 'down' });

// Event delegation
todoList.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement;
  if (target.type === 'checkbox') {
    toggleTodo(target.dataset.id!);
  }
});

todoList.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('delete')) {
    deleteTodo(target.dataset.id!);
  }
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addTodo(input.value);
    input.value = '';
  }
});

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setFilter(btn.dataset.filter as any);
  });
});

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// Initial render
render();
```

## Key Features Demonstrated

### 1. Automatic History Tracking

Every operation (add, edit, delete, toggle) is automatically recorded:

```typescript
addTodo('Buy milk');     // History entry #1
toggleTodo(id);          // History entry #2
editTodo(id, 'Buy eggs'); // History entry #3

undo(); // Back to "Buy milk"
undo(); // Back to uncompleted
undo(); // Todo removed
```

### 2. Batched Operations

Multiple changes grouped into single history entry:

```typescript
// Without batching: 10 history entries
state.todos.forEach((todo) => {
  todo.completed = true;
});

// With batching: 1 history entry
chronicle.batch(state, () => {
  state.todos.forEach((todo) => {
    todo.completed = true;
  });
});
```

### 3. Selective Persistence

Only save meaningful changes, debounced:

```typescript
// Debounced save - waits 500ms after last change
chronicle.on(state, '', () => {
  localStorage.setItem('todos', JSON.stringify(chronicle.snapshot(state)));
}, { debounceMs: 500 });
```

### 4. Efficient Filtering

Filter changes don't create history entries:

```typescript
setFilter('active');    // Creates history entry
setFilter('completed'); // Creates history entry

// But reading doesn't affect history
const todos = getFilteredTodos(); // No history impact
```

## Performance Considerations

### Memory Usage

With 1000 todos and maxHistory: 50:

- State size: ~50KB
- History size: ~2.5MB (50 snapshots)
- Total: ~2.55MB

### Optimization Tips

```typescript
// 1. Limit history for large lists
const state = chronicle(initialState, {
  maxHistory: 20, // Reduce for large datasets
});

// 2. Filter changes from history
const state = chronicle(initialState, {
  filter: (path) => {
    // Don't track filter or editingId changes
    return path[0] !== 'filter' && path[0] !== 'editingId';
  },
});

// 3. Use debounced saves
chronicle.on(state, '', saveTodos, {
  debounceMs: 1000, // Save at most once per second
});

// 4. Batch bulk operations
function deleteMultiple(ids: string[]) {
  chronicle.batch(state, () => {
    ids.forEach(deleteTodo);
  });
}
```

## Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Todo List', () => {
  let state: ChronicleProxy<TodoState>;

  beforeEach(() => {
    state = chronicle({
      todos: [],
      filter: 'all',
      editingId: null,
    });
  });

  it('should add todo', () => {
    addTodo('Test todo');
    expect(state.todos).toHaveLength(1);
    expect(state.todos[0].text).toBe('Test todo');
    expect(state.todos[0].completed).toBe(false);
  });

  it('should toggle todo', () => {
    addTodo('Test todo');
    const id = state.todos[0].id;

    toggleTodo(id);
    expect(state.todos[0].completed).toBe(true);

    toggleTodo(id);
    expect(state.todos[0].completed).toBe(false);
  });

  it('should support undo/redo', () => {
    addTodo('First');
    addTodo('Second');
    expect(state.todos).toHaveLength(2);

    chronicle.undo(state);
    expect(state.todos).toHaveLength(1);

    chronicle.redo(state);
    expect(state.todos).toHaveLength(2);
  });

  it('should batch toggle all', () => {
    addTodo('First');
    addTodo('Second');
    addTodo('Third');

    toggleAll();
    expect(state.todos.every((t) => t.completed)).toBe(true);

    // One undo reverts all
    chronicle.undo(state);
    expect(state.todos.every((t) => !t.completed)).toBe(true);
  });

  it('should filter todos', () => {
    addTodo('First');
    addTodo('Second');
    toggleTodo(state.todos[0].id);

    setFilter('active');
    expect(getFilteredTodos()).toHaveLength(1);

    setFilter('completed');
    expect(getFilteredTodos()).toHaveLength(1);

    setFilter('all');
    expect(getFilteredTodos()).toHaveLength(2);
  });
});
```

## Live Demo

Try it yourself:

::: code-group

```bash [npm]
npm create vite@latest my-todos -- --template vanilla-ts
cd my-todos
npm install @arcmantle/chronicle
```

```bash [pnpm]
pnpm create vite my-todos --template vanilla-ts
cd my-todos
pnpm add @arcmantle/chronicle
```

```bash [yarn]
yarn create vite my-todos --template vanilla-ts
cd my-todos
yarn add @arcmantle/chronicle
```

:::

Then copy the implementation code above into your `src/main.ts`.

## Next Steps

- [Form State Example](./form-state) - Learn form validation and dirty tracking
- [Data Table Example](./data-table) - Handle large datasets with sorting and filtering
- [Best Practices](../best-practices) - Apply these patterns to your app

## Related Guides

- [History & Time-Travel](../history) - Deep dive into undo/redo
- [Batching & Transactions](../batching) - Optimize bulk operations
- [Performance](../performance) - Scale to thousands of items
