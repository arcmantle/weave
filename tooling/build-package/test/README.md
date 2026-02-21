# Build Package Tests

This directory contains tests for the build package discovery tooling.

## Test Coverage

The tests cover the following functionality:

###  `getPackageDir`
- Returns the directory path for a given package name
- Returns undefined for non-existent packages
- Handles multiple packages in different directories

### `getPackageDeps`
- Extracts all dependencies from package.json
- Extracts devDependencies
- Combines both dependencies and devDependencies

### `getWorkspaceDeps`
- Filters only workspace dependencies (those starting with `workspace:`)
- Returns empty array when no workspace dependencies exist

### `getPackageBuildOrder`
- Returns single package with no dependencies
- Builds dependencies before dependents
- Handles multi-level dependency chains
- Handles diamond dependencies correctly (common dependency from multiple paths)
- Includes devDependencies in build order
- Returns empty array for non-existent packages
- Can ignore already-built packages when flag is set
- Checks `main` field for built files
- Checks `exports` field for built files
- Handles complex dependency graphs
- Ignores external (non-workspace) dependencies
- Handles mixed workspace and external dependencies

## Known Issues

The current tests are failing because:

1. **Module Caching**: The `find-build-order.ts` module uses an internal cache (`nameToPathMap` and `nameToContentMap`) that gets populated once on first call to `ensurePackageLookup()`. This cache persists across test runs within the same test suite.

2. **Mock Timing**: The filesystem mocks are set up, but the actual module imports the real `node:fs` and `node:fs/promises` before the mocks can intercept. Vitest's `vi.mock()` needs to be hoisted to the top of the file, but even then, dynamic imports (`await import()`) in individual tests bypass the module cache reset.

3. **process.cwd() Mock**: The code uses `process.cwd()` to build the glob pattern for finding packages. The mock is set to `/root`, but the actual glob pattern built may not match the mock file paths.

## Recommended Fixes

To make these tests pass, the source code (`find-build-order.ts`) should be refactored to:

1. **Export a reset function** to clear the internal caches between tests
2. **Accept dependency injection** for the file system operations (fs, glob, process.cwd)
3. **Make the cache opt-in** rather than automatic, or provide a way to bypass it for testing

Example refactoring:

```typescript
// Add to find-build-order.ts
export const __resetCache = () => {
	nameToPathMap.clear();
	nameToContentMap.clear();
};

// Or make ensurePackageLookup accept a root directory parameter
const ensurePackageLookup = async (rootDir = process.cwd()) => {
	// ... use rootDir instead of process.cwd()
};
```

Then in tests:

```typescript
beforeEach(() => {
	const { __resetCache } = await import('../src/find-build-order.ts');
	__resetCache();
});
```
