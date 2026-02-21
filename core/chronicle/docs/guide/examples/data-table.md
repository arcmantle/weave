---
title: 'Example: Data Table with Sorting & Filtering'
description: High-performance data table with sorting, filtering, selection, and bulk operations
keywords: example, data table, sorting, filtering, performance, batching, bulk operations
---

# Example: Data Table with Sorting & Filtering

Build a high-performance data table with sorting, filtering, selection, and bulk operations.

## Overview

This example demonstrates:

- 📊 Large dataset handling (10,000+ rows)
- 🔍 Real-time filtering
- ⬆️⬇️ Multi-column sorting
- ✅ Row selection (single/multi)
- ⚡ Bulk operations
- 📝 Inline editing
- 📄 Pagination
- 💾 Column configuration persistence

## Complete Implementation

### Type Definitions

```typescript
import { chronicle, ChronicleProxy } from '@arcmantle/chronicle';

interface DataRow {
  id: string;
  name: string;
  email: string;
  age: number;
  department: string;
  salary: number;
  joinDate: Date;
  active: boolean;
}

interface SortConfig {
  column: keyof DataRow;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  column: keyof DataRow;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan';
  value: any;
}

interface TableState {
  data: DataRow[];
  filteredData: DataRow[];
  selectedRows: Set<string>;
  sortConfig: SortConfig[];
  filters: FilterConfig[];
  page: number;
  pageSize: number;
  editingCell: { rowId: string; column: keyof DataRow } | null;
}
```

### State Setup

```typescript
// Generate sample data
function generateSampleData(count: number): DataRow[] {
  const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
  const data: DataRow[] = [];

  for (let i = 0; i < count; i++) {
    data.push({
      id: `user-${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      age: 20 + Math.floor(Math.random() * 40),
      department: departments[Math.floor(Math.random() * departments.length)],
      salary: 40000 + Math.floor(Math.random() * 120000),
      joinDate: new Date(2010 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 12), 1),
      active: Math.random() > 0.2,
    });
  }

  return data;
}

const table = chronicle<TableState>({
  data: generateSampleData(10000),
  filteredData: [],
  selectedRows: new Set(),
  sortConfig: [],
  filters: [],
  page: 0,
  pageSize: 50,
  editingCell: null,
}, {
  maxHistory: 50,
  filter: (path) => {
    // Don't track filteredData or page changes in history
    return path[0] !== 'filteredData' && path[0] !== 'page';
  },
});

// Initialize filtered data
table.filteredData = table.data;
```

### Filtering

```typescript
// Add filter
function addFilter(filter: FilterConfig): void {
  table.filters.push(filter);
  applyFilters();
}

// Remove filter
function removeFilter(index: number): void {
  table.filters.splice(index, 1);
  applyFilters();
}

// Clear all filters
function clearFilters(): void {
  table.filters = [];
  table.filteredData = table.data;
}

// Apply all filters
function applyFilters(): void {
  let filtered = table.data;

  for (const filter of table.filters) {
    filtered = filtered.filter((row) => {
      const value = row[filter.column];

      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        case 'greaterThan':
          return value > filter.value;
        case 'lessThan':
          return value < filter.value;
        default:
          return true;
      }
    });
  }

  table.filteredData = filtered;
  table.page = 0; // Reset to first page
}

// Quick search across all text columns
function quickSearch(query: string): void {
  if (!query.trim()) {
    table.filteredData = table.data;
    return;
  }

  const lowerQuery = query.toLowerCase();
  table.filteredData = table.data.filter((row) => {
    return (
      row.name.toLowerCase().includes(lowerQuery) ||
      row.email.toLowerCase().includes(lowerQuery) ||
      row.department.toLowerCase().includes(lowerQuery)
    );
  });

  table.page = 0;
}
```

### Sorting

```typescript
// Toggle sort on column
function toggleSort(column: keyof DataRow): void {
  const existing = table.sortConfig.find((s) => s.column === column);

  chronicle.batch(table, () => {
    if (existing) {
      // Cycle through: asc → desc → remove
      if (existing.direction === 'asc') {
        existing.direction = 'desc';
      } else {
        const index = table.sortConfig.indexOf(existing);
        table.sortConfig.splice(index, 1);
      }
    } else {
      // Add new sort (with Shift key, add to multi-sort)
      table.sortConfig.push({ column, direction: 'asc' });
    }

    applySort();
  });
}

// Add secondary sort
function addSort(column: keyof DataRow): void {
  if (!table.sortConfig.find((s) => s.column === column)) {
    table.sortConfig.push({ column, direction: 'asc' });
    applySort();
  }
}

// Clear sorting
function clearSort(): void {
  table.sortConfig = [];
  applySort();
}

// Apply sorting
function applySort(): void {
  if (table.sortConfig.length === 0) {
    // Restore original order
    applyFilters();
    return;
  }

  table.filteredData = [...table.filteredData].sort((a, b) => {
    for (const sort of table.sortConfig) {
      const aVal = a[sort.column];
      const bVal = b[sort.column];

      let comparison = 0;

      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;

      if (comparison !== 0) {
        return sort.direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });
}
```

### Selection

```typescript
// Select row
function selectRow(rowId: string): void {
  if (table.selectedRows.has(rowId)) {
    table.selectedRows.delete(rowId);
  } else {
    table.selectedRows.add(rowId);
  }
}

// Select multiple rows
function selectRows(rowIds: string[]): void {
  chronicle.batch(table, () => {
    rowIds.forEach((id) => table.selectedRows.add(id));
  });
}

// Clear selection
function clearSelection(): void {
  table.selectedRows.clear();
}

// Select all filtered rows
function selectAll(): void {
  chronicle.batch(table, () => {
    table.filteredData.forEach((row) => {
      table.selectedRows.add(row.id);
    });
  });
}

// Get selected rows
function getSelectedRows(): DataRow[] {
  return table.data.filter((row) => table.selectedRows.has(row.id));
}
```

### Bulk Operations

```typescript
// Delete selected rows
function deleteSelectedRows(): void {
  if (table.selectedRows.size === 0) return;

  chronicle.batch(table, () => {
    const selectedIds = new Set(table.selectedRows);
    table.data = table.data.filter((row) => !selectedIds.has(row.id));
    table.selectedRows.clear();
    applyFilters();
  });
}

// Update selected rows
function updateSelectedRows(updates: Partial<DataRow>): void {
  if (table.selectedRows.size === 0) return;

  chronicle.batch(table, () => {
    table.data.forEach((row) => {
      if (table.selectedRows.has(row.id)) {
        Object.assign(row, updates);
      }
    });
    applyFilters();
  });
}

// Export selected rows
function exportSelectedRows(): string {
  const selected = getSelectedRows();
  return JSON.stringify(selected, null, 2);
}
```

### Inline Editing

```typescript
// Start editing cell
function startEdit(rowId: string, column: keyof DataRow): void {
  table.editingCell = { rowId, column };
}

// Save cell edit
function saveEdit(value: any): void {
  if (!table.editingCell) return;

  const row = table.data.find((r) => r.id === table.editingCell!.rowId);
  if (row) {
    row[table.editingCell.column] = value;
  }

  table.editingCell = null;
  applyFilters(); // Re-apply in case edit affects filtering
}

// Cancel editing
function cancelEdit(): void {
  table.editingCell = null;
}
```

### Pagination

```typescript
// Get current page data
function getCurrentPage(): DataRow[] {
  const start = table.page * table.pageSize;
  const end = start + table.pageSize;
  return table.filteredData.slice(start, end);
}

// Change page
function setPage(page: number): void {
  const maxPage = Math.ceil(table.filteredData.length / table.pageSize) - 1;
  table.page = Math.max(0, Math.min(page, maxPage));
}

// Change page size
function setPageSize(size: number): void {
  chronicle.batch(table, () => {
    table.pageSize = size;
    table.page = 0;
  });
}

// Get pagination info
function getPaginationInfo() {
  return {
    currentPage: table.page,
    totalPages: Math.ceil(table.filteredData.length / table.pageSize),
    pageSize: table.pageSize,
    totalRows: table.filteredData.length,
    start: table.page * table.pageSize + 1,
    end: Math.min((table.page + 1) * table.pageSize, table.filteredData.length),
  };
}
```

### Column Configuration

```typescript
interface ColumnConfig {
  key: keyof DataRow;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  editable: boolean;
}

const columnConfigs: ColumnConfig[] = [
  { key: 'name', label: 'Name', width: 200, visible: true, sortable: true, editable: true },
  { key: 'email', label: 'Email', width: 250, visible: true, sortable: true, editable: true },
  { key: 'age', label: 'Age', width: 80, visible: true, sortable: true, editable: true },
  { key: 'department', label: 'Department', width: 150, visible: true, sortable: true, editable: true },
  { key: 'salary', label: 'Salary', width: 120, visible: true, sortable: true, editable: true },
  { key: 'joinDate', label: 'Join Date', width: 120, visible: true, sortable: true, editable: false },
  { key: 'active', label: 'Active', width: 80, visible: true, sortable: true, editable: true },
];

// Save column config
function saveColumnConfig(): void {
  localStorage.setItem('table-columns', JSON.stringify(columnConfigs));
}

// Load column config
function loadColumnConfig(): void {
  const saved = localStorage.getItem('table-columns');
  if (saved) {
    Object.assign(columnConfigs, JSON.parse(saved));
  }
}
```

## UI Integration

### React Example

```typescript
import { useEffect, useState } from 'react';

function DataTable() {
  const [, forceUpdate] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = chronicle.on(table, '', () => {
      forceUpdate({});
    }, { mode: 'down', debounceMs: 16 });

    return unsubscribe;
  }, []);

  const pageData = getCurrentPage();
  const pagination = getPaginationInfo();

  return (
    <div className="data-table">
      {/* Toolbar */}
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            quickSearch(e.target.value);
          }}
        />

        <button
          onClick={selectAll}
          disabled={table.filteredData.length === 0}
        >
          Select All
        </button>

        <button
          onClick={clearSelection}
          disabled={table.selectedRows.size === 0}
        >
          Clear Selection ({table.selectedRows.size})
        </button>

        <button
          onClick={deleteSelectedRows}
          disabled={table.selectedRows.size === 0}
        >
          Delete Selected
        </button>

        <button onClick={clearFilters} disabled={table.filters.length === 0}>
          Clear Filters
        </button>

        <button onClick={clearSort} disabled={table.sortConfig.length === 0}>
          Clear Sort
        </button>
      </div>

      {/* Active Filters */}
      {table.filters.length > 0 && (
        <div className="active-filters">
          {table.filters.map((filter, index) => (
            <div key={index} className="filter-tag">
              {filter.column} {filter.operator} {String(filter.value)}
              <button onClick={() => removeFilter(index)}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={table.selectedRows.size === table.filteredData.length}
                onChange={(e) => {
                  if (e.target.checked) selectAll();
                  else clearSelection();
                }}
              />
            </th>
            {columnConfigs.filter((c) => c.visible).map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && toggleSort(col.key)}
                className={col.sortable ? 'sortable' : ''}
                style={{ width: col.width }}
              >
                {col.label}
                {table.sortConfig.find((s) => s.column === col.key) && (
                  <span className="sort-indicator">
                    {table.sortConfig.find((s) => s.column === col.key)!.direction === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageData.map((row) => (
            <tr
              key={row.id}
              className={table.selectedRows.has(row.id) ? 'selected' : ''}
            >
              <td>
                <input
                  type="checkbox"
                  checked={table.selectedRows.has(row.id)}
                  onChange={() => selectRow(row.id)}
                />
              </td>
              {columnConfigs.filter((c) => c.visible).map((col) => (
                <td
                  key={col.key}
                  onDoubleClick={() => col.editable && startEdit(row.id, col.key)}
                >
                  {table.editingCell?.rowId === row.id &&
                  table.editingCell?.column === col.key ? (
                    <input
                      autoFocus
                      defaultValue={String(row[col.key])}
                      onBlur={(e) => saveEdit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(e.currentTarget.value);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                  ) : (
                    String(row[col.key])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        <button onClick={() => setPage(0)} disabled={table.page === 0}>
          First
        </button>
        <button onClick={() => setPage(table.page - 1)} disabled={table.page === 0}>
          Previous
        </button>
        <span>
          Page {pagination.currentPage + 1} of {pagination.totalPages}
          ({pagination.start}-{pagination.end} of {pagination.totalRows})
        </span>
        <button
          onClick={() => setPage(table.page + 1)}
          disabled={table.page === pagination.totalPages - 1}
        >
          Next
        </button>
        <button
          onClick={() => setPage(pagination.totalPages - 1)}
          disabled={table.page === pagination.totalPages - 1}
        >
          Last
        </button>

        <select
          value={table.pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
          <option value={200}>200 per page</option>
        </select>
      </div>
    </div>
  );
}
```

## Performance Optimizations

```typescript
// Debounce filtering for large datasets
chronicle.on(table, 'filters', () => {
  applyFilters();
}, { mode: 'down', debounceMs: 300 });

// Virtual scrolling for huge datasets
function getVisibleRows(scrollTop: number, containerHeight: number): DataRow[] {
  const rowHeight = 40;
  const startIndex = Math.floor(scrollTop / rowHeight);
  const endIndex = Math.ceil((scrollTop + containerHeight) / rowHeight);

  return table.filteredData.slice(startIndex, endIndex);
}

// Batch operations efficiently
function bulkUpdate(updates: Array<{ id: string; data: Partial<DataRow> }>): void {
  chronicle.batch(table, () => {
    updates.forEach(({ id, data }) => {
      const row = table.data.find((r) => r.id === id);
      if (row) {
        Object.assign(row, data);
      }
    });
    applyFilters();
  });
}
```

## Testing

```typescript
describe('Data Table', () => {
  it('should filter data', () => {
    addFilter({ column: 'department', operator: 'equals', value: 'Engineering' });
    expect(table.filteredData.every((r) => r.department === 'Engineering')).toBe(true);
  });

  it('should sort data', () => {
    toggleSort('age');
    expect(table.filteredData[0].age <= table.filteredData[1].age).toBe(true);
  });

  it('should handle bulk operations', () => {
    selectAll();
    deleteSelectedRows();
    expect(table.data).toHaveLength(0);
  });
});
```

## Next Steps

- [Shopping Cart](./shopping-cart) - E-commerce state management
- [Performance Guide](../performance) - Optimize large datasets
- [Best Practices](../best-practices) - Data handling patterns
