# observe() modularization plan

This document proposes how we will split the current `observe.ts` into cohesive, readable, and testable modules without changing the public API or behavior. The plan is informed by the roadmap and the existing test suite in this folder.

## Goals

- Keep the public API stable: `observe()`, `observe.listen`, `onAny`, `pause/resume/flush`, history, undo/redo, transactions, batching, configure, diff/pristine.
- Improve code readability by isolating responsibilities and keeping files small and focused.
- Enable targeted performance work (hot paths easy to reason about and micro-optimize).
- Maintain 100% test compatibility; no behavior changes.

## Non‑goals (for this refactor)

- No new features or API changes.
- No changes to the test suite besides potential new tests for refactor invariants.
- No lint/formatting sweeps.

## Constraints captured from tests/roadmap

- Paths stored and dispatched as string[] segments; stable symbol identity.
- Listener modes: exact, down, up; trie-backed indexing; global bucket.
- QoL options on listeners: once, debounce, throttle, schedule=microtask.
- Pause/resume/flush must queue and deliver FIFO.
- History: set/delete records; group-aware batching; mergeUngrouped time-window; optional compaction; maxHistory trims by whole groups; optional filter.
- Undo/redo: object/array including splice semantics for delete; Map/Set adapters; redo cleared on forward change; group semantics for batches.
- Snapshot/diff/reset: structuredClone-first, Reflect.ownKeys, custom clone/compare/diffFilter, symbol keys respected.
- Proxy caching (opt-in) with invalidation on set/delete/splice/length changes and on markPristine/reset.
- Transactions: sync/async, nested coalescing into outer batch.

## Proposed module layout

All modules live under `packages/core/library/src/observe/`.

1. **types.ts**
   - Shared types: `ChangeMeta`, `ChangeRecord`, `ChangeType`, `DiffRecord`, `PathMode`, `ListenerOptions`, `ChangeListener`, `PathTrieNode`, `ListenerBucket`, and internal helpers (e.g., `QueuedCall`).
   - Symbol normalization type helpers.

2. **path.ts**
   - Segment utilities: `normalizePropertyKey`, `isArrayIndexKey`, path key joiner, `nameofSegments` glue (if present), and any parsing helpers.
   - Parent/key traversal helpers: `getParentAndKey`, `ensureParents`, `setAtPath`, `deleteAtPath`.

3. **listener-trie.ts**
   - Trie structure and mutation: `getOrCreateNode`, `getNode`, `prunePathIfEmpty`.
   - Public operations: `addListener(root, segs, mode, fn)`, `removeListener(...)`, and dispatch helpers to collect relevant listeners for a path (global and trie modes).
   - Bucket management: `ensureListenerBucket`, cleanup.

4. **schedule-queue.ts**
   - Pause, resume, and flush state and queueing; scheduling utilities (sync vs. microtask); debounce/throttle wrappers.
   - Small stateless helpers for `onAny`.

5. **history.ts**
   - History cache and helpers: `ensureHistory`, max history trimming by groups, group ID generation/counters.
   - Options state (`optionsCache`) and `mergeUngrouped` window, `compactConsecutiveSamePath` logic, filter.
   - Public surface:
     - `recordChange(root, record)`: applies options (filter/compaction/merge), enforces max history, clears redo.
     - `clearHistory(root)`, `getHistory(root)`, `markPristine(root)`, `reset(root)` (delegates to snapshot module for snapshot operations).

6. **snapshot-diff.ts**
   - `originalSnapshotCache`, deep clone wrapper honoring `options.clone`.
   - `diffValues` implementation honoring `options.compare`/`diffFilter` and symbol keys via `Reflect.ownKeys`.
   - `markPristine`, `isPristine`, `diff`, and `reset`'s deep overwrite helper.

7. **proxy-factory.ts**
   - `createProxy` for objects/arrays; `cacheProxies` support and invalidation wiring.
   - `get` trap brand-safe binding for `Map`/`Set` methods; mutation wrappers that call into history and notifier with collection metadata.
   - `set`/`delete` traps including array index splice semantics and array length shrink handling; parent invalidation for caches.
   - `proxyToRoot` map.

8. **undo-redo.ts**
   - Redo stack/cache; `applyForward` (redo) and `applyBackward` (undo) with collection awareness.
   - Public surface: `undo`, `redo`, `undoGroups`, `redoGroups`, `canUndo`, `canRedo`, `clearRedo`.
   - Suspend/resume write counter utilities to avoid re-entrant recording during apply.

9. **batch-transaction.ts**
   - Batch frames stack, `begin`/`commit`/`rollback`, `batch(fn)`.
   - `transaction` and `transactionAsync` composition over batch; nested coalescing behavior.
   - Integration points with history (group ID assignment) and redo clearing.

10. **config.ts**
    - `observe.configure(object, options)` — merges options and resets merge/ungrouped markers as currently implemented.
    - Surfaced options type.

11. **api.ts**
    - The public `observe()` function that wires the modules:
      - Captures pristine snapshot (via snapshot-diff).
      - Builds proxies via proxy-factory and routes notifications via listener-trie and schedule-queue.
      - Re-exports static methods: `listen`, `onAny`, `pause`, `resume`, `flush`, `getHistory`, `clearHistory`, `reset`, `undo`/`redo` groups, `diff`, `isPristine`, `markPristine`, `mark`, `transaction`/`transactionAsync`, `begin`/`commit`/`rollback`/`batch`, `configure`, `canUndo`/`canRedo`, `clearRedo`.
    - Maintains compatibility with existing imports (`import { observe } from './observe.ts'`) by being compiled into `observe.ts` or re-exported through it.

12. **index wiring (observe.ts)**
    - Implementation option A (preferred): keep `observe.ts` as the public barrel that imports from the above modules and assigns the static methods on the main `observe` function.
    - Option B: move the function to `api.ts` and have `observe.ts` re-export from there for minimal diff.

### Module dependency graph (simplified)

- types <- path
- types <- listener-trie
- types <- schedule-queue
- types <- history
- types <- snapshot-diff (also uses history options)
- types <- proxy-factory (depends on path, history, schedule-queue, listener-trie)
- types <- undo-redo (depends on history, path)
- batch-transaction depends on history and undo-redo
- config touches options in history/snapshot-diff
- api depends on everything

```txt
path ──► listener-trie ───────┐
  │                           │
  ├──► proxy-factory ─────────┼─► api (observe)
  │        │                  │
  │        ├──► history ◄─────┤
  │        │        │         │
  │        │        └──► undo-redo
  │        │
  │        └──► schedule-queue
  │
  └──► snapshot-diff ─────────┘
```

## Event flow (object/array)

- set/delete trap (proxy-factory) → history.recordChange (group/compact/filter/trim) → schedule-queue.notify (global + trie listeners collected via listener-trie) → deliver with QoL options (debounce/throttle/once/schedule) → optional cache invalidation (proxy-factory) → redo cleared by history.

## Event flow (Map/Set)

- get trap wraps mutators (proxy-factory) → on call, perform native mutation, build ChangeRecord with `collection: 'map'|'set'` and `key` → history.recordChange → schedule-queue.notify for collection path (exact/global and per-mode) → redo cleared.

## Incremental extraction plan (safe steps)

We’ll split into small PR-sized steps, running the full test suite after each step.

1. **Extract `types.ts` and `path.ts`**
   - Move type aliases and pure helpers; import from `observe.ts`.
   - Risk: Low. Validate tests.

2. **Extract `listener-trie.ts`**
   - Move trie and bucket helpers; adjust `observe.listen` and `onAny` to use the module.

3. **Extract `schedule-queue.ts`**
   - Move pause, resume, flush, and listener wrapping (once, debounce, throttle, schedule).

4. **Extract `history.ts` (without snapshot yet)**
   - Move history caches, group trimming, merge, and compaction; keep `markPristine` and `reset` temporarily in `observe.ts`.
   - Ensure redo clearing on write paths is still correct.

5. **Extract `snapshot-diff.ts`**
   - Move diff, `markPristine`, `isPristine`, `reset`, and snapshot cache.

6. **Extract `undo-redo.ts`**
   - Move redo cache and undo/redo/apply logic; ensure `suspendWriteCounter` utilities are co-located here.

7. **Extract `proxy-factory.ts`**
   - Move proxy creation and traps; wire to history, listener-trie, and schedule-queue; keep public `observe()` still in `observe.ts` and call into proxy-factory.
   - Validate Map/Set, array delete, array length, `cacheProxies`, and invalidation via tests.

8. **Extract `batch-transaction.ts`**
   - Move begin, commit, rollback, batch, and transaction APIs.

9. **Extract `config.ts`**
   - Move `observe.configure`; ensure options are merged correctly and `lastUngrouped` is cleared per specification.

10. **API wiring cleanup**
    - Optionally move `observe()` to `api.ts` and keep `observe.ts` as a barrel re-export to minimize import churn.

## Performance opportunities unlocked

- Hot code isolation in proxy-factory for set/delete/maps/sets enables micro-benchmarks and targeted inlining.
- Listener dispatch split: we can precompute ancestor listeners for common paths and cache them if needed.
- History compaction and merge logic becomes testable in isolation; fast-paths for no-op compares via options.compare.
- Snapshot/diff can gain shallow fast-paths and pre-filtered traversal.
- Smaller module closures reduce accidental captures and enable better tree-shaking in consumers.

## Risk & mitigation

- Hidden coupling between helpers (e.g., symbol normalization) — consolidate in path.ts and import consistently.
- Mutation side-effects (redo clearing, cache invalidation) — keep black-box tests running at each step.
- Transaction nesting semantics — add a focused assertion that nested sync+async coalesce into a single group (existing tests already cover this).

## Acceptance criteria

- All existing tests in `src/observe/*.test.ts` pass unchanged after each step.
- No public API/typing changes for consumers of `observe`.
- File boundaries match the responsibilities outlined here.
- Light inline module-level docs (1–2 lines) describing each module’s role.

## Proposed file list (post-refactor)

- observe.ts (barrel wiring or re-export)
- types.ts
- path.ts
- listener-trie.ts
- schedule-queue.ts
- history.ts
- snapshot-diff.ts
- proxy-factory.ts
- undo-redo.ts
- batch-transaction.ts
- config.ts
- README or guide (separate task in roadmap Task 14)

## Next steps

- Proceed with Step 5: Extract `snapshot-diff.ts`.
  - Move pristine snapshot cache and deep clone wrapper (honoring `options.clone`).
  - Move `diffValues` (honoring `options.compare`/`diffFilter`, using `Reflect.ownKeys` and symbol keys).
  - Move `markPristine`, `isPristine`, `diff`, and the `reset` deep overwrite helper.
  - Refactor `observe.ts` to import from `snapshot-diff.ts` and remove local snapshot/diff helpers.
  - Ensure proxy cache is cleared on `markPristine`/`reset` (behavior parity with current tests).
  - Run the observe tests (diff/pristine/reset and related suites) to verify no behavior changes.

## Completed steps

- 2025-09-28 — Step 1: Extracted `types.ts` and `path.ts`.
  - Updated `observe.ts` to import shared types and path helpers.
  - Verified no behavior changes: all observe tests passed.

- 2025-09-28 — Step 2: Extracted `listener-trie.ts` and fully wired `observe.ts` to use it.
  - Replaced in-file trie/registry helpers with `ensureListenerBucket`, `getListenerBucket`, `addListenerToTrie`, `removeListenerFromTrie`, and `getNode` from the new module.
  - Kept public API stable; listener dispatch unchanged (global, exact, down, up).
  - Verified no behavior changes: all observe tests passed. Minor lint/import-order warnings intentionally left as-is per repo guidance.

- 2025-09-28 — Step 3: Extracted `schedule-queue.ts` and refactored `observe.ts` to use it.
  - Moved pause/resume/flush queue management and notification delivery into `schedule-queue.ts`.
  - `observe.listen` now uses `buildEffectiveListener` (once/debounce/throttle/microtask); `observe.pause/resume/flush` delegate to the new module; notifications use `notifyListeners`.
  - Verified no behavior changes: all observe tests passed; public API unchanged.

- 2025-09-28 — Step 4: Extracted `history.ts` and wired `observe.ts` to consume it.
  - Moved history cache, group counters, lastUngrouped window, options store, and group-trim helper into `history.ts`.
  - Updated write paths (set/delete and Map/Set adapters), batch/transaction, undo/redo groups, and configure() to use the new helpers.
  - Fixed minor lint in `history.ts` (explicit return type) and ensured no behavior changes: all observe tests passed.
