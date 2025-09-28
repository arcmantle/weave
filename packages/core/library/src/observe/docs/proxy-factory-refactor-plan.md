# Proxy Factory Refactor Plan

## Goals

- Make proxy logic easier to reason about by separating concerns.
- Reduce surface area of `createProxyFactory` and its traps.
- Centralize repeated logic (grouping, history recording, listener dispatch, cache invalidation).
- Enable safer, incremental changes with strong contracts and tests.

### Current responsibilities in `proxy-factory.ts`

- Proxy caching per-root and path (get/set, invalidate, clear).
- Compute active group id (batch-aware, mergeUngrouped window, lastUngrouped tracking).
- History recording: set/delete records, array length shrink deletes, redo clearing, max-history trimming, optional compaction.
- Listener dispatch resolution: collect affected listeners across modes (down/exact/up) for a given path.
- Notification scheduling of listeners.
- Special handling for collections (Map/Set) to wrap mutators and brand-check-safe binding of methods.
- Array-specific behaviors (delete by numeric index via splice with suspended writes; length shrink bookkeeping).
- Recursive proxy creation for nested objects.

This makes the file long and dense; several responsibilities are duplicated between traps and Map/Set adapters.

### Target architecture (staged)

We will first extract helpers into the same module (`proxy-factory.ts`) as internal functions with short JSDoc. After behavior is stable and covered by tests, we can lift them into separate files with identical signatures.

Stage A — in-file helpers (same module):

- computeActiveGroupId(root, getBatchFrames)
- computeAffectedListeners(root, path)
- recordSet(root, path, oldValue, newValue, existedBefore, groupId)
- recordDelete(root, path, oldValue, groupId)
- recordArrayShrinkDeletes(root, basePath, removed, groupId)
- deleteArrayIndex(root, arrayTarget, index)
- captureShrinkRemovals(targetArray, oldLen, newLen)
- getCachedProxy(root, pathKey) / setCachedProxy(root, pathKey, proxy) / invalidateProxyCache(root, basePath, alsoParentArray) / clearProxyCache(root)
- pathKeyOf(segments)

Stage B — optional module extraction (same APIs):

- proxy-factory.ts (thin): orchestrates handler wiring; delegates to modules below.
- proxy-cache.ts:
  - getCached(root, pathKey) => proxy | undefined
  - setCached(root, pathKey, proxy): void
  - invalidateAt(root, basePath, alsoParentArray?): void
  - clear(root): void
- grouping.ts:
  - computeActiveGroupId(root, getBatchFrames, nowProvider = Date.now) => string
  - Encapsulates mergeUngrouped window and lastUngrouped updates.
- history-recorder.ts:
  - recordSet(root, path, oldValue, newValue, existedBefore, groupId): void
  - recordDelete(root, path, oldValue, groupId): void
  - recordArrayShrinkDeletes(root, basePath, indicesWithOldValues, groupId): void
  - Internally handles: isSuspended, ensureHistory, clearRedoCache, filter, compactConsecutiveSamePath, trimHistoryByGroups, timestamps.
- listener-affinity.ts (naming TBD):
  - computeAffectedListeners(root, path): `Set<ChangeListener>`
  - Uses trie to gather down/exact/up plus global listeners.
- notify.ts (optional wrapper):
  - notifyChange(root, affected, [path, newValue, oldValue, meta]): void
  - Thin wrapper over schedule-queue.ts `notifyListeners` to keep call sites uniform.
- collection-adapters.ts:
  - adaptMap(target, currentPath, deps): Map
  - adaptSet(target, currentPath, deps): Set
  - Wraps mutators to compute groupId, record history, and dispatch notifications.
- array-mutations.ts:
  - deleteIndex(root, arrayTarget, index): boolean (handles suspend/resume + splice)
  - captureShrinkRemovals(targetArray, oldLen, newLen) => { index, value }[]
- path-key.ts:
  - pathKeyOf(segments: string[]): string

Each module should be small, focused, and easily unit-testable.

### Contracts (type-level sketch)

- GroupingDeps: { getBatchFrames(root: object): BatchFrame[] | undefined }
- HistoryDeps: uses existing exported API from history/undo-redo (no new interface unless needed).
- ListenerDeps: { getListenerBucket(root): Bucket; getNode(trie, path): PathTrieNode; notifyListeners(root, affected, payload) }
- CacheDeps: uses `getOptions(root)` for `cacheProxies` flag.

`createProxyFactory(deps: ProxyFactoryDeps)` keeps the same public API:

- createProxy(target, path, root) => proxy
- invalidateCacheAt(root, basePath, alsoParentArray?)
- clearProxyCache(root)

### Incremental migration plan

Stage A — extract in-file helpers (no new files)

1. Grouping helper
   - Introduce `computeActiveGroupId(root, getBatchFrames)` inside `proxy-factory.ts` with a short JSDoc.
   - Replace usages in set/delete traps and Map/Set adapters.
   - Tests: batch vs non-batch, mergeUngrouped on/off, window timing, lastUngrouped reset.

2. Listener affinity helper
   - Add `computeAffectedListeners(root, path)` to centralize listener selection (global/down/exact/up).
   - Replace duplicated collection in traps and adapters.
   - Tests: down/exact/up correctness, strict depth for up, empty trie.

3. History recorder helpers
   - Add `recordSet`, `recordDelete`, `recordArrayShrinkDeletes` encapsulating filter, compaction, trimming, redo clearing,  timestamps.
   - Replace inline history logic throughout traps/adapters.
   - Tests: filter on/off, compaction rules (skip array indices and length), trimming by groups, suspended mode.

4. Array mutation helpers
   - Add `deleteArrayIndex` (suspend/resume + splice) and `captureShrinkRemovals`.
   - Replace inline array-specific code; keep behavior identical.
   - Tests: index deletion vs property deletion; synthesized deletes on shrink.

5. Cache helpers and pathKey
   - Add `getCachedProxy`/`setCachedProxy`/`invalidateProxyCache`/`clearProxyCache` and `pathKeyOf`.
   - Replace inline cache management in createProxy and invalidation.
   - Tests: cache on/off, invalidation including `alsoParentArray`.

6. Handler thinning
   - Simplify traps to orchestration: compute path, delegate to helpers, recurse via `createProxy`.
   - Keep method binding behavior for brand checks.

Stage B — optionally move helpers into separate files
7. Promote stable helpers to dedicated modules (same signatures, same tests).
8. Cleanup & docs; keep imports type-only to minimize runtime coupling.

### Testing strategy

- Unit tests per module (grouping, history-recorder, listener-affinity, array-mutations, proxy-cache).
- Integration tests via public `observe` API covering:
  - Nested property set/delete
  - Array index delete and length shrink
  - Map/Set mutators: set/delete/clear/add
  - Batch groups and mergeUngrouped windows
  - Listener modes (down/exact/up/global)
  - Proxy cache enabled/disabled
- Performance sanity: micro-benchmark critical paths (set and delete) before/after. Ensure no extra allocations or listener traversals regress significantly.

### Risks & mitigations

- Behavioral regressions in grouping or history sequencing: mitigate with golden tests of history sequences.
- Listener dispatch correctness: add exhaustive path trie tests.
- Proxy cache invalidation subtleties: include tests for nested paths and array parent invalidation.
- Cycles/import layering: prefer type-only imports and keep new modules dependency-light.

### Success criteria

- `proxy-factory.ts` shrinks substantially and reads as orchestration.
- All duplicated logic (group id, listener collection, history recording, cache invalidation) resides in dedicated modules.
- All existing tests pass; new unit tests cover extracted modules.
- No measurable perf regressions on hot paths (within noise).

### Rollout plan

- Land changes in small PRs aligned with migration steps (1–5) to simplify review and reduce risk.
- After each PR, run unit/integration tests and quickly benchmark set/delete hot paths.
- Keep public API of `createProxyFactory` unchanged.

### Open questions

- Should compaction live in recorder or be a separate optional pass? (Recorder for now.)
- Do we want a public, configurable grouping strategy? (Future extension.)
- Should listener dispatching be memoized for common paths? (Out of scope for first pass.)
