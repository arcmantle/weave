/**
 * Collections Example (Map & Set)
 *
 * Demonstrates:
 * - Map and Set observation
 * - Collection-specific operations
 * - Undo/redo for collections
 * - Listening to collection changes
 */

import { chronicle } from '../src/chronicle.ts';

interface CacheEntry {
	value:     any;
	timestamp: number;
	hits:      number;
}

interface AppState {
	// Map for cache
	cache:   Map<string, CacheEntry>;
	// Set for tags
	tags:    Set<string>;
	// Regular array for comparison
	history: string[];
}

// Create state with collections
const state: AppState = chronicle({
	cache:   new Map(),
	tags:    new Set(),
	history: [],
});

// Listen to cache operations
chronicle.listen(state, s => s.cache, (path, newVal, oldVal, meta) => {
	if (meta?.collection === 'map')
		console.log(`💾 Cache ${ meta.type }:`, meta.key);
});

// Listen to tag operations
chronicle.listen(state, s => s.tags, (path, newVal, oldVal, meta) => {
	if (meta?.collection === 'set')
		console.log(`🏷️  Tag ${ meta.type }:`, meta.key);
});

// Cache operations
function cacheSet(key: string, value: any): void {
	state.cache.set(key, {
		value,
		timestamp: Date.now(),
		hits:      0,
	});
}

function cacheGet(key: string): any | undefined {
	const entry = state.cache.get(key);
	if (entry) {
		entry.hits++;

		return entry.value;
	}

	return undefined;
}

function cacheDelete(key: string): boolean {
	return state.cache.delete(key);
}

function cacheClear(): void {
	state.cache.clear();
}

// Tag operations
function addTag(tag: string): void {
	state.tags.add(tag);
}

function removeTag(tag: string): void {
	state.tags.delete(tag);
}

function clearTags(): void {
	state.tags.clear();
}

function hasTag(tag: string): boolean {
	return state.tags.has(tag);
}

// Demo usage
console.log('=== Collections Example ===\n');

// Map operations
console.log('--- Map Operations ---');
cacheSet('user:1', { name: 'Alice', age: 30 });
cacheSet('user:2', { name: 'Bob', age: 25 });
cacheSet('user:3', { name: 'Charlie', age: 35 });

console.log('Cache size:', state.cache.size);
console.log('Get user:1:', cacheGet('user:1'));

cacheDelete('user:2');
console.log('Cache size after delete:', state.cache.size);

// Set operations
console.log('\n--- Set Operations ---');
addTag('javascript');
addTag('typescript');
addTag('react');
addTag('nodejs');

console.log('Tags:', Array.from(state.tags));
console.log('Has typescript?', hasTag('typescript'));

removeTag('react');
console.log('Tags after removal:', Array.from(state.tags));

// Batch operations
console.log('\n--- Batch Operations ---');
chronicle.batch(state, (s) => {
	s.cache.set('batch:1', { value: 'a', timestamp: Date.now(), hits: 0 });
	s.cache.set('batch:2', { value: 'b', timestamp: Date.now(), hits: 0 });
	s.tags.add('batched');
	s.tags.add('operations');
});
console.log('Batched changes applied');

// Undo operations
console.log('\n--- Undo/Redo ---');
console.log('Before undo - Cache size:', state.cache.size, 'Tags:', state.tags.size);

chronicle.undoGroups(state, 1); // Undo the batch
console.log('After undo - Cache size:', state.cache.size, 'Tags:', state.tags.size);

chronicle.redoGroups(state, 1); // Redo the batch
console.log('After redo - Cache size:', state.cache.size, 'Tags:', state.tags.size);

// Clear operations
console.log('\n--- Clear Operations ---');
cacheClear();
clearTags();
console.log('After clear - Cache size:', state.cache.size, 'Tags:', state.tags.size);

// Undo clear
chronicle.undoGroups(state, 1);
chronicle.undoGroups(state, 1);
console.log('After undoing clears - Cache size:', state.cache.size, 'Tags:', state.tags.size);

// Complex Map values
console.log('\n--- Complex Map Values ---');
const complexState = chronicle({
	settings: new Map<string, { enabled: boolean; config: any; }>(),
});

complexState.settings.set('feature-a', { enabled: true, config: { timeout: 5000 } });
complexState.settings.set('feature-b', { enabled: false, config: { retries: 3 } });

// Modify nested value
const featureA = complexState.settings.get('feature-a');
if (featureA) {
	featureA.config.timeout = 10000;
	console.log('Modified nested config:', featureA.config);
}

console.log('\n✨ All collection operations work with full undo/redo support!');

export { addTag, cacheClear, cacheDelete, cacheGet, cacheSet, clearTags, hasTag, removeTag, state };
