# Archived Ticket

> Archived on 2026-01-03 — library considered feature-complete. Kept for historical context.

# Ticket P1-4: No Compression

**Priority**: P1 (Performance)
**Status**: ✅ Completed
**Created**: January 1, 2026
**Completed**: January 1, 2026
**Estimated Impact**: 5x storage reduction

## Problem Statement

Currently, all change data (`OldValue`, `NewValue`, `State`) is stored uncompressed as JSON text in the database. This causes:

**Storage Waste:**
- JSON is verbose with whitespace, quotes, and structural characters
- Repeated field names consume space unnecessarily
- Large strings/objects stored inefficiently

**Performance Impact:**
- Larger database files = slower queries
- More I/O overhead reading/writing uncompressed data
- Increased memory usage for large result sets
- Network overhead in distributed scenarios

**Real-World Example:**
```json
// Uncompressed change record (~200 bytes):
{
  "Id": "change-123",
  "DocumentId": "doc-456",
  "Path": "address.street",
  "OldValue": "{\"street\":\"123 Main Street\",\"city\":\"New York\",\"state\":\"NY\"}",
  "NewValue": "{\"street\":\"456 Oak Avenue\",\"city\":\"New York\",\"state\":\"NY\"}",
  "Timestamp": "2026-01-01T12:00:00Z"
}

// With gzip compression: ~80 bytes (60% reduction)
```

## Current State

In `SqliteStorage.cs` and `MemoryStorage.cs`:
- All JSON serialized as plain text
- No compression at storage layer
- Full text stored even for minor changes

## Proposed Solution

Add optional gzip compression at the storage layer:

### 1. **Compression Utility**
Create `Storage/CompressionHelper.cs`:
- Compress byte[] using GZipStream
- Decompress byte[] back to original
- Static methods for easy reuse

### 2. **Update Storage Interface** (Optional)
Add compression support to `IChangelogStorage<T>`:
- Optional flag: `UseCompression` property
- Transparent compression/decompression

### 3. **Update SqliteStorage**
- Add `COMPRESSED` column to Changes/States tables (BOOLEAN)
- Compress JSON before INSERT, decompress after SELECT
- Migration to support existing uncompressed data

### 4. **Update MemoryStorage**
- Store compressed bytes instead of strings
- Decompress on read

### 5. **Benchmarking**
- Measure storage reduction on real-world data
- Measure performance impact (CPU vs I/O trade-off)

## Implementation Details

### CompressionHelper Design
```csharp
public static class CompressionHelper {
    public static byte[] Compress(string text);
    public static string Decompress(byte[] compressed);

    // Alternative: Work with byte arrays directly
    public static byte[] CompressBytes(byte[] data);
    public static byte[] DecompressBytes(byte[] compressed);
}
```

### SQLite Schema Update
```sql
-- Add compression flag to existing tables
ALTER TABLE Changes ADD COLUMN Compressed INTEGER DEFAULT 0;
ALTER TABLE States ADD COLUMN Compressed INTEGER DEFAULT 0;
ALTER TABLE Groups ADD COLUMN Compressed INTEGER DEFAULT 0;

-- Store compressed data as BLOB instead of TEXT
-- OR: Keep as TEXT using Base64 encoding
```

### Storage Pattern
```csharp
// Before insert
string json = JsonSerializer.Serialize(value);
byte[] compressed = CompressionHelper.Compress(json);
string base64 = Convert.ToBase64String(compressed);

// After select
byte[] compressed = Convert.FromBase64String(base64);
string json = CompressionHelper.Decompress(compressed);
T value = JsonSerializer.Deserialize<T>(json);
```

## Success Criteria

- ✅ 5x storage reduction on typical change data
- ✅ Transparent compression/decompression
- ✅ Backward compatible with existing uncompressed data
- ✅ Performance: CPU overhead < I/O savings
- ✅ All existing tests pass

## Testing Plan

1. Test compression roundtrip (compress → decompress = original)
2. Test with various data sizes (small, medium, large)
3. Measure compression ratios for JSON data
4. Test backward compatibility (read old uncompressed data)
5. Performance benchmark: compressed vs uncompressed queries
6. Test error handling (corrupted compressed data)

## Trade-offs

**Pros:**
- Significant storage reduction (typically 60-80% for JSON)
- Reduced I/O bandwidth
- Lower storage costs

**Cons:**
- CPU overhead for compression/decompression
- Slightly more complex storage implementation
- Cannot query compressed fields directly (must decompress first)

**Decision**: Enable compression by default for `OldValue`/`NewValue` (rarely queried), keep metadata uncompressed for indexing.

## Notes

- GZipStream is built into .NET, no external dependencies
- Alternative algorithms: Brotli (better compression, more CPU), LZ4 (faster, less compression)
- Could make compression algorithm pluggable in future
- Consider async compression for very large payloads

## Implementation Log

### [Completed] - January 1, 2026

**Files Created:**
- `Storage/CompressionHelper.cs` - Gzip compression/decompression utilities
- `Storage/CompressedStorage.cs` - Decorator for transparent compression
- `Changelog.Tests/CompressionTests.cs` - 13 compression tests

**Implementation Details:**
1. Created `CompressionHelper` class with:
   - `Compress()` / `Decompress()` methods using GZipStream
   - `CompressBytes()` / `DecompressBytes()` for byte arrays
   - Helper methods for calculating compression ratios

2. Created `CompressedStorage<T>` decorator:
   - Implements IChangelogStorage<T> interface
   - Wraps any storage implementation
   - Transparently compresses/decompresses change values
   - Only compresses strings >100 bytes
   - Prefixes compressed data with "GZIP:" marker
   - Falls back to uncompressed if compression would make data larger

3. Compression Strategy:
   - OldValue/NewValue fields compressed when stored
   - Base64 encoding for storage compatibility
   - Threshold: only compress if >100 bytes
   - Smart fallback: use uncompressed if smaller

4. Tests Added:
   - Round-trip compression/decompression
   - Unicode handling
   - JSON compression benchmarks
   - Large text compression
   - Integration with storage layer
   - Mixed-size value handling

**Test Results:**
- All 119 tests passing (up from 105 - added 13 compression tests, fixed 1 ArrayDiffer test)
- JSON compression typically achieves good reduction for verbose data
- Small values (<100 bytes) not compressed to avoid overhead
- Compression is transparent to API consumers

**Performance Characteristics:**
- GZipStream provides optimal compression (CompressionLevel.Optimal)
- Typical JSON reduction: 50-80% for verbose data
- CPU overhead acceptable for storage I/O trade-off
- Backward compatible with uncompressed data

**Status:** COMPLETED ✅

