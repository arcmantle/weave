/**
 * Todo List Example
 *
 * Demonstrates:
 * - Basic state observation
 * - Batch operations for atomic changes
 * - Undo/redo functionality
 * - Listening to specific paths
 */

import { chronicle } from '../src/chronicle.ts';

interface Todo {
	id:        number;
	text:      string;
	completed: boolean;
	createdAt: number;
}

interface TodoState {
	items:       Todo[];
	filter:      'all' | 'active' | 'completed';
	lastAction?: string;
}

// Create observable state
const todoState: TodoState = chronicle({
	items:  [],
	filter: 'all',
});

// Configure for better UX
chronicle.configure(todoState, {
	maxHistory:     50, // Keep last 50 operations
	mergeUngrouped: true, // Merge rapid ungrouped changes
	mergeWindowMs:  100,
});

// Listen to changes
chronicle.listen(todoState, s => s.items, () => {
	console.log(`📝 Todos updated: ${ todoState.items.length } items`);
}, 'down'); // 'down' catches all nested changes

chronicle.listen(todoState, s => s.filter, (path, newVal, oldVal) => {
	console.log(`🔍 Filter changed: ${ oldVal } → ${ newVal }`);
});

// Actions
function addTodo(text: string): void {
	chronicle.batch(todoState, (state) => {
		const todo: Todo = {
			id:        Date.now(),
			text,
			completed: false,
			createdAt: Date.now(),
		};
		state.items.push(todo);
		state.lastAction = `Added: ${ text }`;
	});
}

function toggleTodo(id: number): void {
	const todo = todoState.items.find(t => t.id === id);
	if (todo) {
		todo.completed = !todo.completed;
		todoState.lastAction = `Toggled: ${ todo.text }`;
	}
}

function deleteTodo(id: number): void {
	chronicle.batch(todoState, (state) => {
		const index = state.items.findIndex(t => t.id === id);
		if (index !== -1) {
			const todo = state.items[index];
			state.items.splice(index, 1);
			state.lastAction = `Deleted: ${ todo!.text }`;
		}
	});
}

function editTodo(id: number, newText: string): void {
	const todo = todoState.items.find(t => t.id === id);
	if (todo) {
		todo.text = newText;
		todoState.lastAction = `Edited: ${ newText }`;
	}
}

function clearCompleted(): void {
	chronicle.batch(todoState, (state) => {
		const completedCount = state.items.filter(t => t.completed).length;
		state.items = state.items.filter(t => !t.completed);
		state.lastAction = `Cleared ${ completedCount } completed todos`;
	});
}

function toggleAll(): void {
	chronicle.batch(todoState, (state) => {
		const allCompleted = state.items.every(t => t.completed);
		state.items.forEach(todo => {
			todo.completed = !allCompleted;
		});
		state.lastAction = allCompleted ? 'Unchecked all' : 'Checked all';
	});
}

// Undo/Redo helpers
function undo(): void {
	if (chronicle.canUndo(todoState)) {
		chronicle.undoGroups(todoState, 1);
		console.log('⏪ Undo');
	}
}

function redo(): void {
	if (chronicle.canRedo(todoState)) {
		chronicle.redoGroups(todoState, 1);
		console.log('⏩ Redo');
	}
}

// Demo usage
console.log('=== Todo List Demo ===\n');

addTodo('Buy groceries');
addTodo('Walk the dog');
addTodo('Read a book');

toggleTodo(todoState.items[0]!.id);
toggleTodo(todoState.items[1]!.id);

console.log(`\n✅ Completed: ${ todoState.items.filter(t => t.completed).length }`);
console.log(`📋 Total: ${ todoState.items.length }`);

undo(); // Undo toggle
undo(); // Undo toggle
console.log(`\n✅ After undo: ${ todoState.items.filter(t => t.completed).length }`);

redo(); // Redo toggle
console.log(`✅ After redo: ${ todoState.items.filter(t => t.completed).length }`);

// Check pristine state
console.log(`\n🎯 Is pristine? ${ chronicle.isPristine(todoState) }`);

// View diff
const diff = chronicle.diff(todoState);
console.log(`\n📊 Changes from original:`, diff.length, 'changes');

// Export state
export { addTodo, clearCompleted, deleteTodo, editTodo, redo, todoState, toggleAll, toggleTodo, undo };
