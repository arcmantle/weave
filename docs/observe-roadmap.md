# Observe roadmap and implementation tracker

This document tracks incremental improvements to the deep observe feature in `packages/core/library/src/observe/observe.ts`. We’ll implement one task at a time, review outcomes, and iterate.

## Status legend

- Planned: not started
- In progress: being implemented
- Done: merged and tested

## Tasks

### 1. Operation-level batching (grouped history)

- Status: Done
- Goal: Make a single user action undoable with one step, even if it emits multiple low-level records (e.g., array push index + length).
- API (proposed):
  - `observe.beginBatch(object)`, `observe.commitBatch(object)`, `observe.rollbackBatch(object)`
  - Convenience: `observe.batch(object, action)` runs action in a batch, commits on success, rolls back on throw.
- Behavior:
  - Assign a groupId to all change records while batching.
  - `observe.undoGroups(object, 1)` reverts the last committed group atomically.
  - Markers/transactions remain supported and compose with batching; `transaction` is implemented on top of `batch`.
  - Optional coalescing for non-batched changes via `observe.configure(object, { mergeUngrouped, mergeWindowMs })`.
  - Optional history compaction for repeated sets on the same path via `observe.configure(object, { compactConsecutiveSamePath })`.
- Tests (acceptance):
  - push/unshift/splice within a batch is undone with one step and leaves no array holes.
  - Mixed object + array changes within a batch undo in a single step.
  - `rollbackBatch` reverts to the pre-batch state and does not leave history artifacts.
  - mergeUngrouped coalesces non-batched changes into one undoGroups step (time-window aware).
  - compactConsecutiveSamePath reduces history for repeated sets to the same path within a group.
- Notes/Risks: Listener semantics stay per-change (notify normally); history compaction optional follow-up.

### 2. Path normalization to segments (no string concat for matching)

- Status: Done
- Goal: Internally store path as `string[]` segments and match by segments to avoid dot-escaping and reduce allocation.
- Scope:
  - Maintain segments in listeners and dispatch (history already stores `string[]`).
  - Compare by segments for exact/up/down modes, avoid string prefix matching.
  - Join only for user-facing reporting.
  - Support bracket-accessed keys with dots and optionally `Symbol` keys.

- Outcome:
  - Listener registry stores paths as `string[]` segments with a stable key; dispatch compares segments (`exact`, `down`, `up`).
  - `nameofSegments` captures segments; symbols normalized to `sym:<description>` to match runtime proxy paths.
  - Bracket-accessed keys containing dots treated as a single segment (no dot-escape issues); tests added.
  - Symbol-key paths supported; tests added for ancestor notifications.
  - Up mode = ancestors only; Down mode = inclusive (exact + descendants), preserving prior behavior.

- Plan:
  - Introduce an internal Path type: `type PathSeg = string | symbol; type Path = PathSeg[]`.
  - Store listener registrations keyed by Path (or a stable interned ID derived from segments), not by joined strings.
  - Replace string-based startsWith checks with segment-wise comparisons.
  - Keep nameof returning a dotted string for API stability; parse into segments for internal use, respecting bracket access and symbols.
  - Migration layer: accept old string paths internally until all callsites are updated.
- Tests: Keys with dots, numeric indices, and ancestor/descendant mode checks.

### 3. Smarter listener indexing (performance)

- Status: Done
- Goal: Replace O(N) scan over paths with a segment-indexed structure (e.g., trie) per mode.
- Outcome:
  - Introduced a per-root trie storing listeners by path segments and mode.
  - Dispatch walks ancestors for `down`, leaf for `exact`, and subtree for `up`.
  - Registration and removal prune empty nodes automatically; global (root) listeners supported.
  - Behavior validated with the existing test suite; no API changes required.
- Tests: Suite remains green; added symbol/bracket segment tests earlier; micro-benchmarks added for listener distributions.

### 4. Array delete trap smoothing (live behavior)

- Status: Done
- Goal: In the runtime delete trap, if target is an array and key is an integer index, use `splice` instead of `Reflect.deleteProperty` to avoid sparse arrays (parity with undo behavior).
- Outcome:
  - The proxy delete trap now uses `Array.prototype.splice` for numeric indices, while suspending write-notifications to avoid noisy intermediate records.
  - Undo path detects array indices and re-inserts with `splice` to preserve order and density.
  - Paths are normalized consistently in delete operations, matching set/get behavior.
- Tests: Added `observe.array-delete.test.ts` verifying no holes after delete and that `observe.undo` restores the original array.

### 5. History policy controls (size, noise filtering)

- Status: Done
- Goal: Bound history growth and reduce noise.
- API (proposed):
  - `observe.configure(object, { maxHistory?: number, filter?: (record) => boolean })`
- Outcome:
  - `observe.configure` now supports `maxHistory` ring buffer trimming and `filter(record)` for selective history storage.
  - Applied to set/delete and synthetic deletes on array length shrink; composes with batching and compaction.
  - Behavior verified with focused tests: ring buffer keeps last N, filtered records are omitted but state changes still occur.
- Tests: Ring buffer behavior; filtered records aren’t stored.

### 6. Robust symbol path identity (segments as PropertyKey)

- Status: Done
- Goal: Preserve true Symbol identity in paths and include symbol keys across diff/reset.
- Outcome:
  - Introduced stable Symbol ID mapping (e.g., `sym#N`) and used it consistently in both `nameofSegments` and runtime normalization via `normalizePropertyKey`.
  - Listener paths, history, and diff now maintain stable symbol segments; avoids description-based collisions.
  - Symbol listeners and diffs behave predictably even for different symbols with the same description.
- Tests: Added a symbol identity test (distinct symbols with same description don’t collide); existing suites remain green.

### 7. Group-aware history trimming (maxHistory)

- Status: Done
- Goal: Keep undoGroups coherent and predictable when history is trimmed.
- Outcome:
  - Implemented trimming by whole groups from the front (no mid-group splits) when enforcing `maxHistory`.
  - Preserves `undoGroups` semantics even under trimming; integrates with batching and ungrouped merge windows.
- Tests: Added trimming test using explicit batches to ensure deterministic grouping; full suite passes.

### 8. Snapshot/diff/reset fidelity (merge of prior Task 6 and Task 12)

- Status: Done
- Goal: Support custom clone/compare/diffFilter; improve correctness and performance for large subtrees.
- API: `observe.configure(object, { clone?, compare?, diffFilter?: (path) => boolean | 'shallow' })`
- Outcome:
  - Snapshots now use structuredClone-first; custom `clone` hook supported and used by snapshots, diff, and reset.
  - Diff enumerates keys via `Reflect.ownKeys` and uses key normalization (string + stable symbol IDs), supporting `compare` and `diffFilter` (including 'shallow' mode).
  - Reset deep-overwrites using `Reflect.ownKeys` and the configured `clone`, including symbol keys.
- Tests: Existing suites pass unchanged; follow-up targeted tests for Date/Map/Set can be added leveraging custom hooks.

### 9. Map/Set adapters via proxy interception

- Status: Done
- Goal: Observe Map/Set mutations using the same proxy mechanics by intercepting method access.
- Outcome:
  - Wrapped Map#set/delete/clear and Set#add/delete/clear in the get trap.
  - Each mutation records a change record at the collection path with collection metadata (map/set + key), participates in batching/grouping, and notifies listeners (global, exact at the collection, down/up per trie rules).
  - Undo understands collection records: Map set/delete restored appropriately; Set add/delete toggled as expected; clear emits grouped delete records and undoes as a group.
  - Non-mutating collection methods are bound to the raw target to satisfy brand checks.
- Tests: `observe.map-set.test.ts` covers set/add/delete/clear, listener notifications, batch grouping, and undo/undoGroups.

### 10. Listener quality-of-life options

- Status: Done
- Goal: Improve ergonomics and control.
- API: `observe.listen(object, selector, listener, modeOrOptions?, maybeOptions?)`
  - options: `{ once?: boolean; debounceMs?: number; throttleMs?: number; schedule?: 'sync' | 'microtask'; }`
  - Event payload to listener: `(path, newValue, oldValue, meta?)` where `meta = { type: 'set' | 'delete'; existedBefore?: boolean; groupId?: string }`
- Outcome:
  - Backward compatible: existing `(mode?)` call sites keep working. You can also pass only options, or both `(mode, options)`.
  - once: auto-unsubscribes after first delivery.
  - debounceMs: coalesces rapid changes; fires once after quiet period.
  - throttleMs: immediate leading call, trailing call at window end.
  - schedule: 'sync' (default) or 'microtask' to defer delivery.
  - All dispatchers (object/array and Map/Set adapters) pass `meta` to listeners.
- Tests: `observe.listen-options.test.ts` covers once, microtask schedule, debounce, and throttle.

### 11. Transaction upgrades (async, nesting, redo)

- Status: Planned
- Goal: More robust multi-step operations.
- API (proposed):
  - `observe.transactionAsync(object, async observed => { ... })` with auto-rollback on rejection
  - Nested transactions coalesce under the outermost batch
  - Optional redo stack: `observe.redo(object)`
- Tests: Async rollback integrity; nested transactions group changes; redo works after undo.

### 12. Observability surface

- Status: Planned
- Goal: Broader controls for consumers.
- API (proposed):
  - `observe.onAny(object, listener)` — same as global bucket, public
  - `observe.pause(object)` / `observe.resume(object)` — temporarily queue or drop notifications
  - Optional: `observe.flush(object)` to deliver queued notifications
- Tests: Notifications pause/resume/flush work; `onAny` delivers all changes.

### 13. Documentation and samples

- Status: Planned
- Deliverables: Usage guide, gotchas, recipes (markers, transactions, batching, exact/up/down modes), performance tips, array caveats.
- Include Map/Set usage: set/add/delete/clear semantics, batching/undo with groups, listener modes (exact/up/down on collection path), and notes on non-mutating method binding/brand checks.

---

## Execution workflow

- We’ll implement one task at a time starting from Task 1. After each task:
  - Add/update tests
  - Validate performance and correctness
  - Update this document (status, notes, follow-ups)

### Suggested execution order (Planned tasks)

1) Task 9 — Map/Set adapters via proxy interception
2) Task 10 — Listener QoL
3) Task 11 — Transaction upgrades
4) Task 12 — Observability surface
5) Task 13 — Documentation and samples

Notes:

- Earlier “Extensible snapshot/diff” and “Snapshot/diff/reset fidelity for special types” are merged into Task 8.
- Map/Set interception builds on the same proxy mechanics by wrapping mutation methods in the get trap.

## Changelog (will be updated as we go)

- [Done] (2025-09-27) Task 1: Operation-level batching (grouped history), plus coalescing and optional compaction
- [Done] (2025-09-28) Task 2: Path normalization to segments (segment registry, bracket/symbol support, tests)
- [Done] (2025-09-28) Task 3: Listener indexing (trie-based), dispatch validated; micro-bench added
- [Done] (2025-09-28) Task 4: Array delete trap smoothing (delete uses splice; undo re-inserts)
- [Done] (2025-09-28) Task 5: History policy controls (maxHistory + filter)
- [Done] (2025-09-28) Task 6: Robust symbol path identity (stable symbol IDs across nameof and runtime)
- [Done] (2025-09-28) Task 7: Group-aware history trimming (trim by whole groups; preserves undoGroups)
- [Done] (2025-09-28) Task 8: Snapshot/diff/reset fidelity (structuredClone-first, Reflect.ownKeys, clone/compare/diffFilter)
- [Done] (2025-09-28) Task 9: Map/Set adapters via proxy interception
- [Done] (2025-09-28) Task 10: Listener QoL (once, debounce, throttle, schedule + meta)
- [Planned] Task 11: Transaction upgrades
- [Planned] Task 12: Observability surface
- [Planned] Task 13: Docs and samples

### 11. Robust symbol path identity (segments as PropertyKey)

- Status: Done (covered by Task 6)
- Note: Implemented via stable symbol ID mapping and normalized segments; see Task 6 above.

### 12. Snapshot/diff/reset fidelity for special types (complements Task 6)

- Status: Done (merged into Task 8)
- Note: Provided via `clone`, `compare`, and `diffFilter` hooks; shallow diff and Reflect.ownKeys are implemented. Add targeted tests for specific instance types as needed.

### 13. Group-aware history trimming (maxHistory)

- Status: Done (covered by Task 7)
- Note: Implemented trimming by whole groups; see Task 7 above.

### 14. Proxy caching for nested objects (opt-in)

- Status: Planned
- Goal: Stabilize identity and improve performance for repeated traversals.
- API: `observe.configure(object, { cacheProxies?: boolean })`
- Plan:
  - Cache proxies per (target, path) within a root; document identity and memory trade-offs.
  - Ensure cache invalidation on delete/replace to avoid stale proxies.
- Tests: Identity stability, cache effectiveness, memory/GC sanity; micro-bench comparisons.

### 15. Map/Set adapters via proxy interception

- Status: Planned
- Goal: Observe Map/Set mutations using the same proxy mechanics by intercepting method access.
- Plan:
  - In the get trap, wrap mutation methods (Map#set/delete/clear, Set#add/delete/clear) to record change records and dispatch listeners; emit synthetic records for size changes.
  - Ensure batching/grouping semantics and undo support where feasible (e.g., emulate insert/delete via stored entries).
- Tests: set/add/delete/clear produce history and notifications; undo/redo coverage; batch interactions.

## Polish items

- ensureParents: prefer choosing array vs object based on the actual parent slot type when known; only fall back to the following-segment heuristic when necessary.
- Transactions: return groupId from `observe.transaction` and document LIFO semantics for the undo closure.
- Diff: shallow mode and path filters now available via Task 8 (`diffFilter`); consider adding usage docs and targeted tests for large subtrees.

---

## Quick docs: Listener options and meta

Use `observe.listen` with QoL options to control delivery and lifecycle. The listener can accept an optional `meta` with change info.

- Signature (flexible):
  - `observe.listen(obj, sel, listener)`
  - `observe.listen(obj, sel, listener, mode)`
  - `observe.listen(obj, sel, listener, options)`
  - `observe.listen(obj, sel, listener, mode, options)`

- Options:
  - `once`: invoke once, then auto-unsubscribe
  - `debounceMs`: coalesce bursts into a single call after the quiet period
  - `throttleMs`: at most once per window (leading + trailing)
  - `schedule`: 'sync' (default) or 'microtask' to defer delivery

- Meta payload (4th arg): `{ type: 'set' | 'delete'; existedBefore?: boolean; groupId?: string }`

Example:

```ts
const off = observe.listen(state, s => s.user.name, (path, newV, oldV, meta) => {
  console.log('change at', path.join('.'), newV, oldV, meta?.type, meta?.groupId);
}, 'exact', { debounceMs: 50, schedule: 'microtask' });

// Later
off();
```
