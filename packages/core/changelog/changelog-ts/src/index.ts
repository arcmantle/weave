// Main exports
export { Changelog } from './changelog.js';
export type { DiffOptions } from './diff-engine.js';
export { applyDiff, diff } from './diff-engine.js';

// Type exports
export type {
	ChangeGroup,
	ChangeRecord,
	DiffRecord,
	DocumentState,
	QueryOptions,
} from './types.js';

// Storage interface export
export type { ChangelogStorage } from './storage/interface.js';
