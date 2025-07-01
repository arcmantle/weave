# @arcmantle/sqlite-wrapper

A modern, type-safe SQLite wrapper built on top of [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) that provides a fluent, chainable API for database operations. This library offers automatic resource management, WAL mode by default, and comprehensive TypeScript support.

## Features

- **Type-Safe Query Building**: Full TypeScript support with type inference for table schemas
- **Fluent API**: Chainable method calls for building complex queries
- **Automatic Resource Management**: Built-in support for JavaScript's `using` keyword and `Symbol.dispose`
- **WAL Mode**: Write-Ahead Logging enabled by default for better concurrency
- **Transaction Support**: Simple transaction management with automatic rollback on errors
- **Schema Management**: Built-in table creation and column manipulation utilities
- **Safe String Handling**: Automatic SQL injection prevention through proper escaping
- **Filter Builder**: Comprehensive filtering system with logical operators and pattern matching

## Installation

```bash
# npm
npm install jsr:@arcmantle/sqlite-wrapper

# yarn
yarn add jsr:@arcmantle/sqlite-wrapper

# pnpm
pnpm add jsr:@arcmantle/sqlite-wrapper
```

## Quick Start

### Basic Usage

```typescript
import { Query } from '@arcmantle/sqlite-wrapper';

// Create a new query instance
using query = new Query('database.db');

// Create a table
query.define('users')
  .primaryKey('id')
  .column('name', 'TEXT')
  .column('email', 'TEXT', { nullable: false })
  .column('age', 'INTEGER', { value: 0 })
  .query();

// Insert data
query.insert('users')
  .values({ name: 'John Doe', email: 'john@example.com', age: 30 })
  .query();

// Query data
const users = query.from('users')
  .select('name', 'email')
  .where(filter => filter.eq('age', 30))
  .query();
```

### Type-Safe Queries

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

using query = new Query('database.db');

// Type-safe operations
const adults = query.from<User>('users')
  .select('name', 'email')  // TypeScript will validate these field names
  .where(filter => filter
    .and(
      filter.exists('email'),
      filter.oneOf('age', 18, 21, 25)
    )
  )
  .orderBy('name', 'asc')
  .limit(10)
  .query();
```

## API Reference

### Query Class

The main entry point for database operations.

#### Constructor

- `new Query(filename?: string)` - Creates a new query instance with optional database file path

#### Methods

- `from<T>(table: string): SelectBuilder<T>` - Creates a SELECT query builder
- `insert<T>(table: string): InsertBuilder<T>` - Creates an INSERT query builder
- `update<T>(table: string): UpdateBuilder<T>` - Creates an UPDATE query builder
- `delete<T>(table: string): DeleteBuilder<T>` - Creates a DELETE query builder
- `define<T>(table: string): DefineBuilder<T>` - Creates a table definition builder
- `transaction(fn: (query: Query) => void): void` - Executes operations in a transaction

### SELECT Queries

```typescript
query.from('users')
  .select('name', 'email')           // Specify columns
  .where(filter => filter.eq('active', true))  // Add conditions
  .groupBy('department')             // Group results
  .orderBy('name', 'asc', true)      // Sort with nulls last
  .limit(50)                         // Limit results
  .offset(10)                        // Skip rows
  .query();                          // Execute query
```

### INSERT Queries

```typescript
query.insert('users')
  .values({
    name: 'Jane Smith',
    email: 'jane@example.com',
    age: 28
  })
  .query();
```

### UPDATE Queries

```typescript
query.update('users')
  .values({ age: 29 })
  .where(filter => filter.eq('id', 1))
  .query();
```

### DELETE Queries

```typescript
query.delete('users')
  .where(filter => filter.eq('active', false))
  .query();
```

### Table Creation

```typescript
query.define('products')
  .primaryKey('id')
  .column('name', 'TEXT', { nullable: false })
  .column('price', 'REAL', { value: 0.0 })
  .column('description', 'TEXT', { nullable: true })
  .column('in_stock', 'INTEGER', { value: true })
  .query();
```

### Filter Conditions

The filter system provides comprehensive condition building:

```typescript
query.from('users')
  .where(filter => filter
    .and(
      filter.eq('active', true),           // Equality
      filter.startsWith('name', 'John'),   // String prefix
      filter.contains('email', '@gmail'),  // String contains
      filter.oneOf('age', 25, 30, 35),     // Value in list
      filter.exists('phone'),              // Not null
      filter.glob('name', 'J*n')           // Pattern matching
    )
  )
  .query();
```

Available filter methods:

- `eq(field, value)` - Equality comparison
- `startsWith(field, value)` - String starts with
- `endsWith(field, value)` - String ends with
- `contains(field, value)` - String contains
- `oneOf(field, ...values)` - Value in list
- `notOneOf(field, ...values)` - Value not in list
- `exists(field)` - Field is not null
- `notExists(field)` - Field is null
- `glob(field, pattern)` - Unix shell-style pattern matching
- `and(...conditions)` - Logical AND
- `or(...conditions)` - Logical OR

## Utility Functions

### Table Management

```typescript
import { tableExists, dropColumn, getCreateQuery, getTableColumns } from '@arcmantle/sqlite-wrapper';

// Check if table exists
if (tableExists('users')) {
  console.log('Users table exists');
}

// Get table creation SQL
const createSQL = getCreateQuery(db, 'users');

// Get column information
const columns = getTableColumns(db, 'users');

// Drop a column (recreates table)
dropColumn(db, 'users', 'old_column');
```

### String Utilities

```typescript
import { sql, escapeString } from '@arcmantle/sqlite-wrapper';

// Template literal for raw SQL
const rawQuery = sql`SELECT * FROM users WHERE id = ${userId}`;

// Escape strings for SQL
const safeString = escapeString("Don't break SQL");
```

## Type System

### Branded Types

The library uses branded types to provide additional type safety:

```typescript
import type { Branded } from '@arcmantle/sqlite-wrapper';

type UserId = Branded<number, 'UserId'>;
```

### Optional Properties

Utility type for making specific properties optional:

```typescript
import type { Optional } from '@arcmantle/sqlite-wrapper';

type CreateUser = Optional<User, 'id'>;  // Makes 'id' optional
```

## Data Models

Extend the `DataModel` class for automatic property assignment:

```typescript
import { DataModel } from '@arcmantle/sqlite-wrapper';

class User extends DataModel {
  id!: number;
  name!: string;
  email!: string;

  constructor(values: any) {
    super(values);  // Automatically assigns all properties
  }

  static parse(data: unknown): User {
    // Custom parsing logic
    return new User(data);
  }
}
```

## Resource Management

The library supports automatic resource cleanup:

```typescript
// Using 'using' keyword (ES2023)
using query = new Query('database.db');
// Database connection automatically closed when scope ends

// Manual disposal
const query = new Query('database.db');
query[Symbol.dispose]();  // Manually close connection
```

## Transactions

Execute multiple operations atomically:

```typescript
using query = new Query('database.db');

query.transaction(tx => {
  tx.insert('users').values({ name: 'John' }).query();
  tx.insert('profiles').values({ userId: 1 }).query();
  // All operations committed together, or all rolled back on error
});
```

## Advanced Features

### Custom SQL

For complex queries, you can access the underlying prepared statements:

```typescript
const builder = query.from('users').select('*');
const sqlString = builder.queryAsString;  // Get the SQL string
console.log(sqlString);  // Useful for debugging
```

### Error Handling

All query methods include built-in error handling:

```typescript
// SELECT queries return empty arrays on error
const users = query.from('users').query();  // [] if error occurs

// INSERT/UPDATE/DELETE return undefined on error
const result = query.insert('users').values(data).query();
if (result) {
  console.log(`Inserted row with ID: ${result.lastInsertRowid}`);
}
```

## Requirements

- Node.js 16+
- TypeScript 4.5+ (for branded types)
- ES2023+ (for `using` keyword support)

## License

This project is licensed under the Apache License 2.0.

## Contributing

This library is designed to be a lightweight, type-safe wrapper around better-sqlite3. When contributing:

1. Maintain TypeScript type safety
2. Keep the fluent API consistent
3. Add appropriate JSDoc comments
4. Test with various SQLite scenarios
5. Follow the existing code style

## Related Packages

- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - The underlying SQLite library
