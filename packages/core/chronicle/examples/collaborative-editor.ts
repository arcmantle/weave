/**
 * Collaborative Editor Example
 *
 * Demonstrates:
 * - Pause/resume for batching external changes
 * - Debounced listeners for network efficiency
 * - Transactions for user operations
 * - Conflict resolution patterns
 */

import { chronicle } from '../chronicle.ts';

interface Cursor {
	userId:   string;
	position: number;
	color:    string;
}

interface EditorState {
	content:     string;
	cursors:     Map<string, Cursor>;
	version:     number;
	localUserId: string;
	isConnected: boolean;
}

// Create editor state
const editorState: EditorState = chronicle({
	content:     '',
	cursors:     new Map(),
	version:     0,
	localUserId: 'local-user',
	isConnected: true,
});

// Configure for collaboration
chronicle.configure(editorState, {
	maxHistory:                 500,
	compactConsecutiveSamePath: true, // Merge rapid edits
	mergeUngrouped:             true,
	mergeWindowMs:              1000, // 1 second typing window
});

// Simulated network layer
const networkQueue: { type: string; data: any; }[] = [];

function broadcastChange(type: string, data: any): void {
	networkQueue.push({ type, data });
	console.log(`📡 Broadcast: ${ type }`, data);
}

// Debounced broadcast for content changes (reduce network traffic)
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
chronicle.listen(editorState, s => s.content, (path, newVal) => {
	if (broadcastTimer)
		clearTimeout(broadcastTimer);

	broadcastTimer = setTimeout(() => {
		broadcastChange('content', {
			content: newVal,
			version: editorState.version,
			userId:  editorState.localUserId,
		});
		broadcastTimer = null;
	}, 300); // Batch changes within 300ms
});

// Immediate broadcast for cursor position
chronicle.listen(editorState, s => s.cursors, (path, newVal, oldVal, meta) => {
	if (meta?.collection === 'map') {
		const userId = meta.key as string;
		if (userId === editorState.localUserId) {
			broadcastChange('cursor', {
				userId,
				cursor: newVal,
			});
		}
	}
}, 'down');

// Editor operations
function insertText(position: number, text: string): void {
	chronicle.batch(editorState, (state) => {
		const before = state.content.slice(0, position);
		const after = state.content.slice(position);
		state.content = before + text + after;
		state.version++;

		// Update local cursor
		const cursor = state.cursors.get(state.localUserId);
		if (cursor)
			cursor.position = position + text.length;
	});
}

function deleteText(start: number, end: number): void {
	chronicle.batch(editorState, (state) => {
		const before = state.content.slice(0, start);
		const after = state.content.slice(end);
		state.content = before + after;
		state.version++;

		// Update local cursor
		const cursor = state.cursors.get(state.localUserId);
		if (cursor)
			cursor.position = start;
	});
}

function moveCursor(userId: string, position: number): void {
	const cursor = editorState.cursors.get(userId);
	if (cursor) {
		cursor.position = position;
	}
	else {
		editorState.cursors.set(userId, {
			userId,
			position,
			color: `#${ Math.floor(Math.random() * 16777215).toString(16) }`,
		});
	}
}

function removeCursor(userId: string): void {
	editorState.cursors.delete(userId);
}

// Receive remote changes (pause to batch updates)
function applyRemoteChanges(changes: { type: string; data: any; }[]): void {
	if (changes.length === 0)
		return;

	// Pause local listeners while applying remote changes
	chronicle.pause(editorState);

	try {
		for (const change of changes) {
			switch (change.type) {
			case 'content':
				editorState.content = change.data.content;
				editorState.version = Math.max(editorState.version, change.data.version);
				break;

			case 'cursor':
				if (change.data.userId !== editorState.localUserId)
					moveCursor(change.data.userId, change.data.cursor.position);

				break;

			case 'user-left':
				removeCursor(change.data.userId);
				break;
			}
		}
	}
	finally {
		// Resume and flush any queued local notifications
		chronicle.resume(editorState);
	}

	console.log(`📥 Applied ${ changes.length } remote changes`);
}

// User actions with transactions
async function saveDocument(): Promise<boolean> {
	const { result } = await chronicle.transactionAsync(editorState, async (state) => {
		const snapshot = state.content;
		const version = state.version;

		// Simulate API call
		await new Promise(resolve => setTimeout(resolve, 500));

		if (Math.random() > 0.9)
			throw new Error('Network error');


		console.log(`💾 Saved version ${ version } (${ snapshot.length } chars)`);

		return true;
	});

	return result;
}

function formatDocument(): void {
	chronicle.batch(editorState, (state) => {
		// Simple formatting: trim and normalize whitespace
		state.content = state.content
			.split('\n')
			.map(line => line.trim())
			.join('\n')
			.replace(/\n{3,}/g, '\n\n');
		state.version++;
	});
	console.log('✨ Document formatted');
}

// Demo usage
console.log('=== Collaborative Editor Demo ===\n');

// Initialize local cursor
moveCursor(editorState.localUserId, 0);

// User types
console.log('--- Local Editing ---');
insertText(0, 'Hello');
insertText(5, ' World');
insertText(11, '!');

console.log(`Content: "${ editorState.content }"`);
console.log(`Version: ${ editorState.version }`);
console.log(`Network queue: ${ networkQueue.length } messages`);

// Simulate remote user joining
console.log('\n--- Remote User Joins ---');
applyRemoteChanges([
	{
		type: 'cursor',
		data: {
			userId: 'remote-user-1',
			cursor: { userId: 'remote-user-1', position: 0, color: '#ff0000' },
		},
	},
]);

console.log(`Active cursors: ${ editorState.cursors.size }`);

// Simulate remote edits
console.log('\n--- Receiving Remote Changes ---');
applyRemoteChanges([
	{
		type: 'content',
		data: {
			content: 'Hello World! How are you?',
			version: editorState.version + 1,
			userId:  'remote-user-1',
		},
	},
	{
		type: 'cursor',
		data: {
			userId: 'remote-user-1',
			cursor: { position: 25 },
		},
	},
]);

console.log(`Content after remote edit: "${ editorState.content }"`);

// Local operations
console.log('\n--- Local Operations ---');
formatDocument();
await saveDocument();

// Undo/redo
console.log('\n--- Time Travel ---');
chronicle.undoGroups(editorState, 1); // Undo format
console.log(`After undo: "${ editorState.content }"`);

chronicle.redoGroups(editorState, 1); // Redo format
console.log(`After redo: "${ editorState.content }"`);

// Check history
const history = chronicle.getHistory(editorState);
console.log(`\n📚 History contains ${ history.length } records`);
console.log(`✓ Can undo: ${ chronicle.canUndo(editorState) }`);
console.log(`✓ Can redo: ${ chronicle.canRedo(editorState) }`);

export {
	applyRemoteChanges,
	deleteText,
	editorState,
	formatDocument,
	insertText,
	moveCursor,
	removeCursor,
	saveDocument,
};
