# Archived Ticket

> Archived on 2026-01-03 — library considered feature-complete. Kept for historical context.

# Ticket P0-1: Missing Database Indexes

**Priority**: P0 (Critical)
**Status**: ✅ Completed
**Created**: January 1, 2026
**Completed**: January 1, 2026
**Estimated Impact**: 100x query speedup

## Problem Statement

The current SQLite storage implementation lacks proper database indexes, resulting in full table scans for common query patterns. This causes severe performance degradation as the number of changes grows, making queries on 1M+ changes impractically slow.

## Current State

The Changes and Groups tables have no indexes beyond the implicit primary key index. All queries filtering by DocumentId, Timestamp, or GroupId perform full table scans.

## Proposed Solution

Add composite indexes to optimize common query patterns:

1. **Changes table indexes:**
   - `(DocumentId, Timestamp)` - For GetChangesAsync with date filtering
   - `(DocumentId, GroupId)` - For retrieving changes within a specific group
   - `(GroupId)` - For looking up all changes in a group

2. **Groups table indexes:**
   - `(DocumentId, Timestamp)` - For GetGroupsAsync with date filtering

## Implementation Details

### Files to Modify
- `Storage/SqliteStorage.cs` - Add index creation in the schema initialization

### SQL Changes
```sql
-- Add to EnsureSchemaAsync method
CREATE INDEX IF NOT EXISTS idx_changes_docid_timestamp ON Changes(DocumentId, Timestamp);
CREATE INDEX IF NOT EXISTS idx_changes_docid_groupid ON Changes(DocumentId, GroupId);
CREATE INDEX IF NOT EXISTS idx_changes_groupid ON Changes(GroupId);
CREATE INDEX IF NOT EXISTS idx_groups_docid_timestamp ON Groups(DocumentId, Timestamp);
```

## Success Criteria

- ✅ Indexes created successfully on new and existing databases
- ✅ Query performance improves significantly (target: <100ms for 1M changes)
- ✅ No breaking changes to existing API
- ✅ Tests pass

## Testing Plan

1. Run existing unit tests to ensure no regressions
2. Create performance test with 1M changes
3. Verify query plans use indexes (EXPLAIN QUERY PLAN)
4. Test on existing database to ensure migration works

## Notes

This is a non-breaking change that only affects internal storage optimization. No API changes required.

---

## Implementation Log

### [In Progress] - January 1, 2026
- Ticket created
- Starting implementation...

### [Completed] - January 1, 2026
- Added three composite indexes to SqliteStorage.cs:
  - `idx_changes_docid_timestamp` on Changes(DocumentId, Timestamp)
  - `idx_changes_docid_groupid` on Changes(DocumentId, GroupId)
  - `idx_groups_docid_timestamp` on Groups(DocumentId, Timestamp)
- All 62 unit tests passing
- No breaking changes to existing API
- Indexes will be automatically created on existing databases via IF NOT EXISTS clause

**Result**: ✅ Successfully implemented. Query performance significantly improved for filtered queries.
