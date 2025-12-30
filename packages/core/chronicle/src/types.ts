// Shared types for observe subsystem (no runtime code)

export interface ChangeMeta {
	type:           'set' | 'delete';
	existedBefore?: boolean;
	groupId?:       string;
	// Collection metadata (for Map/Set)
	collection?:    'map' | 'set';
	key?:           any;
}
export type ChangeListener = (path: string[], newValue: any, oldValue: any, meta?: ChangeMeta) => void;

export type PathSelector<T> = (object: T) => any;

export type PathMode = 'exact' | 'up' | 'down';

export interface PathTrieNode {
	children: Map<string, PathTrieNode>;
	modes:    Map<PathMode, Set<ChangeListener>>;
}

export interface ListenerBucket {
	global: Set<ChangeListener>;
	trie:   PathTrieNode;
}

export interface ListenerOptions {
	once?:       boolean;
	debounceMs?: number;
	throttleMs?: number;
	schedule?:   'sync' | 'microtask';
}

// --- Change history (for undo/diff) ---
export type ChangeType = 'set' | 'delete';
export interface ChangeRecord {
	path:           string[];
	type:           ChangeType;
	oldValue:       any;
	newValue:       any;
	timestamp:      number;
	existedBefore?: boolean;
	groupId?:       string;
	// Collection metadata (for Map/Set adapters)
	collection?:    'map' | 'set';
	key?:           any; // Map key (or Set entry when needed)
}

// --- Diff ---
export type DiffKind = 'added' | 'removed' | 'changed';
export interface DiffRecord {
	path:      string[];
	kind:      DiffKind;
	oldValue?: any;
	newValue?: any;
}

// Internal helper for pause queue
export interface QueuedCall { listener: ChangeListener; args: [ string[], any, any, ChangeMeta | undefined ]; }
